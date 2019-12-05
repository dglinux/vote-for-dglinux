// === DEFAULT CONFIGURATIONS === //
const host = window.location.hostname;
const port = window.location.port;
let accessToken = "";
let username = "";

function fillUpPollBars() {
    let pollOptions = document.querySelectorAll(".poll-option");
    for (let i = 0; i < pollOptions.length; i++) {
        const option = pollOptions[i];
        let percentageText = option.querySelector("small").innerHTML;
        let percentage = (100 - +percentageText.substr(0, percentageText.length - 1));
        let bar = option.querySelector(".poll-bar");
        bar.style.right = percentage + "%";
        // map charcode
        let charCode = 3;
        let biggest = 15;
        let p = Math.sqrt((100 - percentage) / 100.0);
        charCode = charCode - Math.round((p * (charCode - biggest)));
        charCode = charCode.toString(16);
        if (!option.classList.contains("expired")) {
            bar.style.backgroundColor = "#00" + charCode + charCode + "0055";
        } else {
            bar.style.backgroundColor = "#" + charCode + charCode + "660355"; 
        }
    }
}

function getVotingToken() {
    const index = document.cookie.indexOf("vfd-token");
    accessToken = "";
    const url = new URL(window.location);
    if (index < 0 && url.searchParams.get("code")) {
        console.log("Got code. Accessing OAUTH...");
        fetch("http://" + host + ":" + port + "/api/oauth", {
            method: "post",
            mode: "cors",
            body: JSON.stringify({
                "code": url.searchParams.get("code")
            })
        }).then((res) => {
            res.json().then((json) => {
                if (json.ok) {
                    document.cookie = "vfd-token=" + json.token;
                    document.cookie = "vfd-username=" + json.username;
                    url.searchParams.delete("code");
                    url.searchParams.delete("state");
                    window.location = url;
                } else {
                    renderError();
                    const rejection = document.querySelector(".rejection");
                    rejection.innerHTML = `<h4>Github 登录错误！</h4><p>` + json.reason + `</p>`;
                }
            });
        });
        renderError();
        const rejection = document.querySelector(".rejection");
        rejection.innerHTML = `<h4>正在登录</h4><p>稍等……</p>`;
        hideLoginButton();
        return false
    } else if (index < 0) {
        renderError();
        const rejection = document.querySelector(".rejection");
        rejection.innerHTML = `<h4>你要先用 Github 登录！</h4><p>登录上 Github 后，就可以投票了！</p>`;
        return false;
    } else {
        const cookieGroups = document.cookie.split("; ");
        for (let i = 0; i < cookieGroups.length; i++) {
            const kv = cookieGroups[i].split("=");
            if (kv[0] == "vfd-token") {
                accessToken = kv[1];
            } else if (kv[0] == "vfd-username") {
                username = kv[1];
            }
        }
        document.querySelector(".magic-field").innerHTML = "<h3>你好，" + username + "。</h3>";
    }
    return true;
}

function renderError() {
    const polls = document.querySelector(".ongoing-polls");
    if (polls) { polls.style.display = "none"; }
    const createPollPanel = document.querySelector("#new-poll");
    if (createPollPanel) { createPollPanel.style.display = "none"; }
    const rejection = document.querySelector(".rejection");
    rejection.style.display = "block";
}

function reverseRenderError() {
    const polls = document.querySelector(".ongoing-polls");
    if (polls) { polls.style.display = ""; }
    const createPollPanel = document.querySelector("#new-poll");
    if (createPollPanel) { createPollPanel.style.display = "block"; }
    const rejection = document.querySelector(".rejection");
    rejection.style.display = "none";
}

function performPermissionCheck() {
    return fetch("http://" + host + ":" + port + "/api/checkTokenValidity", {
        method: "post",
        mode: "cors",
        body: JSON.stringify({
            "accessToken": accessToken
        })
    }).then((res) => {
        reverseRenderError();
        return res.json().then((json) => {
            if (!json.ok) {
                renderError();
                const rejection = document.querySelector(".rejection");
                rejection.innerHTML = `<h4>Uh oh - You were rejected!</h4><p>很抱歉，但是你的访问被拒绝了。如果你认为这是我们的问题，你可以联系 42yeah 。</p><div class="submit" onclick="clearCredentials()">重新认证</div>`;
            } else if (json.admin) {
                window.admin = json.admin;
                window.registrationAllowed = json.registrationAllowed;
            }
        });
    }).catch(err => {
        renderError();
        const rejection = document.querySelector(".rejection");
        rejection.innerHTML = `<h4>Uh oh - Connection refused!</h4><p>这有可能是你的问题，也可能是我的问题。先检查一下你的网络连接，然后重试一下吧。</p>`;
    });
}

function getOngoingPolls() {
    return fetch("http://" + host + ":" + port + "/api/polls", {
        method: "post",
        mode: "cors",
        body: JSON.stringify({
            "accessToken": accessToken
        })
    }).then((res) => {
        return res.json().then((json) => {
            if (!json.ok) {
                document.querySelector(".failed").style.display = "block";
                return;
            }
            for (let i = 0; i < json.polls.length; i++) {
                json.polls[i].content = JSON.parse(json.polls[i].content);
                json.polls[i].expired = new Date(json.polls[i].expirationDate) < new Date();
            }
            window.polls = json.polls;
        });
    });
}

function voteFor(pollID, voteID) {
    let poll = null;
    for (let j = 0; j < window.polls.length; j++) {
        if (window.polls[j].id == pollID) {
            poll = window.polls[j];
            break;
        }
    }
    if (!poll || new Date(poll.expirationDate) < new Date()) { return; }
    fetch("http://" + host + ":" + port + "/api/voteFor", {
        method: "post",
        mode: "cors",
        body: JSON.stringify({
            "accessToken": accessToken,
            "pollID": pollID,
            "voteID": voteID
        })
    }).then((res) => {
        res.json().then((json) => {});
    });
    
    let total = 0;
    const votes = document.querySelectorAll("[pollid='" + pollID + "'].poll-option");
    const content = poll.content;
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
    for (let i = 0; i < content.votes.length; i++) {
        const vote = content.votes[i];
        const voteElem = votes[i];
        total += vote.voters.length;
        if (vote.voters.indexOf(accessToken) >= 0) {
            voteElem.classList.add("voted");
        } else {
            voteElem.classList.remove("voted"); 
        }
        voteElem.setAttribute("voters", vote.voters.length);
    }
    for (let i = 0; i < votes.length; i++) {
        const vote = votes[i];
        let voters = +vote.getAttribute("voters");
        let percentage = Math.floor((voters / total) * 100.0);
        if (total == 0) {
            percentage = 0;
        }
        let small = vote.querySelector("small");
        small.innerHTML = percentage + "%";
    }
    fillUpPollBars();
}

function renderOngoingPolls() {
    const polls = window.polls;
    let pollsHTML = "";
    // === CONSTRUCT POLLS === //
    for (let i = 0; i < polls.length; i++) {
        const content = polls[i].content;
        const expiredWarning = polls[i].expired ? "style=\"color: #ff7603\"; font-weight: bold" : "";
        const expired = polls[i].expired ? "expired" : "";
        const multiselect = content.multiselect ? "多选" : "单选";
        let innerHTML = `
        <div class="poll" pollid="` + polls[i].id + `">
            <h4 id="` + content.title + `"><a class="poll-link" href="#` + content.title + `">Q: ` + content.title + `</a></h4>
            <div><small>` + content.description + `</small></div>
            <div><small>发起人: ` + content.author + `</small></div>
            <div><small>` + multiselect + `; 投票截止于 <span ` + expiredWarning + `>` + new Date(polls[i].expirationDate).toLocaleDateString("zh-CN") + `</span></small></div>
            <div class="poll-options-list">
        `;
        let total = 0;
        for (let j = 0; j < content.votes.length; j++) {
            const vote = content.votes[j];
            total += vote.voters.length;   
        }
        for (let j = 0; j < content.votes.length; j++) {
            const vote = content.votes[j];
            let percentage = Math.floor((vote.voters.length / total) * 100.0);
            if (total == 0) {
                percentage = 0;
            }
            let active = "";
            if (vote.voters.indexOf(accessToken) >= 0) {
                active = "voted";
            }
            innerHTML += `
            <div class="poll-option ` + active + ` ` + expired + `" pollid="` + polls[i].id + `" voteid="` + j + `" voters="` + vote.voters.length + `" multiselect="` + content.multiselect + `">
                <div class="poll-bar"></div>
                ` + vote.option + ` <small>` + percentage + `%</small>
            </div>
            `;
        }
        innerHTML += `
            </div>
        </div>
        `;
        pollsHTML += innerHTML;
    }
    document.querySelector(".ongoing-polls").innerHTML = pollsHTML;
    let options = document.querySelectorAll(".poll-option");
    for (let i = 0; i < options.length; i++) {
        const option = options[i];
        option.addEventListener("click", () => {
            voteFor(+option.getAttribute("pollid"), +option.getAttribute("voteid"));
        });
    }
    fillUpPollBars();
    if (window.location.hash != "") {
        let elem = document.querySelector("[id='" + decodeURIComponent(window.location.hash).substr(1) + "']");
        elem.scrollIntoView();
        elem.parentElement.classList.add("blinky");
    }
}

function hideLoginButton() {
    document.querySelector(".magic-field").style.display = "none";
}

function clearCredentials() {
    document.cookie = "vfd-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC";
    document.cookie = "vfd-username=; expires=Thu, 01 Jan 1970 00:00:00 UTC";
    window.location.reload();
}
