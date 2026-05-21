const { chromium } = require("playwright");

let browser = null;
let consoleMessages = [];

async function launch() {
  browser = await chromium.launch({ headless: true });
  return browser;
}

async function close() {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

async function newPage() {
  if (!browser) throw new Error("Browser not launched. Call launch() first.");

  const context = await browser.newContext();
  const page = await context.newPage();

  // Collect console messages
  consoleMessages = [];
  page.on("console", (msg) => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text(),
      source: msg.location().url || "",
      line: msg.location().lineNumber || 0,
    });
  });

  // Capture uncaught JS errors before page scripts run
  await page.addInitScript(() => {
    window.__qaErrors = [];
    window.addEventListener("error", (e) => {
      window.__qaErrors.push({
        message: e.message,
        source: e.filename || "",
        line: e.lineno || 0,
      });
    });
    window.addEventListener("unhandledrejection", (e) => {
      window.__qaErrors.push({
        message: e.reason?.message || String(e.reason),
        source: "",
        line: 0,
      });
    });
  });

  return { page, context };
}

function getConsoleErrors() {
  return consoleMessages.filter((m) => m.type === "error");
}

function getConsoleWarnings() {
  return consoleMessages.filter((m) => m.type === "warning");
}

function getQaErrors(page) {
  return page.evaluate(() => window.__qaErrors || []);
}

module.exports = { launch, close, newPage, getConsoleErrors, getConsoleWarnings, getQaErrors };
