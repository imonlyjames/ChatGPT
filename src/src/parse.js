// Customer-name parser (names only). Exported for reuse/tests.

export const DEMO_MANIFEST = `500 12345 POKE ONE
Wismettac Asian Foods
700 KYOKO SUSHI BAR
1st Break
900 PACIFIC SUPERMARKET (HAYWARD)`;

const SKIP_WORDS = [
  "break","meal","wismettac","delivery manifest","route","driver",
  "begin","end","time","arrived","departed","dry","chill","frozen",
  "case","each","total","shipping","page"
];

// 'contains' = skip if word appears anywhere in the line (default)
// 'standalone' = skip only if the whole line is just the word (optionally with digits, e.g., "PAGE 1")
export function parseCustomerNames(raw, { skipMode = "contains" } = {}) {
  const lines = String(raw || "")
    .split(/\r?\n/)
    .map(s => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const words = SKIP_WORDS.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");

  const skipContains = new RegExp(`\\b(?:${words})\\b`, "i");
  const skipStandalone = new RegExp(`^(?:${words})(?:\\s*\\d+)?$`, "i");
  const shouldSkip = (ln) => skipMode === "standalone" ? skipStandalone.test(ln) : skipContains.test(ln);

  const out = [];
  const seen = new Set();

  for (let ln of lines) {
    if (shouldSkip(ln)) continue;

    // strip times, codes, leading numbers, brackets, trailing columns
    let name = ln
      .replace(/^[\s\-–—]*\d{1,2}:?\d{0,2}\s*/, "")
      .replace(/^(?:\d{3,}|[A-Z]{2,}\d+)[\s,\/\-]+/, "")
      .replace(/^(?:\d+[\s,\-\/]+){1,4}/, "")
      .replace(/\[[^\]]*\]/g, "")
      .replace(/\s{2,}.+$/, "")
      .trim();

    if (!/[A-Za-z]/.test(name)) continue;

    const letters = (name.match(/[A-Za-z]/g) || []).length;
    const words2 = (name.match(/[A-Za-z]{2,}/g) || []).length;
    const bad = (name.match(/[^A-Za-z0-9 ()&'./-]/g) || []).length;
    const symRatio = bad / Math.max(1, name.length);

    if (letters < 5 || words2 < 2 || symRatio > 0.15) continue;

    const key = name.toLowerCase().replace(/[()]/g, "").replace(/\b(inc|llc|co|corp|inc\.|co\.)\b/gi, "").replace(/[^a-z0-9\s]/gi, " ").replace(/\s+/g, " ").trim();
    if (seen.has(key)) continue;
    seen.add(key);

    out.push(name);
  }
  return out;
}

// --- Tiny test harness (runs in browser console) ---
export function runParserTests() {
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  let ok = true;

  // Basic
  const expected = ["POKE ONE", "KYOKO SUSHI BAR", "PACIFIC SUPERMARKET (HAYWARD)"];
  const got = parseCustomerNames(DEMO_MANIFEST);
  if (!eq(got, expected)) { ok = false; console.warn("TEST basic FAILED", { got, expected }); }

  // Skip keywords (contains)
  const skipCase = `BREAK
DRY
EACH
SHIPPING
PAGE 1
AMICI SUSHI`;
  const got2 = parseCustomerNames(skipCase, { skipMode: "contains" });
  if (!eq(got2, ["AMICI SUSHI"])) { ok = false; console.warn("TEST skip-contains FAILED", got2); }

  // Skip keywords (standalone)
  const skipCase2 = `PAGE 1
time window 9-10am
AMICI SUSHI`;
  const got3 = parseCustomerNames(skipCase2, { skipMode: "standalone" });
  if (!eq(got3, ["time window 9-10am", "AMICI SUSHI"])) { ok = false; console.warn("TEST skip-standalone FAILED", got3); }

  // Dedup
  const dupCase = `Amici Sushi
AMICI SUSHI`;
  const got4 = parseCustomerNames(dupCase);
  if (!eq(got4, ["Amici Sushi"])) { ok = false; console.warn("TEST dedup FAILED", got4); }

  console.log(ok ? "Parser tests: ALL PASS ✅" : "Parser tests: issues above ⚠️");
}
