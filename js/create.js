function isLastElementOfList(elem) {
    const list = document.querySelector(".new-poll-options-list");
    return list.lastElementChild == elem;
}

function getOptionValue(elem) {
    return elem.querySelector("input").value;
}

function optionEventListener(e) {
    const list = document.querySelector(".new-poll-options-list");
    let shouldInsertNewItem = false;
    let elem;
    for (let i = 0; i < e.path.length; i++) {
        if (e.path[i].classList.contains("poll-option")) {
            elem = e.path[i];
            shouldInsertNewItem = isLastElementOfList(elem) && getOptionValue(elem) != "";
            break;
        }
    }
    if (shouldInsertNewItem) {
        window.template.addEventListener("keyup", optionEventListener);
        window.template.querySelector("input").placeholder = "选项 " + (list.childElementCount + 1);
        console.log(window.template.getAttribute("placeholder"));
        list.appendChild(window.template);
        window.template = window.template.cloneNode(true);
    } else if (getOptionValue(elem) == "" && isLastElementOfList(elem.nextElementSibling)) {
        elem.nextElementSibling.remove();
    }
}

function submit() {
    console.log("SUBMITTING");
    const data = {
        title: document.querySelector("#title").value,
        author: document.querySelector("#author").value,
        description: document.querySelector("#description").value,
        expirationDate: document.querySelector("#expirationDate").value,
        multiselect: document.querySelector("#multiselect").checked,
        votes: []
    };
    const list = document.querySelector(".new-poll-options-list");
    for (let i = 0; i < list.childElementCount - 1; i++) {
        const vote = list.children[i];
        const voteData = {
            option: getOptionValue(vote),
            voters: []
        };
        data.votes.push(voteData);
    }
    const json = JSON.stringify(data);
    fetch("http://" + host + ":" + port + "/api/submitPoll", {
        method: "post",
        mode: "cors",
        body: JSON.stringify({
            "accessToken": accessToken,
            "content": json
        })
    }).then((res) => {
        res.json().then((json) => {
            if (res.ok) {
                window.location = "index.html";
            }
        });
    });
}

function performCreatorCheck() {
    if (window.isCreator) {
        document.querySelector("#creator").style.display = "block";
        document.querySelector("#addSubmit").addEventListener("click", () => {
            fetch("http://" + host + ":" + port + "/api/whitelist", {
                method: "post",
                mode: "cors",
                body: JSON.stringify({
                    "accessToken": accessToken,
                    "token": document.querySelector("#addField").value
                })
            });
        });
    }
}

function bindEvents() {
    const original = document.querySelector(".poll-option");
    const submitButton = document.querySelector(".submit");
    original.addEventListener("keyup", optionEventListener);
    submitButton.addEventListener("click", submit);
    window.template = original.cloneNode(true);
}
