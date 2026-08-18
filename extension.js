const vscode = require("vscode");
const { SessionStore } = require("./src/sessionStore");
const { SessionsProvider, searchSessions } = require("./src/sessionsView");
const { openSession } = require("./src/sessionOpener");
const chatSwitch = require("./src/switch");

const SCOPE_LABELS = {
    workspace: "This project",
    all: "All projects",
};

function activate(context) {
    chatSwitch.registerStatusBar(context);

    const store = new SessionStore(context);
    const provider = new SessionsProvider(store, vscode.Uri.joinPath(context.extensionUri, "resources"));
    const view = vscode.window.createTreeView("aiChatSwitch.sessions", {
        treeDataProvider: provider,
        showCollapseAll: true,
    });

    function renderViewDescription() {
        const agents = store.enabledAgents;
        const agentLabel = agents.size === 2 ? "" : ` · ${agents.has("claude") ? "Claude" : "Codex"} only`;
        view.description = `${SCOPE_LABELS[store.scope]}${agentLabel}`;
    }

    function refresh() {
        renderViewDescription();
        provider.refresh();
    }

    let timer;
    function scheduleAutoRefresh() {
        clearInterval(timer);
        const seconds = vscode.workspace.getConfiguration("aiChatSwitch").get("autoRefreshSeconds", 45);
        if (seconds <= 0) {
            return;
        }
        timer = setInterval(() => {
            if (view.visible) {
                provider.refresh();
            }
        }, seconds * 1000);
    }

    refresh();
    scheduleAutoRefresh();

    context.subscriptions.push(
        view,
        { dispose: () => clearInterval(timer) },
        vscode.commands.registerCommand("aiChatSwitch.openClaude", chatSwitch.openClaude),
        vscode.commands.registerCommand("aiChatSwitch.openCodex", chatSwitch.openCodex),
        vscode.commands.registerCommand("aiChatSwitch.toggle", chatSwitch.toggle),
        vscode.commands.registerCommand("aiChatSwitch.newClaude", chatSwitch.newClaude),
        vscode.commands.registerCommand("aiChatSwitch.newCodex", chatSwitch.newCodex),
        vscode.commands.registerCommand("aiChatSwitch.openSession", openSession),
        vscode.commands.registerCommand("aiChatSwitch.searchSessions", () => searchSessions(store)),
        vscode.commands.registerCommand("aiChatSwitch.refreshSessions", refresh),
        vscode.commands.registerCommand("aiChatSwitch.toggleScope", async () => {
            await store.setScope(store.scope === "workspace" ? "all" : "workspace");
            refresh();
        }),
        vscode.commands.registerCommand("aiChatSwitch.filterAgent", async () => {
            const choice = await vscode.window.showQuickPick(
                [
                    { label: "Claude and Codex", agents: ["claude", "codex"] },
                    { label: "Claude only", agents: ["claude"] },
                    { label: "Codex only", agents: ["codex"] },
                ],
                { title: "Show sessions from" }
            );
            if (choice) {
                await store.setEnabledAgents(choice.agents);
                refresh();
            }
        }),
        vscode.commands.registerCommand("aiChatSwitch.revealSessionFile", async (session) => {
            if (session?.filePath) {
                await vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(session.filePath));
            }
        }),
        vscode.commands.registerCommand("aiChatSwitch.copySessionId", async (session) => {
            if (session?.id) {
                await vscode.env.clipboard.writeText(session.id);
                vscode.window.showInformationMessage(`Copied session id ${session.id}`);
            }
        }),
        view.onDidChangeVisibility((event) => {
            if (event.visible) {
                provider.refresh();
            }
        }),
        vscode.workspace.onDidChangeWorkspaceFolders(refresh),
        vscode.workspace.onDidChangeConfiguration((event) => {
            if (!event.affectsConfiguration("aiChatSwitch")) {
                return;
            }
            scheduleAutoRefresh();
            refresh();
        })
    );
}

function deactivate() {}

module.exports = { activate, deactivate };
