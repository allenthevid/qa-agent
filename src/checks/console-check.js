const { newPage, getConsoleErrors, getQaErrors } = require("../browser");
const config = require("../../config");

async function checkConsole(browser) {
  const url = config.siteUrl.replace(/\/$/, "") + "/";
  const { page, context } = await newPage(browser);

  try {
    await page.goto(url, {
      waitUntil: "networkidle",
      timeout: config.pageTimeout,
    });

    // Let any deferred scripts fire
    await page.waitForTimeout(2000);
  } catch (e) {
    // Site unreachable
    await context.close();
    return {
      url,
      passed: false,
      errors: [{ text: `Site unreachable: ${e.message}`, source: "", line: 0 }],
      warnings: [],
      error: e.message,
    };
  }

  // Collect JS runtime errors captured by addInitScript
  const qaErrors = await getQaErrors(page);

  // Collect console errors from Playwright listener
  const consoleErrors = getConsoleErrors().map((e) => ({
    text: e.text,
    source: e.source,
    line: e.line,
  }));

  // Also include uncaught runtime errors
  for (const qaErr of qaErrors) {
    consoleErrors.push({
      text: qaErr.message,
      source: qaErr.source,
      line: qaErr.line,
    });
  }

  // Filter out known vendor noise
  const filtered = consoleErrors.filter((e) => {
    const ignore = config.consoleErrorIgnore || [];
    return !ignore.some((pattern) => e.text.includes(pattern) || e.source.includes(pattern));
  });

  const warnings = config.reportConsoleWarnings
    ? getConsoleErrors()
        .filter((m) => m.type === "warning")
        .map((m) => ({ text: m.text, source: m.source }))
    : [];

  await context.close();

  return {
    url,
    passed: filtered.length === 0,
    errors: filtered,
    warnings,
  };
}

module.exports = { checkConsole };
