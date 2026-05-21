# QA Agent

Automated QA for WordPress sites. Runs a headless browser to check HTTP status codes, ACF field rendering, and browser console errors, then generates an AI-written summary for project managers.

## Quick start

```bash
npm install
npx playwright install chromium
cp .env.example .env   # edit with your site URL and API key
npm run qa
```

## Setup

### 1. Environment variables

Create a `.env` file:

| Variable | Required | Default | Notes |
|---|---|---|---|
| `SITE_URL` | no | `http://ai-demo.local` | The WordPress site to crawl |
| `ANTHROPIC_API_KEY` | no | — | For AI summary (Claude) |
| `DEEPSEEK_API_KEY` | no | — | For AI summary (DeepSeek) |
| `THEME_PATH` | no | — | Path to a WordPress theme for ACF block auto-discovery |

At least one AI key is needed for the AI summary. Without any key, the report is still generated — just without the PM-facing summary.

### 2. Configure checks

Edit `config.js`:

- **`pages`** — URLs to check for valid HTTP responses. Add an `expectedStatus` field (e.g. `404`) to pages that should return a non-200 code.
- **`acfExpectations`** — ACF fields to validate on the frontend. Each entry specifies a page path, the CSS selector to find the element, and optionally an `expectedText` value to compare against the rendered content.
- **`consoleErrorIgnore`** — Patterns to suppress in console error reporting (vendor noise, known false positives).

### 3. Run

```bash
npm run qa          # full run with AI summary
npm run qa:quick    # skip AI summary (faster, works offline)
```

The agent prints a summary to the terminal and saves a full JSON report to `reports/`.

## How it works

**4-step pipeline:**

1. **HTTP checks** — navigates to each configured page and records the HTTP status code
2. **ACF checks** — renders each page, finds elements by CSS selector, and compares text content against expected values. Fields marked `optional: true` are skipped (not failed) when the element isn't present — useful for blocks that may or may not be placed on a page
3. **Console checks** — captures browser console errors during the session, filtering out known noise
4. **AI summary** — the report is sent to an LLM (Claude or DeepSeek) which writes a plain-English summary suitable for a project manager

## ACF expected values

For each ACF field, **the expected value lives in one of three places** (checked in order):

1. The `expectedText` field in `config.js` (manual override)
2. The `default_value` in the block's `acf-field-group.json` (auto-discovered)
3. The `?? 'default'` fallback in the block's `template.twig` (auto-discovered)

Auto-discovery scans `blocks/*/acf-field-group.json` and `blocks/*/template.twig` in the configured theme path and builds checks automatically. Manual entries in `config.js` override discovered ones — use this when you need better CSS selectors or custom expected text.

## Report statuses

| Status | Meaning |
|---|---|
| **PASS** | Element found, content matches expected text (or no expectation set) |
| **WARN** | Element found and renders, but the text differs from `expectedText` — normal after CMS edits |
| **FAIL** | Element not found, or found but empty when content was expected |
| **SKIP** | Optional field whose element is not present on the page |
