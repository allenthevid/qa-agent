const { launch, close } = require("./browser");
const { checkHttp } = require("./checks/http-check");
const { checkAcf } = require("./checks/acf-check");
const { checkConsole } = require("./checks/console-check");
const { buildReport, saveReport, printSummary } = require("./reporter");
const { generateAiSummary } = require("./ai-summary");
const { discoverBlocks } = require("./discovery");
const config = require("../config");

async function main() {
  const skipAi = process.argv.includes("--skip-ai");

  console.log(`\nQA Agent starting...`);
  console.log(`Site: ${config.siteUrl}`);
  console.log(`AI summary: ${skipAi ? "skipped" : config.aiProvider || "unavailable (no API key)"}`);
  console.log("");

  // 0. Discover blocks if themePath is set
  const discoveredExpectations = [];
  if (config.themePath) {
    console.log("[0/4] Discovering blocks from theme...");
    const discovered = discoverBlocks(config.themePath);
    discoveredExpectations.push(...discovered);
    if (discovered.length) {
      console.log(`  Found ${discovered.length} block(s) with ACF fields`);
    }
  }

  // Merge discovered expectations with manual overrides from config.
  // Manual entries take precedence for the same block label + field.
  const manualExpectations = config.acfExpectations || [];
  const mergedExpectations = mergeExpectations(discoveredExpectations, manualExpectations);
  config.acfExpectations = mergedExpectations;

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

/**
 * Merge auto-discovered expectations with manual config entries.
 *
 * A manual entry with `blockDir: "hero-section"` overrides the discovered
 * block for that directory. Checks are matched by field name — manual
 * checks replace discovered ones with the same field name.
 */
function mergeExpectations(discovered, manual) {
  const blocks = new Map(); // key = blockDir

  // Add discovered blocks first
  for (const entry of discovered) {
    const dir = entry.blockDir;
    if (!blocks.has(dir)) blocks.set(dir, []);
    blocks.get(dir).push({ source: "discovered", ...entry });
  }

  // Merge manual entries — same blockDir overrides discovered fields
  for (const manualEntry of manual) {
    const dir = manualEntry.blockDir || manualEntry.label;
    if (!blocks.has(dir)) blocks.set(dir, []);
    const existing = blocks.get(dir);

    // If this is a blockDir match on a discovered block, merge checks
    const discoveredBlock = existing.find(
      (e) => e.source === "discovered" && e.blockDir === manualEntry.blockDir
    );
    if (discoveredBlock) {
      // Replace discovered checks with manual ones (by field name)
      const manualFieldNames = manualEntry.checks.map((c) => c.field);
      discoveredBlock.checks = [
        ...discoveredBlock.checks.filter((c) => !manualFieldNames.includes(c.field)),
        ...manualEntry.checks,
      ];
      discoveredBlock.pagePath = manualEntry.pagePath || discoveredBlock.pagePath;
      discoveredBlock.label = manualEntry.label || discoveredBlock.label;
    } else {
      blocks.get(dir).push({ source: "manual", ...manualEntry });
    }
  }

  // Flatten
  const result = [];
  for (const entries of blocks.values()) {
    for (const entry of entries) {
      if (entry.checks && entry.checks.length) {
        result.push(entry);
      }
    }
  }
  return result;
}

main();
