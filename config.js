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

  // Timeout per page navigation (ms)
  pageTimeout: 30000,

  // Pages to check for HTTP 200
  pages: [
    { path: "/", label: "Homepage" },
    { path: "/blog", label: "Blog" },
    { path: "/category/uncategorized", label: "Category Archive" },
    { path: "/404-page", label: "404 Page" },
  ],

  // ACF field expectations — what should render on the frontend
  // These match the hero-section and banner block templates
  acfExpectations: [
    // hero-section block (on homepage)
    {
      pagePath: "/",
      label: "Hero Section",
      checks: [
        {
          field: "heading",
          selector: "section.hero-section h1",
          description: "Hero heading should render inside an h1",
        },
        {
          field: "description",
          selector: "section.hero-section p.leading-relaxed",
          description: "Hero description paragraph",
        },
        {
          field: "button_label",
          selector: 'section.hero-section a[class*="bg-"], section.hero-section button',
          description: "CTA button or link",
        },
      ],
    },
    // banner block — if present on homepage
    {
      pagePath: "/",
      label: "Banner Block",
      checks: [
        {
          field: "heading",
          selector: "section.banner .main-title",
          description: "Banner heading via heading.twig component",
          optional: true,
        },
        {
          field: "paragraph",
          selector: "section.banner .description",
          description: "Banner paragraph content",
          optional: true,
        },
      ],
    },
    // Single post page — ACF options fields for post CTA
    {
      pagePath: "/blog",
      label: "Blog Page",
      checks: [
        {
          field: "posts_list",
          selector: ".post-card, article.post, .posts-grid > *",
          description: "Blog listing should show post cards",
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
