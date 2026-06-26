(() => {
    const navButtons = Array.from(document.querySelectorAll("[data-tab]"));
    const panes = {
        spells: document.getElementById("pane-spells"),
        conditions: document.getElementById("pane-conditions"),
        feats: document.getElementById("pane-feats"),
        classes: document.getElementById("pane-classes"),
        items: document.getElementById("pane-items"),
        character: document.getElementById("pane-character"),
    };

    function show(which) {
        if (!panes[which]) which = "character";
        navButtons.forEach((button) => button.classList.toggle("active", button.dataset.tab === which));
        Object.entries(panes).forEach(([key, pane]) => pane.classList.toggle("hidden", key !== which));
        if (window.location.hash !== `#${which}`) {
            window.history.replaceState(null, "", `#${which}`);
        }
    }

    navButtons.forEach((button) => {
        button.addEventListener("click", () => show(button.dataset.tab));
    });

    window.addEventListener("hashchange", () => show(window.location.hash.slice(1)));
    show(window.location.hash.slice(1) || "character");
})();
