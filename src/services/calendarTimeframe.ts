// ── Calendar Timeframe Utility ──────────────────────────────────────────────
//
// Pure functions for:
//   1. Computing month-boundary date ranges for the API
//   2. Deadline severity classification
//   3. Normalizing the API response into a date-keyed lookup map
//
// Design decisions:
//   - All date arithmetic uses integer-only ISO string parsing (split on "-")
//     to avoid timezone drift from `new Date()` parsing
//   - Severity is calculated deterministically from the API's `today` field,
//     not from the browser clock, ensuring server/client consistency
//   - The normalized map is keyed by ISO date string for O(1) cell lookups

// ── Types ──────────────────────────────────────────────────────────────────────

export interface MonthTimeframe {
  /** First day of the month (YYYY-MM-01) */
  startDate: string;
  /** Last day of the month (YYYY-MM-lastDay) */
  endDate: string;
}

export interface ViewMonth {
  year: number;
  /** 0-indexed month (0 = January, 11 = December) */
  month: number;
}

export type DeadlineSeverity = "critical" | "warning" | "future" | "past";

export interface CalendarDeadlineItem {
  fileName: string;
  sectionTitle: string | null;
  dateParsed: string;
  dateRaw: string | null;
  description: string | null;
  documentDescription: string | null;
  severity: DeadlineSeverity;
}

export interface CalendarDayData {
  date: string;
  count: number;
  documentsAffected: string[];
  items: CalendarDeadlineItem[];
}

/** Date-keyed lookup: "2026-03-15" → CalendarDayData */
export type CalendarDeadlineMap = Record<string, CalendarDayData>;

// ── API Response Types ─────────────────────────────────────────────────────────

export interface ApiCalendarItem {
  file_name: string;
  section_title: string | null;
  date_parsed: string;
  date_raw: string | null;
  description: string | null;
  document_description: string | null;
}

export interface ApiCalendarEntry {
  date: string;
  count: number;
  documents_affected: string[];
  items: ApiCalendarItem[];
}

export interface ApiTimeframeResponse {
  ok: boolean;
  generated_at: string;
  today: string;
  window_start: string;
  window_end: string;
  total_in_window: number;
  calendar: ApiCalendarEntry[];
}

// ── Date Formatting ────────────────────────────────────────────────────────────

/**
 * Format a Date object as YYYY-MM-DD using local time (no timezone shift).
 */
export function formatDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ── Month Timeframe ────────────────────────────────────────────────────────────

/**
 * Get the number of days in a given month, correctly handling leap years.
 */
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Compute the month-boundary timeframe for the active calendar month.
 *
 * @example
 *   getMonthTimeframe({ year: 2026, month: 2 })
 *   // → { startDate: "2026-03-01", endDate: "2026-03-31" }
 *
 *   getMonthTimeframe({ year: 2024, month: 1 })
 *   // → { startDate: "2024-02-01", endDate: "2024-02-29" }  // leap year
 */
export function getMonthTimeframe(viewMonth: ViewMonth): MonthTimeframe {
  const { year, month } = viewMonth;
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month, getDaysInMonth(year, month));
  return {
    startDate: formatDateISO(firstDay),
    endDate: formatDateISO(lastDay),
  };
}

/**
 * Build the full API URL with start_date and end_date query parameters.
 */
export function buildTimeframeUrl(
  baseUrl: string,
  timeframe: MonthTimeframe
): string {
  const url = new URL(baseUrl);
  url.searchParams.set("start_date", timeframe.startDate);
  url.searchParams.set("end_date", timeframe.endDate);
  return url.toString();
}

/**
 * Compare two timeframes for equality (used to skip redundant fetches).
 */
export function timeframesEqual(
  a: MonthTimeframe | null,
  b: MonthTimeframe | null
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.startDate === b.startDate && a.endDate === b.endDate;
}

// ── Severity Calculation ───────────────────────────────────────────────────────

const MS_PER_DAY = 86_400_000;

/**
 * Compute the number of calendar days between two ISO date strings.
 * Positive = deadline is in the future. Negative = overdue.
 *
 * Uses integer parsing (no `new Date(string)`) to avoid timezone drift.
 */
export function getDaysUntilDeadline(
  deadlineDateISO: string,
  todayISO: string
): number {
  const [dy, dm, dd] = deadlineDateISO.split("-").map(Number);
  const [ty, tm, td] = todayISO.split("-").map(Number);
  const deadlineMs = Date.UTC(dy, dm - 1, dd);
  const todayMs = Date.UTC(ty, tm - 1, td);
  return Math.round((deadlineMs - todayMs) / MS_PER_DAY);
}

/**
 * Classify a deadline's severity based on how many days until it's due.
 *
 * Rules:
 *   past     → deadline date < today (negative days)
 *   critical → 0–2 days remaining (red)
 *   warning  → 2–10 days remaining (amber)
 *   future   → > 10 days remaining (blue)
 */
export function getDeadlineSeverity(
  deadlineDateISO: string,
  todayISO: string
): DeadlineSeverity {
  const days = getDaysUntilDeadline(deadlineDateISO, todayISO);
  if (days < 0) return "past";
  if (days < 2) return "critical";
  if (days <= 10) return "warning";
  return "future";
}

// ── Response Normalization ─────────────────────────────────────────────────────

/**
 * Transform the raw API calendar entries into a date-keyed lookup map.
 * Each item gets a pre-computed severity based on the API's `today` value.
 */
export function normalizeCalendarResponse(
  calendarEntries: ApiCalendarEntry[],
  todayISO: string
): CalendarDeadlineMap {
  const map: CalendarDeadlineMap = {};

  for (const entry of calendarEntries) {
    const dateKey = entry.date;

    const items: CalendarDeadlineItem[] = entry.items.map((item) => ({
      fileName: item.file_name,
      sectionTitle: item.section_title,
      dateParsed: item.date_parsed,
      dateRaw: item.date_raw,
      description: item.description,
      documentDescription: item.document_description,
      severity: getDeadlineSeverity(item.date_parsed || dateKey, todayISO),
    }));

    map[dateKey] = {
      date: dateKey,
      count: entry.count,
      documentsAffected: entry.documents_affected,
      items,
    };
  }

  return map;
}
