/** URL slug ↔ Supabase / app branch label */
export const STORE_CONFIG = [
  { slug: "hillcrest", label: "Hillcrest" },
  { slug: "hammersdale", label: "Hammersdale" },
  { slug: "gillitts", label: "Gillitts" },
  { slug: "cato-ridge", label: "Cato Ridge" },
];

const SLUG_SET = new Set(STORE_CONFIG.map((s) => s.slug));

export function isValidStoreSlug(slug) {
  return typeof slug === "string" && SLUG_SET.has(slug);
}

export function slugToLabel(slug) {
  const row = STORE_CONFIG.find((s) => s.slug === slug);
  return row ? row.label : "Hillcrest";
}

export function labelToSlug(label) {
  const row = STORE_CONFIG.find((s) => s.label === label);
  return row ? row.slug : "hillcrest";
}

/** Query string fragment for `?store=` from branch label. */
export function storeQueryFromLabel(label) {
  return `store=${encodeURIComponent(label)}`;
}
