const vscode = require("vscode");

const CODEX_VIEW_TYPE = "chatgpt.conversationEditor";
const CODEX_URI_SCHEME = "openai-codex";
const CODEX_URI_AUTHORITY = "route";

// Claude opens its chat as a webview editor; VS Code prefixes the registered id,
// so the tab's viewType reads like "mainThreadWebview-claudeVSCodePanel".
const CLAUDE_VIEW_TYPE_PATTERN = /claude/i;

const FOCUS_GROUP_COMMANDS = [
    "workbench.action.focusFirstEditorGroup",
    "workbench.action.focusSecondEditorGroup",
    "workbench.action.focusThirdEditorGroup",
    "workbench.action.focusFourthEditorGroup",
];

function isCodexTab(tab) {
    return tab.input instanceof vscode.TabInputCustom && tab.input.viewType === CODEX_VIEW_TYPE;
}

function isClaudeTab(tab) {
    return tab.input instanceof vscode.TabInputWebview && CLAUDE_VIEW_TYPE_PATTERN.test(tab.input.viewType);
}

function findTab(matches) {
    for (const group of vscode.window.tabGroups.all) {
        const index = group.tabs.findIndex(matches);
        if (index !== -1) {
            return { group, tab: group.tabs[index], index };
        }
    }
    return undefined;
}

async function focusColumn(viewColumn) {
    const focusCommand = FOCUS_GROUP_COMMANDS[viewColumn - 1];
    if (focusCommand) {
        await vscode.commands.executeCommand(focusCommand);
    }
}

// vscode has no "reveal this tab" API, so focus the owning group and then select
// the tab by its index within that group.
async function revealTab(found) {
    await focusColumn(found.group.viewColumn);
    await vscode.commands.executeCommand("workbench.action.openEditorAtIndex", found.index);
}

// Both chats belong in the same editor group so they occupy each other's space
// instead of splitting the window. Whichever is already open decides the column.
function preferredColumn() {
    const anyChat = findTab((tab) => isCodexTab(tab) || isClaudeTab(tab));
    return anyChat ? anyChat.group.viewColumn : vscode.ViewColumn.Active;
}

// Move focus into the group that already hosts a chat, so the next open call
// lands there instead of splitting off a new group.
async function focusChatGroup() {
    const column = preferredColumn();
    if (column !== vscode.ViewColumn.Active) {
        await focusColumn(column);
    }
    return column;
}

function codexConversationUri(conversationId) {
    return vscode.Uri.file(`/local/${conversationId}`).with({
        scheme: CODEX_URI_SCHEME,
        authority: CODEX_URI_AUTHORITY,
        query: "",
    });
}

function activeChat() {
    const active = vscode.window.tabGroups.activeTabGroup.activeTab;
    if (!active) {
        return undefined;
    }
    if (isClaudeTab(active)) {
        return "claude";
    }
    if (isCodexTab(active)) {
        return "codex";
    }
    return undefined;
}

module.exports = {
    CODEX_VIEW_TYPE,
    activeChat,
    codexConversationUri,
    findTab,
    focusChatGroup,
    focusColumn,
    isClaudeTab,
    isCodexTab,
    preferredColumn,
    revealTab,
};
