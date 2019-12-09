const fs = require("fs");
const express = require("express");
const bodyParser = require("body-parser");
const Sequelize = require("sequelize");
const fetch = require("node-fetch");
const FormData = require("form-data");
const md5 = require("js-md5");

// === SERVE STATIC ===
const serveStatic = require("serve-static");
const staticPath = serveStatic("./static", { index: [ "index.html" ] });

// === SENSITIVE DATA ===
let githubOAuth = {
    clientID: "",
    clientSecret: ""
};

const Model = Sequelize.Model;

const app = express();
app.use(bodyParser.text());
const sequelize = new Sequelize({
    dialect: "sqlite",
    storage: "votes.sqlite3",
    logging: false
});

sequelize.authenticate().then(() => {});

// === INIT DATA === //
class Poll extends Model {}
class AccessToken extends Model {}
let registrationAllowed = false;

Poll.init({
    content: {
        type: Sequelize.STRING,
        allowNull: false
    },
    expirationDate: {
        type: Sequelize.DATE,
        allowNull: false
    }
}, { sequelize });

AccessToken.init({
    token: {
        type: Sequelize.STRING,
        allowNull: false
    },
    identifier: {
        type: Sequelize.STRING,
        allowNull: false
    },
    admin: {
        type: Sequelize.BOOLEAN,
        allowNull: false
    }
}, { sequelize });

// === EVERYTHING IS READY! === //
Poll.sync();
AccessToken.sync();

function writeCORSHeader(res) {
    res.writeHead(200, {
        "Content-Type": "text/json",
        "Access-Control-Allow-Headers": "text/plain",
        "Access-Control-Allow-Origin": "*",
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkTokenValidity(token) {
    // const accessTokenMatcher = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!token || token.length <= 0) {
        console.log("Invalid token: " + token);
        return false;
    }
    let values = await AccessToken.findAll({
        where: {
            token: token,
        },
    });
    return values.length != 0;
}

async function insertToken(token, identifier) {
    let values = await AccessToken.findAll({
        where: {
            token: token,
        },
    });
    if (values.length == 0) {
        await AccessToken.create({
            token: token,
            identifier: identifier,
            admin: false
        });
        console.log("Inserting: " + token);
    }
}

async function isAdmin(token) {
    let values = await AccessToken.findAll({
        where: {
            token: token,
        },
    });
    if (values.length > 0 && values[0].id == 1) {
        await AccessToken.update({
            admin: true
        }, {
            where: {
                id: 1
            }
        });
        return true;
    } else if (values.length > 0 && values[0].admin) {
        return true;
    }
    return false;
}

app.get("*", (req, res) => {
    staticPath(req, res, function() { res.end(); });
});

app.post("/api/checkTokenValidity", async (req, res) => {
    writeCORSHeader(res);
    const data = JSON.parse(req.body);
    let ret = {
        ok: false
    };
    if (data && data.accessToken) {
        ret.ok = await checkTokenValidity(data.accessToken);
        if (await isAdmin(data.accessToken)) {
            ret.admin = true; // MYSTERIOUS!
            ret.registrationAllowed = registrationAllowed;
        }
    }
    res.write(JSON.stringify(ret));
    res.end();
});

app.post("/api/submitPoll", async (req, res) => {
    writeCORSHeader(res);
    const data = JSON.parse(req.body);
    let ret = {
        ok: false
    };
    if (!data || !await checkTokenValidity(data.accessToken) || !data.content) {
        res.write(JSON.stringify(ret));
        res.end();
        return;
    }
    const content = JSON.parse(data.content);
    const expirationDate = new Date(content.expirationDate);
    delete content.expirationDate;

    Poll.create({
        content: JSON.stringify(content),
        expirationDate: expirationDate
    });

    res.write(JSON.stringify(ret));
    res.end();
});

app.post("/api/polls", async (req, res) => {
    writeCORSHeader(res);
    const data = JSON.parse(req.body);
    let ret = {
        ok: false
    };
    if (!data || !await checkTokenValidity(data.accessToken)) {
        res.write(JSON.stringify(ret));
        res.end();
        return;
    }
    ret.ok = true;
    Poll.findAll({
        order: [[ "expirationDate", "DESC" ]]
    }).then((polls) => {
        ret.polls = polls;
        res.write(JSON.stringify(ret));
        res.end();
    });
});

// DEPRECATED: whitelist is not currently usable
app.post("/api/whitelist", async (req, res) => {
    writeCORSHeader(res);
    const data = JSON.parse(req.body);
    let ret = {
        ok: false
    }; 
    if (!data || !await checkTokenValidity(data.accessToken) || !isAdmin(data.accessToken)) {
        res.write(JSON.stringify(ret));
        res.end();
        return;
    }
    await AccessToken.create({
        token: md5(data.identifier),
        admin: false
    });
    console.log("Inserting", data.identifier);
    ret.ok = true;
    res.write(JSON.stringify(ret));
    res.end();
});

app.post("/api/oauth", async (req, oauthRespond) => {
    writeCORSHeader(oauthRespond);
    let ret = {
        ok: false
    };
    const data = JSON.parse(req.body);
    if (!data || !data.code) {
        oauthRespond.write(JSON.stringify(ret));
        oauthRespond.end();
        return;
    }
    let formData = new FormData();
    formData.append("client_id", githubOAuth.clientID);
    formData.append("client_secret", githubOAuth.clientSecret);
    formData.append("code", data.code);
    formData.append("state", "");
    fetch("https://github.com/login/oauth/access_token", {
        method: "post",
        body: formData
    }).then(res => {
        res.text().then(text => {
            text = text.split("&");
            let githubToken;
            for (let i = 0; i < text.length; i++) {
                text[i] = text[i].split("=");
                if (text[i].length <= 1 || text[i][0] == "error") {
                    ret.ok = false;
                    ret.reason = text[i][1];
                    if (ret.reason == undefined) { ret.reason = "The OAuth ClientID might be wrong."; }
                    oauthRespond.write(JSON.stringify(ret));
                    oauthRespond.end();
                    return;
                }
                if (text[i][0] == "access_token") {
                    githubToken = text[i][1];
                }
            }
            fetch("https://api.github.com/user", {
                headers: {
                    "Authorization": "token " + githubToken
                }
            }).then(res => {
                res.json().then(async json => {
                    const identifier = md5(json.login);
                    const token = md5("" + json.id);
                    if (!registrationAllowed) {
                        if (AccessToken.findAll().then(async tokens => {
                            if (tokens.length == 0) {
                                await insertToken(token, identifier);
                            }
                        }));
                    } else {
                        await insertToken(token, identifier);
                    }
                    ret.token = token;
                    ret.ok = true;
                    ret.username = json.login;
                    oauthRespond.write(JSON.stringify(ret));
                    oauthRespond.end();
                });
            });
        });
    }).catch(e => {
        ret.reason = e.toString();
        oauthRespond.write(JSON.stringify(ret));
        oauthRespond.end();
    });
});

app.post("/api/toggleRegistration", async (req, res) => {
    writeCORSHeader(res);
    const data = JSON.parse(req.body);
    let ret = {
        ok: false
    };
    if (!data || !await checkTokenValidity(data.accessToken) || !isAdmin(data.accessToken)) {
        res.write(JSON.stringify(ret));
        res.end();
        return;
    }
    registrationAllowed = !registrationAllowed;
    ret.ok = true;
    res.write(JSON.stringify(ret));
    res.end();
    return;
});

app.post("/api/promote", async (req, res) => {
    writeCORSHeader(res);
    const data = JSON.parse(req.body);
    let ret = {
        ok: false
    };
    if (!data || !await checkTokenValidity(data.accessToken) || !isAdmin(data.accessToken)) {
        res.write(JSON.stringify(ret));
        res.end();
        return;
    }
    const identifier = md5(data.identifier);
    let values = await AccessToken.findAll({
        where: {
            identifier: identifier,
        },
    });
    if (values.length == 0) {
        res.write(JSON.stringify(ret));
        res.end();
        return;
    }
    let user = values[0];
    // promote/demote
    await AccessToken.update({
        admin: !user.admin
    }, {
        where: {
            id: user.id
        }
    });
    ret.ok = true;
    res.write(JSON.stringify(ret));
    res.end();
    return;
});

app.post("/api/voteFor", async (req, res) => {
    writeCORSHeader(res);
    const data = JSON.parse(req.body);
    let ret = {
        ok: false
    };
    if (!data || !await checkTokenValidity(data.accessToken)) {
        res.write(JSON.stringify(ret));
        res.end();
        return;
    }
    Poll.findAll({
        where: {
            id: data.pollID
        }
    }).then(poll => {
        if (poll.length == 0) {
            res.write(JSON.stringify(ret));
            res.end();
            return;
        }
        const voteID = data.voteID;
        const accessToken = data.accessToken;
        poll = poll[0];
        if (poll.expirationDate < new Date()) {
            res.write(JSON.stringify(ret));
            res.end();
            return;
        }
        const content = JSON.parse(poll.content);
        if (!content.multiselect) {
            for (let i = 0; i < content.votes.length; i++) {
                const index = content.votes[i].voters.indexOf(accessToken);
                if (index >= 0 && i != voteID) {
                    content.votes[i].voters.splice(index, 1);
                }
            }
        }
        const index = content.votes[voteID].voters.indexOf(accessToken);
        if (index >= 0) {
            content.votes[voteID].voters.splice(index, 1);
        } else {
            content.votes[voteID].voters.push(accessToken);
        }
        Poll.update({
            content: JSON.stringify(content)
        }, {
            where: {
                id: data.pollID
            }
        }).then(() => {
            ret.ok = true;
            res.write(JSON.stringify(ret));
            res.end();
        }); 
        return;
    });
});

fs.readFile("server-config.json", (err, data) => {
    if (err) { throw err; } // This would be fatal; why tip?
    const json = JSON.parse(data);
    console.log("Listening on " + json.port);
    githubOAuth.clientID = json.clientID;
    githubOAuth.clientSecret = json.clientSecret;
    app.listen(json.port);
});
