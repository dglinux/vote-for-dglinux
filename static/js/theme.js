function registerThemeListener() {
    const circlets = document.querySelectorAll(".circlet");
    circlets[0].addEventListener("mousedown", switchToBright);
    circlets[1].addEventListener("mousedown", switchToDark);

    detectTheme();
}

function detectTheme() {
    const cookieGroups = document.cookie.split("; ");
    for (let i = 0; i < cookieGroups.length; i++) {
        const kv = cookieGroups[i].split("=");
        if (kv[0] == "theme" && kv[1] == "dark") {
            switchToDarkWithoutAnimation();
        }
    }
}

function switchToBright(e) {
    document.cookie = "theme=white";
    e.target.classList.add("domination");
    e.target.style["z-index"] = 102;
    setTimeout(() => {
        const elems = document.querySelectorAll("*");
        elems.forEach((elem) => {
            elem.classList.remove("dark");
        });
    }, 1300);
    setTimeout (() => {
        e.target.classList.remove("domination");
        e.target.style["z-index"] = 0;
    }, 3000);
}

function switchToDark(e) {
    document.cookie = "theme=dark";
    e.target.classList.add("domination");
    e.target.style["z-index"] = 102;
    setTimeout(() => {
        switchToDarkWithoutAnimation();
    }, 750);
    setTimeout (() => {
        e.target.classList.remove("domination");
        e.target.style["z-index"] = 0;
    }, 2000);
}

function switchToDarkWithoutAnimation() {
    const elems = document.querySelectorAll("*");
    elems.forEach((elem) => {
        elem.classList.add("dark");
    });
}
