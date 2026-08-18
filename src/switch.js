const vscode = require("vscode");
const chatTabs = require("./chatTabs");

async function openClaude() {
    const existing = chatTabs.findTab(chatTabs.isClaudeTab);
    if (existing) {
        await chatTabs.revealTab(existing);
        return;
    }
    await vscode.commands.executeCommand("claude-vscode.editor.openLast");
}

async function openCodex() {
    const existing = chatTabs.findTab(chatTabs.isCodexTab);
    if (existing) {
        await vscode.commands.executeCommand("vscode.openWith", existing.tab.input.uri, chatTabs.CODEX_VIEW_TYPE, {
            viewColumn: existing.group.viewColumn,
            preserveFocus: false,
            preview: false,
        });
        return;
    }
    await chatTabs.focusChatGroup();
    await vscode.commands.executeCommand("chatgpt.newCodexPanel");
}

async function toggle() {
    if (chatTabs.activeChat() === "claude") {
        await openCodex();
        return;
    }
    await openClaude();
}

async function newClaude() {
    await chatTabs.focusChatGroup();
    await vscode.commands.executeCommand("claude-vscode.editor.open", undefined, undefined, vscode.ViewColumn.Active);
}

async function newCodex() {
    await chatTabs.focusChatGroup();
    await vscode.commands.executeCommand("chatgpt.newCodexPanel");
}

function registerStatusBar(context) {
    const claudeItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    claudeItem.command = "aiChatSwitch.openClaude";
    claudeItem.tooltip = "Open Claude in the chat tab (Ctrl+Alt+A)";

    const codexItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
    codexItem.command = "aiChatSwitch.openCodex";
    codexItem.tooltip = "Open Codex in the chat tab (Ctrl+Alt+G)";

    function render() {
        const current = chatTabs.activeChat();
        claudeItem.text = current === "claude" ? "$(circle-filled) Claude" : "$(circle-outline) Claude";
        codexItem.text = current === "codex" ? "$(circle-filled) Codex" : "$(circle-outline) Codex";
        claudeItem.show();
        codexItem.show();
    }

    render();

    context.subscriptions.push(
        claudeItem,
        codexItem,
        vscode.window.tabGroups.onDidChangeTabs(render),
        vscode.window.tabGroups.onDidChangeTabGroups(render)
    );
}

module.exports = { newClaude, newCodex, openClaude, openCodex, registerStatusBar, toggle };
