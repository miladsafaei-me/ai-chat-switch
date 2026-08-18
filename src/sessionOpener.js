const vscode = require("vscode");
const chatTabs = require("./chatTabs");
const { isInside, workspaceFolders } = require("./sessionStore");

const AGENTS = {
    claude: { label: "Claude", extensionId: "anthropic.claude-code" },
    codex: { label: "Codex", extensionId: "openai.chatgpt" },
};

async function ensureExtension(agentId) {
    const agent = AGENTS[agentId];
    if (vscode.extensions.getExtension(agent.extensionId)) {
        return true;
    }
    const install = "Install Extension";
    const choice = await vscode.window.showErrorMessage(
        `The ${agent.label} extension is not installed, so its sessions cannot be opened.`,
        install
    );
    if (choice === install) {
        await vscode.commands.executeCommand("workbench.extensions.search", agent.extensionId);
    }
    return false;
}

async function openClaudeSession(sessionId) {
    // Signature is (sessionId, initialPrompt, viewColumn); the active column keeps
    // the conversation in the shared chat group instead of a new split.
    await vscode.commands.executeCommand("claude-vscode.editor.open", sessionId, undefined, vscode.ViewColumn.Active);
}

async function openCodexSession(sessionId) {
    await vscode.commands.executeCommand("vscode.openWith", chatTabs.codexConversationUri(sessionId), chatTabs.CODEX_VIEW_TYPE, {
        viewColumn: vscode.ViewColumn.Active,
        preserveFocus: false,
        preview: false,
    });
}

// Resuming a transcript recorded in another project works, but the agent inherits
// the current workspace, so the mismatch is worth surfacing once, without blocking.
function warnAboutForeignWorkspace(session) {
    const folders = workspaceFolders();
    if (!session.cwd || folders.length === 0 || folders.some((folder) => isInside(session.cwd, folder))) {
        return;
    }
    const openWindow = "Open That Folder";
    vscode.window
        .showInformationMessage(`This session belongs to ${session.cwd}, which is not in the current workspace.`, openWindow)
        .then((choice) => {
            if (choice === openWindow) {
                vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(session.cwd), { forceNewWindow: true });
            }
        });
}

async function openSession(session) {
    if (!session || !AGENTS[session.agent]) {
        return;
    }
    if (!(await ensureExtension(session.agent))) {
        return;
    }
    await chatTabs.focusChatGroup();
    try {
        if (session.agent === "claude") {
            await openClaudeSession(session.id);
        } else {
            await openCodexSession(session.id);
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Could not open the ${AGENTS[session.agent].label} session: ${error.message}`);
        return;
    }
    warnAboutForeignWorkspace(session);
}

module.exports = { AGENTS, openSession };
