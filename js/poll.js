// === DEFAULT CONFIGURATIONS === //
const host = "localhost";
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
    magicField.addEventListener("change", function() {
        if (magicField.value == "generate") {
            document.cookie = "vfd-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC";
            getVotingToken();
            return;
        }
        document.cookie = "vfd-token=" + magicField.value; 
    });
}

function performPermissionCheck() {
    const headers = new Headers();
    console.log(headers);
    fetch("http://" + host + ":" + port + "/api/checkTokenValidity", {
        method: "post",
        mode: "cors",
        body: JSON.stringify({
            "accessToken": uuid
        })
    }).then((res) => {
        res.json().then((json) => {
            console.log(json);
        });
    });
}

getVotingToken();
performPermissionCheck();
fillUpPollBars();
