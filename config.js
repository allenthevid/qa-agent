require("dotenv").config();

const siteUrl = process.env.SITE_URL || "http://ai-demo.local";

// AI provider — auto-detect from available keys
const aiProvider = process.env.ANTHROPIC_API_KEY
  ? "anthropic"
  : process.env.DEEPSEEK_API_KEY
    ? "deepseek"
    : null;

module.exports = {
  siteUrl,

  aiProvider,

  // Path to the WordPress theme to scan for blocks
  // Discovery reads blocks/*/acf-field-group.json + template.twig to auto-generate
  // ACF expectations. Set to null to disable auto-discovery.
  themePath: process.env.THEME_PATH || null,

  // Timeout per page navigation (ms)
  pageTimeout: 30000,

  // Pages to check for HTTP 200
  pages: [
    { path: "/", label: "Homepage" },
    { path: "/blog/", label: "Blog" },
    { path: "/category/uncategorized/", label: "Category Archive" },
    // Use a garbage URL to verify the 404 template fires correctly
    { path: "/this-page-definitely-does-not-exist-12345/", label: "404 Template", expectedStatus: 404 },
  ],

  // ACF field expectations — what should render on the frontend
  // Each entry maps to a real block template and its fields.
  // SELECTOR TIP: check the actual block template.twig for exact classes.
  // The hero-section block does NOT use class="hero-section" — it uses
  // Tailwind utilities: section class="relative overflow-hidden bg-[#043873]"
  acfExpectations: [
    // banner block — only if placed on homepage
    {
      pagePath: "/",
      label: "Banner Block",
      checks: [
        {
          field: "heading",
          selector: "section.banner .main-title",
          description: "Banner heading via heading.twig",
          optional: true,
        },
        {
          field: "paragraph",
          selector: "section.banner .description",
          description: "Banner paragraph via wysiwyg",
          optional: true,
        },
      ],
    },
    // Blog listing — checks if blog page renders with content
    {
      pagePath: "/blog/",
      label: "Blog Page",
      checks: [
        {
          field: "content_area",
          selector: ".container, main, article, .content",
          description: "Blog page has a content container",
        },
      ],
    },
  ],

  // Known console errors to ignore (vendor noise, expected behavior)
  consoleErrorIgnore: [
    // Common vendor script noise
    "net::ERR",
    "Failed to load resource",
    // AJAX errors when running locally without full content
    "admin-ajax.php",
    // Third-party embeds that may not load locally
    "google-fonts",
    "fonts.googleapis",
  ],

  // If true, console.warn messages also appear in the report (but don't fail)
  reportConsoleWarnings: false,
};
