// Embeds VS Code's own codicon font so the mockup renders the real UI glyphs.
const fs = require("fs");
const path = require("path");

const candidates = [
    "/usr/share/code/resources/app/out/media/codicon.ttf",
    "/usr/lib/code/out/media/codicon.ttf",
    "/opt/visual-studio-code/resources/app/out/media/codicon.ttf",
];
const source = candidates.find((candidate) => fs.existsSync(candidate));
if (!source) {
    throw new Error(`codicon.ttf not found. Looked in:\n  ${candidates.join("\n  ")}`);
}

const base64 = fs.readFileSync(source).toString("base64");
fs.writeFileSync(
    path.join(__dirname, "codicon.css"),
    `@font-face {\n    font-family: "codicon";\n    src: url(data:font/ttf;base64,${base64}) format("truetype");\n}\n`
);
console.log(`codicon.css written from ${source}`);
