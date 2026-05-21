const fs = require("fs");
const path = require("path");

/**
 * Scans a theme's blocks/ directory and extracts ACF field definitions
 * and expected values from acf-field-group.json and template.twig.
 *
 * Returns an array of acfExpectations suitable for the QA config.
 */
function discoverBlocks(themePath) {
  const blocksDir = path.join(themePath, "blocks");
  if (!fs.existsSync(blocksDir)) {
    console.log(`  No blocks/ directory found at ${blocksDir}`);
    return [];
  }

  const expectations = [];

  for (const dir of fs.readdirSync(blocksDir)) {
    const blockPath = path.join(blocksDir, dir);
    if (!fs.statSync(blockPath).isDirectory()) continue;

    const acfJsonPath = path.join(blockPath, "acf-field-group.json");
    const twigPath = path.join(blockPath, "template.twig");

    if (!fs.existsSync(acfJsonPath)) {
      console.log(`  Skipping ${dir} — no acf-field-group.json`);
      continue;
    }

    const acfJson = JSON.parse(fs.readFileSync(acfJsonPath, "utf8"));
    const twigSource = fs.existsSync(twigPath) ? fs.readFileSync(twigPath, "utf8") : "";

    const fields = extractFields(acfJson);
    const checks = fields
      .filter((f) => !["link", "image"].includes(f.type)) // skip link/image for text checks
      .map((f) => {
        const twigDefault = extractTwigDefault(twigSource, f.name);
        const expectedText = f.defaultValue || twigDefault || undefined;
        const selector = inferSelector(twigSource, f.name, f.type);

        return {
          field: f.name,
          selector,
          description: `Block "${dir}" — ${f.label || f.name}`,
          ...(expectedText ? { expectedText } : {}),
        };
      });

    if (checks.length) {
      expectations.push({
        pagePath: "/",
        label: `Block: ${dir}`,
        blockDir: dir,
        checks,
      });
    }
  }

  return expectations;
}

/**
 * Extract flat field list from ACF field group JSON.
 * Handles the nested "group" wrapper field → sub_fields pattern.
 */
function extractFields(acfJson) {
  const fields = [];
  if (!acfJson.fields) return fields;

  for (const field of acfJson.fields) {
    // Group field wrapping sub_fields (standard block pattern)
    if (field.type === "group" && field.sub_fields) {
      for (const sub of field.sub_fields) {
        fields.push({
          name: sub.name,
          label: sub.label || sub.name,
          type: sub.type || "text",
          defaultValue: sub.default_value || "",
        });
      }
    } else {
      fields.push({
        name: field.name,
        label: field.label || field.name,
        type: field.type || "text",
        defaultValue: field.default_value || "",
      });
    }
  }

  return fields;
}

/**
 * Extract the fallback default from a Twig `?? 'default'` pattern.
 * Looks for: fields.NAME ?? '...' or fields.NAME ?? "..."
 */
function extractTwigDefault(twigSource, fieldName) {
  // Match: fields.FIELD_NAME ?? 'default value'
  const pattern = new RegExp(
    `fields\\.${escapeRegex(fieldName)}\\s*\\?\\?\\s*['\"]([^'\"]+)['\"]`
  );
  const match = twigSource.match(pattern);
  return match ? match[1] : null;
}

/**
 * Infer a CSS selector for a field by finding the nearest wrapping HTML
 * element in the template that contains the fields.FIELD reference.
 */
function inferSelector(twigSource, fieldName, fieldType) {
  const escaped = escapeRegex(fieldName);

  // For text fields, find the HTML element wrapping the field reference
  // Look for patterns like: <tag class="..." ...>{{ heading }}</tag>
  // or: <tag class="..." ...>{{ fields.heading }}</tag>
  const textPattern = new RegExp(
    `<(\\w+)([^>]*class="([^"]*)"[^>]*)>[^<]*\\{\\{\\s*(?:fields\\.)?${escaped}(?:\\|[^}]*)?\\s*\\}\\}`,
    "s"
  );
  const textMatch = twigSource.match(textPattern);
  if (textMatch) {
    const tag = textMatch[1];
    const classes = textMatch[3] || "";
    // Pick the most specific identifying class
    const keyClass = pickKeyClass(classes);
    if (tag === "h1" && keyClass) return `h1.${keyClass}`;
    if (tag === "p" && keyClass) return `p.${keyClass}`;
    if (keyClass) return `${tag}.${keyClass}`;
    return tag;
  }

  // Fallback: look for any element containing the field reference
  const loosePattern = new RegExp(
    `<(\\w+)([^>]*)>[^<]*\\{\\{\\s*(?:fields\\.)?${escaped}(?:\\|[^}]*)?\\s*\\}\\}`,
    "s"
  );
  const looseMatch = twigSource.match(loosePattern);
  if (looseMatch) {
    const tag = looseMatch[1];
    const attrs = looseMatch[2] || "";
    const classMatch = attrs.match(/class="([^"]*)"/);
    const keyClass = classMatch ? pickKeyClass(classMatch[1]) : null;
    if (keyClass) return `${tag}.${keyClass}`;
    return tag;
  }

  // Last resort: search for field name as a class
  if (fieldType === "image") return "img";
  return `[data-field="${fieldName}"]`;
}

/**
 * Pick the most identifying class from a class string.
 * Favors unique-looking classes over generic Tailwind ones.
 */
function pickKeyClass(classString) {
  const classes = classString.split(/\s+/).filter(Boolean);
  // Skip purely utility classes (Tailwind-style with [], generic ones)
  const meaningful = classes.filter(
    (c) =>
      !c.startsWith("w-") &&
      !c.startsWith("h-") &&
      !c.startsWith("max-w-") &&
      !c.startsWith("max-h-") &&
      !c.startsWith("px-") &&
      !c.startsWith("py-") &&
      !c.startsWith("pt-") &&
      !c.startsWith("pb-") &&
      !c.startsWith("pl-") &&
      !c.startsWith("pr-") &&
      !c.startsWith("mt-") &&
      !c.startsWith("mb-") &&
      !c.startsWith("ml-") &&
      !c.startsWith("mr-") &&
      !c.startsWith("gap-") &&
      !c.startsWith("flex") &&
      !c.startsWith("inline-") &&
      !c.startsWith("items-") &&
      !c.startsWith("justify-") &&
      !c.startsWith("leading-") &&
      !c.startsWith("tracking-") &&
      !c.startsWith("rounded-") &&
      !c.startsWith("transition-") &&
      !c.startsWith("hover:") &&
      !c.startsWith("opacity-") &&
      !c.startsWith("relative") &&
      !c.startsWith("absolute") &&
      !c.startsWith("z-") &&
      !c.startsWith("container") &&
      !c.startsWith("mx-") &&
      !c.startsWith("object-") &&
      c !== "no-underline" &&
      c !== "pointer-events-none"
  );
  return meaningful[0] || classes[0] || null;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = { discoverBlocks, extractFields, extractTwigDefault, inferSelector };
