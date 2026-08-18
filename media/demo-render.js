(function render() {
    const language = new URLSearchParams(location.search).get("lang") || "en";
    const content = window.DEMO_CONTENT[language];
    const isRtl = content.direction === "rtl";

    // Only the chat and the session list carry natural language; the VS Code
    // chrome around them stays left-to-right exactly as the workbench renders it.
    const sidebar = document.getElementById("ai-chats-sidebar");
    const tree = document.getElementById("session-tree");
    const panel = document.getElementById("chat-panel");
    if (isRtl) {
        tree.dir = "rtl";
        panel.dir = "rtl";
        sidebar.style.setProperty("--ui-font", '"Vazirmatn", "Adwaita Sans", sans-serif');
        panel.style.setProperty("--ui-font", '"Vazirmatn", "Adwaita Sans", sans-serif');
        sidebar.style.fontFamily = "var(--ui-font)";
        panel.style.fontFamily = "var(--ui-font)";
    }

    document.querySelector("#ai-chats-sidebar .view-description").textContent = content.viewDescription;

    tree.innerHTML = content.groups
        .map(
            (group) => `
            <div class="tree-group">
                <i class="codicon">&#xeab4;</i>${group.label}
                <span class="group-count">${group.sessions.length}</span>
            </div>
            ${group.sessions
                .map(
                    (session) => `
                <div class="session-row${session.selected ? " is-selected" : ""}">
                    <i class="agent-mark is-${session.agent}"></i>
                    <span class="session-title">${session.title}</span>
                    <span class="session-meta" dir="ltr">${session.meta}</span>
                </div>`
                )
                .join("")}`
        )
        .join("");

    const chat = content.chat;
    document.getElementById("chat-answer-zero").textContent = chat.answerZero;
    document.getElementById("chat-user-first").textContent = chat.userFirst;
    document.getElementById("chat-answer-first").textContent = chat.answerFirst;
    document.getElementById("chat-user").textContent = chat.user;
    document.getElementById("chat-answer-lead").textContent = chat.lead;
    document.getElementById("chat-answer-tail").textContent = chat.tail;
    document.getElementById("chat-placeholder").textContent = chat.placeholder;
    document.getElementById("chat-mode").textContent = chat.mode;
    document.getElementById("chat-tools").innerHTML = chat.tools
        .map(
            (tool) => `
        <div class="tool-line">
            <span class="bullet">&#x25CF;</span>
            <span class="tool-name">${tool.name}</span>
            <span dir="ltr">${tool.detail}</span>
            <span class="tool-result">${tool.result}</span>
        </div>`
        )
        .join("");

    document.documentElement.dataset.ready = "true";
})();
