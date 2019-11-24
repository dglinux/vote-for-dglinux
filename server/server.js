const express = require("express");
const bodyParser = require("body-parser");
const Sequelize = require("sequelize");
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
    }
}, { sequelize });

// === EVERYTHING IS READY! === //
Poll.sync();
AccessToken.sync();
let tokenMutex = false;

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
        tokenMutex = false;
        return false;
    }
    while (tokenMutex) {
        await sleep(100);
    }
    tokenMutex = true;
    let values = await AccessToken.findAll({
        where: {
            token: token,
        },
    });
    const all = await AccessToken.findAll();
    if (all.length == 0) {
        await AccessToken.create({
            token: token,
        });
        console.log("Inserting: " + token);
        values.push(0);
    }
    tokenMutex = false;
    return values.length != 0;
}

async function isCreator(token) {
    let values = await AccessToken.findAll({
        where: {
            token: token,
        },
    });
    if (values.length > 0 && values[0].id == 1) {
        return true;
    }
    return false;
}

app.post("/api/checkTokenValidity", async (req, res) => {
    writeCORSHeader(res);
    const data = JSON.parse(req.body);
    let ret = {
        ok: false
    };
    if (data && data.accessToken) {
        ret.ok = await checkTokenValidity(data.accessToken);
        if (await isCreator(data.accessToken)) {
            ret.creator = true; // MYSTERIOUS!
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

app.post("/api/whitelist", async (req, res) => {
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
    await AccessToken.create({
        token: data.token,
    });
    console.log("Inserting", data.token);
    ret.ok = true;
    res.write(JSON.stringify(ret));
    res.end();
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

app.listen(12345);