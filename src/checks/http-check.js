const { newPage } = require("../browser");
const config = require("../../config");

async function checkHttp(browser) {
  const results = [];

  for (const { path, label } of config.pages) {
    const url = config.siteUrl.replace(/\/$/, "") + path;
    const { page, context } = await newPage(browser);

    let status = null;
    let passed = false;
    let error = null;

    try {
      const response = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: config.pageTimeout,
      });
      status = response ? response.status() : null;
      passed = status !== null && status >= 200 && status < 400;
    } catch (e) {
      error = e.message;
      status = "unreachable";
    } finally {
      await context.close();
    }

    results.push({
      path,
      label,
      url,
      status,
      passed,
      error: error || null,
    });
  }

  return results;
}

module.exports = { checkHttp };
