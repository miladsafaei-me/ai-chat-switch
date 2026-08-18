const fs = require("fs");
const os = require("os");
const path = require("path");
const { parseJson, readHeadLines, readTailLines, toTitle } = require("./transcript");

const HEAD_BYTES = 64 * 1024;
const TAIL_BYTES = 128 * 1024;

const agent = {
    id: "claude",
    label: "Claude",
    icon: "claude.svg",
    extensionId: "anthropic.claude-code",
};

function defaultRoot() {
    const configured = process.env.CLAUDE_CONFIG_DIR;
    return configured ? path.join(configured, "projects") : path.join(os.homedir(), ".claude", "projects");
}

// Claude Code names each transcript directory after the working directory with
// every non-alphanumeric character folded to a dash, so the workspace path can be
// encoded the same way and matched without reading a single file.
function encodeProjectDir(directory) {
    return directory.replace(/[^a-zA-Z0-9]/g, "-");
}

function directoryBelongsToRoots(directoryName, encodedRoots) {
    if (encodedRoots.length === 0) {
        return true;
    }
    return encodedRoots.some((root) => directoryName === root || directoryName.startsWith(`${root}-`));
}

async function listCandidates({ root, workspaceFolders }) {
    const encodedRoots = workspaceFolders.map(encodeProjectDir);
    let entries;
    try {
        entries = await fs.promises.readdir(root, { withFileTypes: true });
    } catch {
        return [];
    }

    const candidates = [];
    for (const entry of entries) {
        if (!entry.isDirectory() || !directoryBelongsToRoots(entry.name, encodedRoots)) {
            continue;
        }
        const directory = path.join(root, entry.name);
        let files;
        try {
            files = await fs.promises.readdir(directory, { withFileTypes: true });
        } catch {
            continue;
        }
        for (const file of files) {
            if (!file.isFile() || !file.name.endsWith(".jsonl")) {
                continue;
            }
            const filePath = path.join(directory, file.name);
            try {
                const stats = await fs.promises.stat(filePath);
                if (stats.size > 0) {
                    candidates.push({ filePath, mtimeMs: stats.mtimeMs, size: stats.size });
                }
            } catch {
                /* the session was deleted while we were listing it */
            }
        }
    }
    return candidates;
}

function textOfMessage(message) {
    if (!message) {
        return "";
    }
    const content = message.content;
    if (typeof content === "string") {
        return content;
    }
    if (Array.isArray(content)) {
        return content
            .filter((block) => block && block.type === "text" && typeof block.text === "string")
            .map((block) => block.text)
            .join(" ");
    }
    return "";
}

async function readMetadata({ filePath, mtimeMs, size }) {
    const head = await readHeadLines(filePath, HEAD_BYTES);
    let cwd;
    let startedAt;
    let firstPrompt = "";

    for (const line of head) {
        const record = parseJson(line);
        if (!record) {
            continue;
        }
        cwd ??= record.cwd;
        startedAt ??= record.timestamp;
        if (firstPrompt === "" && record.type === "user" && !record.isMeta && !record.isSidechain) {
            firstPrompt = toTitle(textOfMessage(record.message));
        }
        if (cwd && startedAt && firstPrompt !== "") {
            break;
        }
    }

    const tail = size > HEAD_BYTES ? await readTailLines(filePath, TAIL_BYTES, size) : head;
    let aiTitle = "";
    let lastPrompt = "";
    // Transcripts get copied between machines, so the last record the agent wrote
    // is a truer "last activity" than the file mtime.
    let lastActivity;
    for (let index = tail.length - 1; index >= 0; index -= 1) {
        const record = parseJson(tail[index]);
        if (!record) {
            continue;
        }
        if (lastActivity === undefined) {
            const parsed = Date.parse(record.timestamp ?? "");
            if (!Number.isNaN(parsed)) {
                lastActivity = parsed;
            }
        }
        if (aiTitle === "" && record.type === "ai-title" && record.aiTitle) {
            aiTitle = toTitle(record.aiTitle);
        }
        if (lastPrompt === "" && record.type === "last-prompt" && record.lastPrompt) {
            lastPrompt = toTitle(record.lastPrompt);
        }
        if (aiTitle !== "" && lastPrompt !== "" && lastActivity !== undefined) {
            break;
        }
    }

    const title = aiTitle || firstPrompt || lastPrompt;
    if (title === "") {
        // A transcript with no prompt at all is a stub the agent never used.
        return undefined;
    }

    return {
        agent: agent.id,
        id: path.basename(filePath, ".jsonl"),
        title,
        subtitle: lastPrompt && lastPrompt !== title ? lastPrompt : firstPrompt,
        cwd: cwd || "",
        filePath,
        startedAt: startedAt ? Date.parse(startedAt) : mtimeMs,
        updatedAt: lastActivity ?? mtimeMs,
    };
}

module.exports = { agent, defaultRoot, encodeProjectDir, listCandidates, readMetadata };
