const fs = require("fs");
const os = require("os");
const path = require("path");
const { parseJson, readHeadLines, readTailLines, toTitle } = require("./transcript");

// A rollout's first record carries the whole system prompt, so the window has to
// clear that before the first real user turn comes into view.
const HEAD_BYTES = 512 * 1024;
const TAIL_BYTES = 64 * 1024;

const agent = {
    id: "codex",
    label: "Codex",
    icon: "codex.svg",
    extensionId: "openai.chatgpt",
};

function codexHome() {
    return process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
}

function defaultRoot() {
    return path.join(codexHome(), "sessions");
}

// Rollouts are filed under sessions/YYYY/MM/DD, so walking the tree is a handful
// of directory reads rather than a recursive crawl of unknown depth.
async function listCandidates({ root }) {
    const candidates = [];
    await walk(root, 0);
    return candidates;

    async function walk(directory, depth) {
        let entries;
        try {
            entries = await fs.promises.readdir(directory, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            const entryPath = path.join(directory, entry.name);
            if (entry.isDirectory() && depth < 4) {
                await walk(entryPath, depth + 1);
                continue;
            }
            if (!entry.isFile() || !entry.name.startsWith("rollout-") || !entry.name.endsWith(".jsonl")) {
                continue;
            }
            try {
                const stats = await fs.promises.stat(entryPath);
                if (stats.size > 0) {
                    candidates.push({ filePath: entryPath, mtimeMs: stats.mtimeMs, size: stats.size });
                }
            } catch {
                /* the rollout was rotated away while we were listing it */
            }
        }
    }
}

// The extension keeps user-renamed threads in a side index; when a name exists it
// beats anything we could derive from the first prompt.
async function readThreadNames() {
    const names = new Map();
    let content;
    try {
        content = await fs.promises.readFile(path.join(codexHome(), "session_index.jsonl"), "utf8");
    } catch {
        return names;
    }
    for (const line of content.split("\n")) {
        const record = parseJson(line);
        if (record?.id && record.thread_name) {
            names.set(record.id, record.thread_name);
        }
    }
    return names;
}

// A rollout spawned by the agent itself records its origin as an object rather
// than the plain "vscode" / "cli" string a human-started thread carries.
function isSubagentSource(source) {
    return typeof source === "object" && source !== null;
}

function textOfUserMessage(payload) {
    if (typeof payload.message === "string") {
        return payload.message;
    }
    if (Array.isArray(payload.content)) {
        return payload.content
            .filter((block) => block && typeof block.text === "string")
            .map((block) => block.text)
            .join(" ");
    }
    return "";
}

async function lastTimestamp(filePath, size, head) {
    const lines = size > HEAD_BYTES ? await readTailLines(filePath, TAIL_BYTES, size) : head;
    for (let index = lines.length - 1; index >= 0; index -= 1) {
        const parsed = Date.parse(parseJson(lines[index])?.timestamp ?? "");
        if (!Number.isNaN(parsed)) {
            return parsed;
        }
    }
    return undefined;
}

async function readMetadata({ filePath, mtimeMs, size }, context = {}) {
    const head = await readHeadLines(filePath, HEAD_BYTES);
    let id;
    let threadId;
    let cwd;
    let startedAt;
    let firstPrompt = "";

    for (const line of head) {
        const record = parseJson(line);
        if (!record) {
            continue;
        }
        const payload = record.payload || {};
        if (record.type === "session_meta") {
            // Subagent and forked rollouts replay the parent's opening prompt, so
            // listing them would show the same conversation several times over.
            if (payload.parent_thread_id || payload.forked_from_id || isSubagentSource(payload.source)) {
                return undefined;
            }
            id ??= payload.id || payload.session_id;
            threadId ??= payload.session_id || payload.id;
            cwd ??= payload.cwd;
            startedAt ??= payload.timestamp || record.timestamp;
            continue;
        }
        if (record.type === "turn_context") {
            cwd ??= payload.cwd;
            continue;
        }
        if (firstPrompt === "" && record.type === "event_msg" && payload.type === "user_message") {
            firstPrompt = toTitle(textOfUserMessage(payload));
        }
        if (id && cwd && firstPrompt !== "") {
            break;
        }
    }

    // Rollouts get copied and synced between machines, so the file mtime is not a
    // reliable clock; the last record the agent wrote is.
    const lastActivity = (await lastTimestamp(filePath, size, head)) ?? mtimeMs;

    // Fall back to the id embedded in the filename when the meta record is absent.
    id ??= path.basename(filePath, ".jsonl").replace(/^rollout-\d{4}-\d{2}-\d{2}T[\d-]+-/, "");
    const threadName = context.threadNames?.get(id);
    const title = (threadName && toTitle(threadName)) || firstPrompt;
    if (title === "") {
        return undefined;
    }

    return {
        agent: agent.id,
        id,
        threadId: threadId || id,
        title,
        subtitle: threadName && firstPrompt !== title ? firstPrompt : "",
        cwd: cwd || "",
        filePath,
        startedAt: startedAt ? Date.parse(startedAt) : mtimeMs,
        updatedAt: lastActivity,
        size,
    };
}

async function buildContext() {
    return { threadNames: await readThreadNames() };
}

module.exports = { agent, buildContext, defaultRoot, listCandidates, readMetadata };
