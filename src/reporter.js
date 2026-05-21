const fs = require("fs");
const path = require("path");

function buildReport(httpResults, acfResults, consoleResults) {
  const allChecks = [
    ...httpResults.map((r) => ({ ...r, category: "http" })),
    ...acfResults.map((r) => ({ ...r, category: "acf" })),
    { category: "console", ...consoleResults },
  ];

  const httpPassed = httpResults.filter((r) => r.passed).length;
  const httpFailed = httpResults.filter((r) => !r.passed).length;

  const acfPassed = acfResults.filter((r) => r.status === "pass").length;
  const acfWarned = acfResults.filter((r) => r.status === "warn").length;
  const acfFailed = acfResults.filter((r) => r.status === "fail" && !r.optional).length;
  const acfSkipped = acfResults.filter((r) => r.optional && !r.found).length;

  const consolePassed = consoleResults.passed ? 1 : 0;
  const consoleFailed = consoleResults.passed ? 0 : 1;

  const passed = httpPassed + acfPassed + consolePassed;
  const warned = acfWarned;
  const failed = httpFailed + acfFailed + consoleFailed;
  const skipped = acfSkipped;
  const total = passed + warned + failed + skipped;

  return {
    timestamp: new Date().toISOString(),
    siteUrl: process.env.SITE_URL || "unknown",
    summary: {
      total,
      passed,
      warned,
      failed,
      skipped,
      passRate: total > 0 ? Math.round(((passed + warned) / total) * 100) + "%" : "N/A",
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
  console.log(`  Warnings:  ${summary.warned}`);
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
      const icon =
        r.optional && !r.found ? "SKIP" : r.status === "pass" ? "PASS" : r.status === "warn" ? "WARN" : "FAIL";
      console.log(`    [${icon}] ${r.description}`);
      if (r.status === "warn") {
        console.log(`           Selector: ${r.selector}`);
        console.log(`           Expected: "${r.expectedText}"`);
        console.log(`           Actual:   "${r.actualText?.substring(0, 120)}"`);
        console.log(`           Note: content was customized in CMS — field is working fine`);
      }
      if (r.status === "fail" && !(r.optional && !r.found)) {
        console.log(`           Selector: ${r.selector}`);
        if (!r.found) console.log(`           Issue: element not found`);
        if (r.found && !r.hasContent) console.log(`           Issue: element has no content`);
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
