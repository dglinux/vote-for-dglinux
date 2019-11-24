// === DEFAULT CONFIGURATIONS === //
const host = "10.61.144.243";
const port = 12345;
let uuid = "";

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
        bar.style.backgroundColor = "#00" + charCode + charCode + "0055";
    }
}

function genUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function getVotingToken() {
    const index = document.cookie.indexOf("vfd-token");
    uuid = "";
    if (index < 0) {
        uuid = genUUID();
        document.cookie = "vfd-token=" + uuid;
    } else {
        const cookieGroups = document.cookie.split("; ");
        for (let i = 0; i < cookieGroups.length; i++) {
            const kv = cookieGroups[i].split("=");
            if (kv[0] == "vfd-token") {
                uuid = kv[1];
            }
        }
    }
    const magicField = document.querySelector("#magic");
    magicField.value = uuid;
    magicField.addEventListener("change", () => {
        if (magicField.value == "generate") {
            document.cookie = "vfd-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC";
            getVotingToken();
            return;
        }
        document.cookie = "vfd-token=" + magicField.value; 
    });
}

function performPermissionCheck() {
    fetch("http://" + host + ":" + port + "/api/checkTokenValidity", {
        method: "post",
        mode: "cors",
        body: JSON.stringify({
            "accessToken": uuid
        })
    }).then((res) => {
        res.json().then((json) => {
            if (!json.ok) {
                const polls = document.querySelector(".ongoing-polls");
                if (polls) { polls.style.display = "none"; }
                const createPollPanel = document.querySelector("#new-poll");
                if (createPollPanel) { createPollPanel.style.display = "none"; }
                const rejection = document.querySelector(".rejection");
                rejection.style.display = "block";
            }
        });
    });
}

function getOngoingPolls() {
    return fetch("http://" + host + ":" + port + "/api/polls", {
        method: "post",
        mode: "cors",
        body: JSON.stringify({
            "accessToken": uuid
        })
    }).then((res) => {
        return res.json().then((json) => {
            if (!json.ok) {
                document.querySelector(".failed").style.display = "block";
                return;
            }
            for (let i = 0; i < json.polls.length; i++) {
                json.polls[i].content = JSON.parse(json.polls[i].content);
            }
            window.polls = json.polls;
        });
    });
}

function voteFor(pollID, voteID) {
    fetch("http://" + host + ":" + port + "/api/voteFor", {
        method: "post",
        mode: "cors",
        body: JSON.stringify({
            "accessToken": uuid,
            "pollID": pollID,
            "voteID": voteID
        })
    }).then((res) => {
        res.json().then((json) => {
            console.log(json);
        });
    });

    const votes = document.querySelectorAll("[pollid='" + pollID + "'].poll-option");
    let total = 0;

    let poll = null;
    for (let j = 0; j < window.polls.length; j++) {
        if (window.polls[j].id == pollID) {
            poll = window.polls[j];
            break;
        }
    }
    if (!poll) { return; }
    const content = poll.content;
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
    for (let i = 0; i < content.votes.length; i++) {
        const vote = content.votes[i];
        const voteElem = votes[i];
        total += vote.voters.length;
        if (vote.voters.indexOf(uuid) >= 0) {
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
    console.log(polls);
    // === CONSTRUCT POLLS === //
    for (let i = 0; i < polls.length; i++) {
        const poll = polls[i].content;
        let innerHTML = `
        <div class="poll" pollid="` + polls[i].id + `">
            <h4>Q: ` + poll.title + `</h4>
            <div><small>` + poll.description + `</small></div>
            <div><small>发起人: ` + poll.author + `</small></div>
            <div><small>多选; 投票截止于 ` + new Date(polls[i].expirationDate).toLocaleDateString("zh-CN") + `</small></div>
            <div class="poll-options-list">
        `;
        let total = 0;
        for (let j = 0; j < poll.votes.length; j++) {
            const vote = poll.votes[j];
            total += vote.voters.length;   
        }
        for (let j = 0; j < poll.votes.length; j++) {
            const vote = poll.votes[j];
            let percentage = Math.floor((vote.voters.length / total) * 100.0);
            if (total == 0) {
                percentage = 0;
            }
            let active = "";
            if (vote.voters.indexOf(uuid) >= 0) {
                active = "voted";
            }
            innerHTML += `
            <div class="poll-option ` + active + `" pollid="` + polls[i].id + `" voteid="` + j + `" voters="` + vote.voters.length + `" multiselect="` + poll.multiselect + `">
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
}
