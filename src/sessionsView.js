const path = require("path");
const vscode = require("vscode");
const { AGENTS, openSession } = require("./sessionOpener");

const DAY = 24 * 60 * 60 * 1000;

const BUCKETS = [
    { id: "today", label: "Today" },
    { id: "yesterday", label: "Yesterday" },
    { id: "week", label: "Previous 7 days" },
    { id: "older", label: "Older" },
];

function startOfToday() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

function bucketFor(timestamp, todayStart) {
    if (timestamp >= todayStart) {
        return "today";
    }
    if (timestamp >= todayStart - DAY) {
        return "yesterday";
    }
    if (timestamp >= todayStart - 6 * DAY) {
        return "week";
    }
    return "older";
}

function relativeTime(timestamp) {
    const formatter = new Intl.RelativeTimeFormat(vscode.env.language, { numeric: "auto" });
    const minutes = Math.round((timestamp - Date.now()) / 60000);
    if (Math.abs(minutes) < 60) {
        return formatter.format(minutes, "minute");
    }
    const hours = Math.round(minutes / 60);
    if (Math.abs(hours) < 24) {
        return formatter.format(hours, "hour");
    }
    const days = Math.round(hours / 24);
    if (Math.abs(days) < 30) {
        return formatter.format(days, "day");
    }
    return new Date(timestamp).toLocaleDateString(vscode.env.language);
}

function projectName(session) {
    return session.cwd ? path.basename(session.cwd) : "";
}

class GroupNode {
    constructor(label, sessions) {
        this.label = label;
        this.sessions = sessions;
    }
}

class SessionsProvider {
    constructor(store, iconRoot) {
        this.store = store;
        this.iconRoot = iconRoot;
        this.emitter = new vscode.EventEmitter();
        this.onDidChangeTreeData = this.emitter.event;
    }

    refresh() {
        this.emitter.fire();
    }

    async getChildren(element) {
        if (element instanceof GroupNode) {
            return element.sessions;
        }
        if (element) {
            return [];
        }
        const sessions = await this.store.load();
        if (!vscode.workspace.getConfiguration("aiChatSwitch").get("groupByDate", true)) {
            return sessions;
        }
        const todayStart = startOfToday();
        const grouped = new Map(BUCKETS.map((bucket) => [bucket.id, []]));
        for (const session of sessions) {
            grouped.get(bucketFor(session.updatedAt, todayStart)).push(session);
        }
        return BUCKETS.filter((bucket) => grouped.get(bucket.id).length > 0).map(
            (bucket) => new GroupNode(bucket.label, grouped.get(bucket.id))
        );
    }

    getTreeItem(element) {
        if (element instanceof GroupNode) {
            const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.Expanded);
            item.contextValue = "aiChatGroup";
            item.description = `${element.sessions.length}`;
            return item;
        }

        const item = new vscode.TreeItem(element.title, vscode.TreeItemCollapsibleState.None);
        const project = projectName(element);
        const scopeSuffix = this.store.scope === "all" && project ? ` · ${project}` : "";
        item.description = `${AGENTS[element.agent].label} · ${relativeTime(element.updatedAt)}${scopeSuffix}`;
        item.iconPath = vscode.Uri.joinPath(this.iconRoot, `${element.agent}.svg`);
        item.contextValue = "aiChatSession";
        item.tooltip = new vscode.MarkdownString(
            [
                `**${element.title}**`,
                "",
                `- Agent: ${AGENTS[element.agent].label}`,
                `- Project: ${element.cwd || "unknown"}`,
                `- Last activity: ${new Date(element.updatedAt).toLocaleString(vscode.env.language)}`,
                `- Session: \`${element.id}\``,
            ].join("\n")
        );
        item.command = {
            command: "aiChatSwitch.openSession",
            title: "Open Session",
            arguments: [element],
        };
        return item;
    }
}

async function searchSessions(store) {
    const sessions = await store.load();
    const items = sessions.map((session) => ({
        label: `$(${session.agent === "claude" ? "sparkle" : "circuit-board"}) ${session.title}`,
        description: `${AGENTS[session.agent].label} · ${relativeTime(session.updatedAt)}`,
        detail: session.cwd,
        session,
    }));
    const picked = await vscode.window.showQuickPick(items, {
        title: "AI Chat Sessions",
        placeHolder: "Search Claude and Codex sessions",
        matchOnDescription: true,
        matchOnDetail: true,
    });
    if (picked) {
        await openSession(picked.session);
    }
}

module.exports = { GroupNode, SessionsProvider, searchSessions };
