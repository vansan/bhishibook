/**
 * Platform-level branding constants.
 *
 * This file used to also hold hardcoded demo statistics that the dashboards
 * silently fell back to whenever a database query failed. Those are gone: the
 * dashboards now read real figures and fail loudly if they cannot.
 */
export const platform = {
  name: "BhishiBook",
  tagline: "Shared savings, honestly tracked",
  defaultGroupName: "MaitriNidhi",
};

export const highlights = [
  "Every group gets its own name, language, members, and cycle rules",
  "Monthly hafta tracked with automatic per-day fines after the due date",
  "Loans at a flat monthly interest rate with a 2x corpus borrowing limit",
  "Every rupee posted to a ledger that is corrected by reversal, never deleted",
  "Share-based final distribution that borrowers take part in too",
];
