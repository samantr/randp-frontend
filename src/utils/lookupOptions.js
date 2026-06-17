import { normalizeFaText } from "./normalizeFa";

export function lookupDisplayName(option) {
  if (!option) return "-";
  return (
    option.displayTitle ||
    option.path ||
    option.fullPath ||
    option.title ||
    `#${option.id}`
  );
}

export function lookupMatches(option, q, extraFields = []) {
  const needle = normalizeFaText(q || "");
  if (!needle) return true;

  const extraText = extraFields
    .map((field) => option?.[field])
    .filter((value) => value !== null && value !== undefined)
    .join(" ");

  const haystack = normalizeFaText(
    [
      option?.displayTitle,
      option?.path,
      option?.fullPath,
      option?.title,
      option?.code,
      option?.id,
      extraText,
    ]
      .filter((value) => value !== null && value !== undefined)
      .join(" ")
  );

  return haystack.includes(needle);
}

export function sortLookupOptions(a, b) {
  return lookupDisplayName(a).localeCompare(lookupDisplayName(b), "fa");
}
