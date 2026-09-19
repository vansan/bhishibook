/**
 * Member helpers for localization, roles, and formatting.
 */

export function formatMemberName(
  member: { displayName: string; displayNameMr?: string | null },
  locale?: string
): string {
  if (locale === "mr" && member.displayNameMr) {
    return member.displayNameMr;
  }
  return member.displayName;
}

/**
 * Standardize Indian 10-digit or international phone numbers for clean display.
 */
export function formatPhoneNumber(rawPhone?: string | null): string {
  if (!rawPhone) return "";
  const cleaned = rawPhone.trim();

  // If already formatted nicely e.g. +91 82080 59375 or +971 52 662 1431, return it
  if (cleaned.includes(" ")) return cleaned;

  // If 10 digits e.g. 8208059375 -> +91 82080 59375
  if (/^\d{10}$/.test(cleaned)) {
    return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
  }

  // If +918208059375 -> +91 82080 59375
  if (/^\+91\d{10}$/.test(cleaned)) {
    const digits = cleaned.slice(3);
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }

  return cleaned;
}
