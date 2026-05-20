import { isValidStoreSlug, labelToSlug, slugToLabel } from "./stores";

export const STORE_LABELS = ["Hillcrest", "Hammersdale", "Gillitts", "Cato Ridge"];

export function storeLabelFromRoute(storeSlug, searchParams) {
  const queryStore = searchParams?.get?.("store");
  if (STORE_LABELS.includes(queryStore)) return queryStore;
  if (storeSlug && isValidStoreSlug(storeSlug)) return slugToLabel(storeSlug);
  return "Hillcrest";
}

export function storeSlugFromRoute(storeSlug, searchParams) {
  const label = storeLabelFromRoute(storeSlug, searchParams);
  return labelToSlug(label);
}

export function backHrefFromReturn(searchParams, fallbackHref) {
  const raw = searchParams?.get?.("return");
  if (!raw) return fallbackHref;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
