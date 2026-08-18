const path = require("path");
const vscode = require("vscode");
const claude = require("./claudeSessions");
const codex = require("./codexSessions");

const CACHE_KEY = "aiChatSwitch.metadataCache";
const CACHE_LIMIT = 4000;
const READERS = [claude, codex];

function configuration() {
    return vscode.workspace.getConfiguration("aiChatSwitch");
}

function workspaceFolders() {
    return (vscode.workspace.workspaceFolders || [])
        .filter((folder) => folder.uri.scheme === "file")
        .map((folder) => folder.uri.fsPath);
}

function isInside(child, parent) {
    if (child === parent) {
        return true;
    }
    const relative = path.relative(parent, child);
    return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function rootFor(reader) {
    const override =
        reader.agent.id === "claude"
            ? configuration().get("claudeProjectsPath")
            : configuration().get("codexSessionsPath");
    return override && override.trim() !== "" ? override.trim() : reader.defaultRoot();
}

// Resuming a conversation can write a fresh transcript for the same thread; the
// list should show that thread once, at its most recent activity.
function dedupeByThread(sessions) {
    const seen = new Set();
    return sessions.filter((session) => {
        const key = `${session.agent}:${session.threadId || session.id}`;
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}

class SessionStore {
    constructor(context) {
        this.context = context;
        this.cache = new Map(Object.entries(context.globalState.get(CACHE_KEY, {})));
        this.sessions = [];
        this.truncated = false;
        this.loading = undefined;
    }

    get scope() {
        return configuration().get("sessionScope", "workspace");
    }

    async setScope(scope) {
        await configuration().update("sessionScope", scope, vscode.ConfigurationTarget.Global);
    }

    get enabledAgents() {
        const configured = configuration().get("agents", ["claude", "codex"]);
        return new Set(Array.isArray(configured) && configured.length > 0 ? configured : ["claude", "codex"]);
    }

    async setEnabledAgents(agents) {
        await configuration().update("agents", agents, vscode.ConfigurationTarget.Global);
    }

    load() {
        this.loading ??= this.scan().finally(() => {
            this.loading = undefined;
        });
        return this.loading;
    }

    async scan() {
        const limit = configuration().get("maxSessions", 200);
        const scope = this.scope;
        const enabled = this.enabledAgents;
        const folders = workspaceFolders();
        const scopeToWorkspace = scope === "workspace" && folders.length > 0;
        const collected = [];
        let truncated = false;

        for (const reader of READERS) {
            if (!enabled.has(reader.agent.id)) {
                continue;
            }
            const root = rootFor(reader);
            const candidates = await reader.listCandidates({
                root,
                workspaceFolders: scopeToWorkspace ? folders : [],
            });
            candidates.sort((left, right) => right.mtimeMs - left.mtimeMs);

            const context = reader.buildContext ? await reader.buildContext() : {};
            const examineCap = Math.min(candidates.length, limit * 8);
            let kept = 0;

            for (let index = 0; index < examineCap && kept < limit; index += 1) {
                const candidate = candidates[index];
                const metadata = await this.metadataFor(reader, candidate, context);
                if (!metadata) {
                    continue;
                }
                if (scopeToWorkspace && !folders.some((folder) => metadata.cwd && isInside(metadata.cwd, folder))) {
                    continue;
                }
                collected.push(metadata);
                kept += 1;
            }
            truncated ||= kept >= limit && candidates.length > examineCap;
        }

        collected.sort((left, right) => right.updatedAt - left.updatedAt);
        this.sessions = dedupeByThread(collected);
        this.truncated = truncated;
        await this.persistCache();
        return collected;
    }

    async metadataFor(reader, candidate, context) {
        const cached = this.cache.get(candidate.filePath);
        if (cached && cached.mtimeMs === candidate.mtimeMs && cached.size === candidate.size) {
            return cached.metadata;
        }
        let metadata;
        try {
            metadata = await reader.readMetadata(candidate, context);
        } catch {
            metadata = undefined;
        }
        this.cache.set(candidate.filePath, {
            mtimeMs: candidate.mtimeMs,
            size: candidate.size,
            metadata: metadata ?? null,
        });
        return metadata;
    }

    async persistCache() {
        if (this.cache.size > CACHE_LIMIT) {
            const entries = [...this.cache.entries()]
                .sort((left, right) => right[1].mtimeMs - left[1].mtimeMs)
                .slice(0, CACHE_LIMIT);
            this.cache = new Map(entries);
        }
        await this.context.globalState.update(CACHE_KEY, Object.fromEntries(this.cache));
    }
}

module.exports = { SessionStore, isInside, workspaceFolders };
