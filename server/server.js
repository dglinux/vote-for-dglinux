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

function writeCORSHeader(res) {
    res.writeHead(200, {
        "Content-Type": "text/json",
        "Access-Control-Allow-Headers": "text/plain",
        "Access-Control-Allow-Origin": "*",
    });
}

async function checkTokenValidity(token) {
    const uuidMatcher = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidMatcher.exec(token)) {
        console.log("Invalid token: " + token);
        return false;
    }
    await AccessToken.sync();
    let values = await AccessToken.findAll({
        where: {
            token: token
        }
    });
    if (values.length == 0) {
        // ret.ok = false;
        AccessToken.create({
            token: token
        });
        console.log("Inserting: " + token);
        return true;
    } else {
        return true;
    }
}

app.post("/api/checkTokenValidity", async (req, res) => {
    writeCORSHeader(res);
    const data = JSON.parse(req.body);
    let ret = {
        ok: false
    };
    if (data && data.accessToken) {
        ret.ok = await checkTokenValidity(data.accessToken);
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
    Poll.sync().then(() => {
        Poll.create({
            content: JSON.stringify(content),
            expirationDate: expirationDate
        })
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
    Poll.sync().then(() => {
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
            const uuid = data.accessToken;
            poll = poll[0];
            if (poll.expirationDate < new Date()) {
                res.write(JSON.stringify(ret));
                res.end();
                return;
            }
            const content = JSON.parse(poll.content);
            if (!content.multiselect) {
                for (let i = 0; i < content.votes.length; i++) {
                    const index = content.votes[i].voters.indexOf(uuid);
                    if (index >= 0 && i != voteID) {
                        content.votes[i].voters.splice(index, 1);
                    }
                }
            }
            const index = content.votes[voteID].voters.indexOf(uuid);
            if (index >= 0) {
                content.votes[voteID].voters.splice(index, 1);
            } else {
                content.votes[voteID].voters.push(uuid);
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
        })
    });
});

app.listen(12345);