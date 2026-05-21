const config = require("../config");

async function generateAiSummary(report) {
  if (!config.aiProvider) {
    return "AI summary unavailable — no API key configured. Set DEEPSEEK_API_KEY or ANTHROPIC_API_KEY in .env.";
  }

  const provider = config.aiProvider;
  const prompt = buildPrompt(report);

  try {
    let text;
    if (provider === "deepseek") {
      text = await callDeepSeek(prompt);
    } else if (provider === "anthropic") {
      text = await callAnthropic(prompt);
    } else {
      throw new Error(`Unknown AI provider: ${provider}`);
    }
    return text.trim();
  } catch (err) {
    return `AI summary generation failed: ${err.message}. Raw results are available in the report JSON.`;
  }
}

function buildPrompt(report) {
  const { summary, http, acf, console: consoleResults } = report;

  const httpSummary = http
    .map((r) => `- ${r.label} (${r.url}): ${r.passed ? "HTTP " + r.status + " OK" : "FAILED — HTTP " + r.status}`)
    .join("\n");

  const acfSummary = acf
    .map((r) => {
      const status = r.optional && !r.found ? "SKIPPED (optional block not present)" : r.passed ? "PASS" : "FAIL";
      return `- ${r.description}: ${status}`;
    })
    .join("\n");

  const consoleErrors = consoleResults.errors.map((e) => `- ${e.text}`).join("\n") || "(none)";

  return `You are a QA engineer writing a status report for a non-technical project manager. Below are the results of automated checks run against a WordPress site.

Write 2-3 paragraphs in plain English that a PM would understand. Do NOT use jargon like "DOM selector," "HTTP status code," or "console.error." Instead, describe what was checked and whether things are healthy or broken.

Rules:
- Lead with the overall health of the site (pass rate: ${summary.passRate})
- Mention any broken pages first (these are critical)
- Then mention content issues (ACF fields not showing)
- Then mention any technical errors found
- End with a clear "bottom line" — should we be confident deploying?
- Keep it concise. No bullet points.

SITE: ${report.siteUrl}
PASS RATE: ${summary.passRate} (${summary.passed} passed, ${summary.failed} failed, ${summary.skipped} skipped out of ${summary.total} checks)

PAGE AVAILABILITY:
${httpSummary}

CONTENT RENDERING:
${acfSummary}

BROWSER ERRORS:
${consoleErrors}

Write the summary now:`;
}

async function callDeepSeek(prompt) {
  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`DeepSeek API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

async function callAnthropic(prompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  return data.content[0].text;
}

module.exports = { generateAiSummary };
