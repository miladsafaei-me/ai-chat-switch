const fs = require("fs");

// Transcript files are append-only JSONL and can reach hundreds of megabytes, so
// every reader here touches a bounded window of the file instead of the whole thing.

async function readHeadLines(filePath, maxBytes) {
    let handle;
    try {
        handle = await fs.promises.open(filePath, "r");
        const buffer = Buffer.alloc(maxBytes);
        const { bytesRead } = await handle.read(buffer, 0, maxBytes, 0);
        return splitComplete(buffer.subarray(0, bytesRead).toString("utf8"), bytesRead === maxBytes);
    } finally {
        await handle?.close();
    }
}

async function readTailLines(filePath, maxBytes, fileSize) {
    let handle;
    try {
        handle = await fs.promises.open(filePath, "r");
        const size = fileSize ?? (await handle.stat()).size;
        const length = Math.min(maxBytes, size);
        const buffer = Buffer.alloc(length);
        await handle.read(buffer, 0, length, size - length);
        const lines = buffer.toString("utf8").split("\n");
        if (length < size) {
            // The first line is a fragment of whatever record straddles the window.
            lines.shift();
        }
        return lines.filter((line) => line.trim() !== "");
    } finally {
        await handle?.close();
    }
}

function splitComplete(text, truncated) {
    const lines = text.split("\n");
    if (truncated) {
        lines.pop();
    }
    return lines.filter((line) => line.trim() !== "");
}

function parseJson(line) {
    try {
        return JSON.parse(line);
    } catch {
        return undefined;
    }
}

// Both agents inject machine-generated preamble into the first user turn. A title
// built from that reads identically for every session, so strip it before use.
const NOISE_PATTERNS = [
    /<[a-z][a-z0-9-]*(?:\s[^>]*)?>[\s\S]*?<\/[a-z][a-z0-9-]*>/gi,
    /^#\s*Files mentioned by the user:[\s\S]*?(?=\n\n|$)/i,
    /^Caveat:[^\n]*/i,
];

function cleanPrompt(text) {
    if (typeof text !== "string") {
        return "";
    }
    let cleaned = text;
    for (const pattern of NOISE_PATTERNS) {
        cleaned = cleaned.replace(pattern, " ");
    }
    return cleaned.replace(/```[\s\S]*?```/g, " ").replace(/\s+/g, " ").trim();
}

function toTitle(text, maxLength = 90) {
    const cleaned = cleanPrompt(text);
    if (cleaned === "") {
        return "";
    }
    if (cleaned.length <= maxLength) {
        return cleaned;
    }
    return `${cleaned.slice(0, maxLength).trimEnd()}…`;
}

module.exports = { cleanPrompt, parseJson, readHeadLines, readTailLines, toTitle };
