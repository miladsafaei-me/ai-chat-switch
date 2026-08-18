// Renders the promotional screenshots. Run: node media/shoot.js
const path = require("path");
const { chromium } = require("playwright");

const VARIANTS = [
    { lang: "en", file: "ai-chat-switch-demo-en.png" },
    { lang: "fa", file: "ai-chat-switch-demo-fa.png" },
];

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({
        viewport: { width: 1600, height: 900 },
        deviceScaleFactor: 2,
    });
    for (const variant of VARIANTS) {
        const url = `file://${path.join(__dirname, "demo.html")}?lang=${variant.lang}`;
        await page.goto(url, { waitUntil: "networkidle" });
        await page.evaluate(() => document.fonts.ready);
        const output = path.join(__dirname, variant.file);
        await page.screenshot({ path: output });
        console.log(`wrote ${output}`);
    }
    await browser.close();
})();
