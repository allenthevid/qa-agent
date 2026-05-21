const { launch, close } = require("./browser");
const { checkHttp } = require("./checks/http-check");
const { checkAcf } = require("./checks/acf-check");
const { checkConsole } = require("./checks/console-check");
const { buildReport, saveReport, printSummary } = require("./reporter");
const { generateAiSummary } = require("./ai-summary");
const config = require("../config");

async function main() {
  const skipAi = process.argv.includes("--skip-ai");

  console.log(`\nQA Agent starting...`);
  console.log(`Site: ${config.siteUrl}`);
  console.log(`AI summary: ${skipAi ? "skipped" : config.aiProvider || "unavailable (no API key)"}`);
  console.log("");

  // 1. Launch browser
  console.log("[1/4] Launching headless browser...");
  let browser;
  try {
    browser = await launch();
  } catch (e) {
    console.error(`Failed to launch browser: ${e.message}`);
    console.error("Make sure Playwright browsers are installed: npx playwright install chromium");
    process.exit(1);
  }

  // 2. Run checks
  let httpResults = [];
  let acfResults = [];
  let consoleResults = { passed: false, errors: [{ text: "Check did not run" }], warnings: [] };

  try {
    console.log("[2/4] Checking HTTP status codes...");
    httpResults = await checkHttp(browser);

    console.log("[3/4] Checking ACF field rendering...");
    acfResults = await checkAcf(browser);

    console.log("[4/4] Checking console errors...");
    consoleResults = await checkConsole(browser);
  } catch (e) {
    console.error(`Check error: ${e.message}`);
  }

  // 3. Close browser
  await close();

  // 4. Build report
  const report = buildReport(httpResults, acfResults, consoleResults);

  // 5. AI summary
  if (!skipAi) {
    console.log("\nGenerating AI summary for PM...");
    report.aiSummary = await generateAiSummary(report);
  }

  // 6. Output
  const filePath = saveReport(report);
  printSummary(report);
  console.log(`Full report saved to: ${filePath}`);

  // Exit with non-zero if failures
  process.exitCode = report.summary.failed > 0 ? 1 : 0;
}

main();
