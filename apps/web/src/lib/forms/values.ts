const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{0,63}$/;
const DECIMAL_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d{1,6})?$/;

export function requiredText(formData: FormData, field: string, maxLength: number): string | null {
  const value = formData.get(field);
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= maxLength ? normalized : null;
}

export function normalizedCode(value: string): string | null {
  const code = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return CODE_PATTERN.test(code) ? code : null;
}

export function decimalValue(value: string): { type: "decimal"; value: string } | null {
  const normalized = value.trim().replace(",", ".");
  return DECIMAL_PATTERN.test(normalized) ? { type: "decimal", value: normalized } : null;
}
