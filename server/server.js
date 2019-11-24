const express = require("express");
const bodyParser = require("body-parser");
const Sequelize = require("sequelize");
const Model = Sequelize.Model;

const app = express();
app.use(bodyParser.text());
const sequelize = new Sequelize({
    dialect: "sqlite",
    storage: "votes.sqlite3"
});

sequelize.authenticate().then(() => {});

// === INIT DATA === //
class Vote extends Model {}
class AccessToken extends Model {}

Vote.init({
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
Vote.sync().then(() => {
    return Vote.create({
        content: "{}",
        expirationDate: new Date()
    });
});
app.post("/api/checkTokenValidity", (req, res) => {
    res.writeHead(200, {
        "Content-Type": "text/json",
        "Access-Control-Allow-Headers": "text/plain",
        "Access-Control-Allow-Origin": "*",
    });
    const data = JSON.parse(req.body);
    let ret = {
        ok: false
    };
    if (data && data.accessToken) {
        AccessToken.sync().then(() => {
            AccessToken.findAll({
                where: {
                    token: data.accessToken
                }
            }).then((values) => {
                if (values.length == 0) {
                    // ret.ok = false;
                    AccessToken.create({
                        token: data.accessToken
                    });
                    console.log("Inserting: " + data.accessToken);
                } else {
                    ret.ok = true;
                }
                res.write(JSON.stringify(ret));  
                res.end();          
            });
        });
    } else {
        res.write(JSON.stringify(ret));
        res.end();
    }
});

app.listen(12345);