const { newPage } = require("../browser");
const config = require("../../config");

async function checkAcf(browser) {
  const results = [];

  for (const expectation of config.acfExpectations) {
    const url = config.siteUrl.replace(/\/$/, "") + expectation.pagePath;
    const { page, context } = await newPage(browser);

    try {
      await page.goto(url, {
        waitUntil: "networkidle",
        timeout: config.pageTimeout,
      });
    } catch (e) {
      for (const check of expectation.checks) {
        results.push({
          page: expectation.pagePath,
          label: expectation.label,
          field: check.field,
          selector: check.selector,
          description: check.description,
          optional: check.optional || false,
          found: false,
          hasContent: false,
          passed: false,
          error: `Page failed to load: ${e.message}`,
        });
      }
      await context.close();
      continue;
    }

    for (const check of expectation.checks) {
      const isOptional = check.optional || false;
      let found = false;
      let hasContent = false;
      let textMatches = null; // null = no expectation set, true/false otherwise
      let actualText = null;
      let error = null;

      try {
        const el = await page.$(check.selector);
        if (el) {
          found = true;
          const rawText = (await el.textContent()) || "";
          actualText = rawText.trim();

          // For images: check src attribute
          if (check.selector.includes("img")) {
            const src = await el.getAttribute("src");
            actualText = src || "";
            hasContent = !!src;
          } else {
            hasContent = actualText.length > 0;
          }

          // If expectedText is set, compare against it
          if (check.expectedText !== undefined) {
            textMatches = actualText.includes(check.expectedText);
          }
        }
      } catch (e) {
        error = e.message;
      }

      // Pass: element found, has content, and text matches (if expected)
      const passed = found && hasContent && (textMatches !== false);

      results.push({
        page: expectation.pagePath,
        label: expectation.label,
        field: check.field,
        selector: check.selector,
        description: check.description,
        optional: isOptional,
        found,
        hasContent,
        expectedText: check.expectedText || null,
        actualText,
        textMatches,
        passed,
        error,
      });
    }

    await context.close();
  }

  return results;
}

module.exports = { checkAcf };
