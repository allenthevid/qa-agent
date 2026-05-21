const fs = require("fs");
const path = require("path");

function buildReport(httpResults, acfResults, consoleResults) {
  const allChecks = [
    ...httpResults.map((r) => ({ ...r, category: "http" })),
    ...acfResults.map((r) => ({ ...r, category: "acf" })),
    { category: "console", ...consoleResults },
  ];

  const passed =
    httpResults.filter((r) => r.passed).length +
    acfResults.filter((r) => r.passed).length +
    (consoleResults.passed ? 1 : 0);

  const total =
    httpResults.length +
    acfResults.filter((r) => !r.optional).length +
    1; // console check always counts

  let failed = total - passed;
  const skipped = acfResults.filter((r) => r.optional && !r.found).length;

  return {
    timestamp: new Date().toISOString(),
    siteUrl: process.env.SITE_URL || "unknown",
    summary: {
      total,
      passed,
      failed,
      skipped,
      passRate: total > 0 ? Math.round((passed / total) * 100) + "%" : "N/A",
    },
    http: httpResults,
    acf: acfResults,
    console: consoleResults,
    aiSummary: null,
  };
}

function saveReport(report) {
  const dir = path.join(__dirname, "..", "reports");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const ts = report.timestamp.replace(/[:.]/g, "-");
  const filePath = path.join(dir, `qa-${ts}.json`);
  fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
  return filePath;
}

function printSummary(report) {
  const { summary } = report;
  console.log("\n" + "=".repeat(60));
  console.log("  QA Report");
  console.log("=".repeat(60));
  console.log(`  Site:      ${report.siteUrl}`);
  console.log(`  Date:      ${report.timestamp}`);
  console.log(`  Pass rate: ${summary.passRate}`);
  console.log(`  Passed:    ${summary.passed}`);
  console.log(`  Failed:    ${summary.failed}`);
  console.log(`  Skipped:   ${summary.skipped}`);
  console.log(`  Total:     ${summary.total}`);
  console.log("-".repeat(60));

  if (report.http.length) {
    console.log("\n  HTTP Status Checks:");
    report.http.forEach((r) => {
      const icon = r.passed ? "PASS" : "FAIL";
      console.log(`    [${icon}] ${r.label} — ${r.status} (${r.url})`);
    });
  }

  if (report.acf.length) {
    console.log("\n  ACF Field Checks:");
    report.acf.forEach((r) => {
      const icon = r.optional && !r.found ? "SKIP" : r.passed ? "PASS" : "FAIL";
      console.log(`    [${icon}] ${r.description}`);
      if (!r.passed && !(r.optional && !r.found)) {
        console.log(`           Selector: ${r.selector}`);
        if (!r.found) console.log(`           Issue: element not found`);
        if (r.found && !r.hasContent) console.log(`           Issue: element has no content`);
        if (r.found && r.textMatches === false && r.expectedText) {
          console.log(`           Expected: "${r.expectedText}"`);
          console.log(`           Actual:   "${r.actualText?.substring(0, 120)}"`);
        }
      }
    });
  }

  console.log(`\n  Console Errors: ${report.console.passed ? "PASS" : "FAIL"}`);
  if (report.console.errors.length) {
    report.console.errors.forEach((e) => {
      console.log(`    - ${e.text}`);
    });
  }

  if (report.aiSummary) {
    console.log("\n" + "-".repeat(60));
    console.log("  PM Summary (AI-generated):");
    console.log("  " + report.aiSummary.replace(/\n/g, "\n  "));
  }

  console.log("\n" + "=".repeat(60) + "\n");
}

module.exports = { buildReport, saveReport, printSummary };
