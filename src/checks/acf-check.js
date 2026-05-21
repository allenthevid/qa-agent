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
      // Page failed to load — mark all checks for this page as failed
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
      let error = null;

      try {
        const el = await page.$(check.selector);
        if (el) {
          found = true;
          const text = (await el.textContent()) || "";
          hasContent = text.trim().length > 0;

          // For images: check src attribute too
          if (check.selector.includes("img") && !hasContent) {
            const src = await el.getAttribute("src");
            hasContent = !!src;
          }

          // For links: check href attribute
          if (check.selector.includes("a") && !hasContent) {
            const href = await el.getAttribute("href");
            hasContent = !!href;
          }
        }
      } catch (e) {
        error = e.message;
      }

      results.push({
        page: expectation.pagePath,
        label: expectation.label,
        field: check.field,
        selector: check.selector,
        description: check.description,
        optional: isOptional,
        found,
        hasContent,
        passed: found && hasContent,
        error,
      });
    }

    await context.close();
  }

  return results;
}

module.exports = { checkAcf };
