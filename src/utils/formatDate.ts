/**
 * Standardized date/datetime formatter for all UI display.
 *
 * - If the value contains time (hours, minutes, or seconds ≠ 0):
 *     → MM/DD/YYYY HH:MM:SS AM/PM
 * - If the value is date-only (midnight exactly):
 *     → MM/DD/YYYY
 *
 * Also checks the raw string: if it has no "T" or time-like segment,
 * it is treated as date-only regardless of parsed result.
 *
 * @example
 *   formatStandardDate("2026-03-31T14:45:10Z")  // → "03/31/2026 02:45:10 PM"
 *   formatStandardDate("2026-03-31")             // → "03/31/2026"
 *   formatStandardDate("31.03.2026")             // → "03/31/2026"
 *   formatStandardDate(null)                     // → "-"
 */
export function formatStandardDate(value: string | null | undefined): string {
  if (!value) return "-";

  const raw = value.trim();

  // Determine if the raw string carries time information.
  // Strings like "2026-03-31" or "31.03.2026" are date-only;
  // strings with "T", "Z", or an embedded HH:MM are datetime.
  const rawHasTime =
    raw.includes("T") || raw.includes("Z") || /\d{2}:\d{2}/.test(raw);

  const d = new Date(rawHasTime ? raw : raw + "T00:00:00");
  if (isNaN(d.getTime())) return raw; // unparseable → return as-is

  const hasTime =
    rawHasTime &&
    (d.getHours() !== 0 || d.getMinutes() !== 0 || d.getSeconds() !== 0);

  if (hasTime) {
    return d.toLocaleString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  }

  return d.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}
