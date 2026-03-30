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

export type ReminderType = "critical" | "warning" | "future";

export interface CalendarDeadlineItem {
  fileName: string;
  sectionTitle: string | null;
  dateParsed: string;
  dateRaw: string | null;
  description: string | null;
  documentDescription: string | null;
  severity: DeadlineSeverity;
  /** If this item was generated as a deadline reminder, indicates its type */
  reminderType?: ReminderType;
  /** The original deadline date this reminder was derived from */
  originalDeadlineDate?: string;
  /** Display label for the reminder */
  reminderLabel?: string;
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

// ── Expanded Timeframe Range ──────────────────────────────────────────────────

/**
 * Compute the calendar timeframe for API fetching.
 *
 * Returns:
 *   - start_date = 1st of the current month
 *   - end_date   = last day of the month 2 months after the current month
 *
 * @example
 *   getCalendarTimeframeRange({ year: 2026, month: 2 }) // March 2026
 *   // → { startDate: "2026-03-01", endDate: "2026-05-31" }
 *
 *   getCalendarTimeframeRange({ year: 2026, month: 11 }) // December 2026
 *   // → { startDate: "2026-12-01", endDate: "2027-02-28" }
 *
 *   getCalendarTimeframeRange({ year: 2028, month: 11 }) // December 2028
 *   // → { startDate: "2028-12-01", endDate: "2029-02-28" }
 *
 *   getCalendarTimeframeRange({ year: 2028, month: 0 }) // January 2028
 *   // → { startDate: "2028-01-01", endDate: "2028-03-31" }
 */
export function getCalendarTimeframeRange(viewMonth: ViewMonth): MonthTimeframe {
  const { year, month } = viewMonth;

  // Current month: 1st day
  const startDate = formatDateISO(new Date(year, month, 1));

  // Month + 2: last day (handles year rollover and leap years)
  let targetYear = year;
  let targetMonth = month + 2;
  if (targetMonth > 11) {
    targetYear += Math.floor(targetMonth / 12);
    targetMonth = targetMonth % 12;
  }
  const endDate = formatDateISO(
    new Date(targetYear, targetMonth, getDaysInMonth(targetYear, targetMonth))
  );

  return { startDate, endDate };
}

// ── Deadline Reminder Generation ─────────────────────────────────────────────

/**
 * Color mapping for reminder types (used by UI for styling).
 */
export const REMINDER_COLORS: Record<ReminderType, string> = {
  critical: "red",
  warning: "yellow",
  future: "blue",
};

/**
 * Reminder configuration: type → { daysBeforeDeadline, label, severity }.
 */
const REMINDER_CONFIG: {
  type: ReminderType;
  daysBefore: number;
  label: string;
  severity: DeadlineSeverity;
}[] = [
  { type: "critical", daysBefore: 0,  label: "Critical reminder", severity: "critical" },
  { type: "warning",  daysBefore: 7,  label: "Warning reminder",  severity: "warning"  },
  { type: "future",   daysBefore: 30, label: "Future reminder",   severity: "future"   },
];

/**
 * Subtract a number of days from an ISO date string, returning a new ISO string.
 * Uses UTC arithmetic to avoid timezone drift. Does NOT mutate any Date objects.
 */
function subtractDaysISO(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  // Create a new Date for the subtracted value (no mutation)
  const result = new Date(utc.getTime() - days * MS_PER_DAY);
  const ry = result.getUTCFullYear();
  const rm = String(result.getUTCMonth() + 1).padStart(2, "0");
  const rd = String(result.getUTCDate()).padStart(2, "0");
  return `${ry}-${rm}-${rd}`;
}

/**
 * Generate 3 deadline reminder events for a single deadline item.
 *
 * For each deadline, produces:
 *   1. Critical reminder — on the exact deadline date (RED)
 *   2. Warning reminder  — 7 days before the deadline (YELLOW)
 *   3. Future reminder   — 30 days before the deadline (BLUE)
 *
 * Returns an array of { dateKey, item } tuples, where dateKey is the
 * calendar date where the reminder should be placed.
 *
 * Design: original data is never mutated — each reminder is a fresh object.
 *
 * Edge case behavior: reminders whose dates fall in the past are still
 * generated. The caller (or the calendar grid) decides whether to display them.
 * This keeps the function pure and predictable.
 */
export function generateDeadlineReminders(
  item: CalendarDeadlineItem,
  deadlineDateKey: string
): { dateKey: string; item: CalendarDeadlineItem }[] {
  // Guard: skip if the deadline date is invalid
  if (!deadlineDateKey || deadlineDateKey.split("-").length !== 3) {
    return [];
  }

  return REMINDER_CONFIG.map(({ type, daysBefore, label, severity }) => {
    const reminderDate = subtractDaysISO(deadlineDateKey, daysBefore);

    return {
      dateKey: reminderDate,
      item: {
        // Spread creates a fresh copy — no mutation of the original
        ...item,
        dateParsed: reminderDate,
        severity,
        reminderType: type,
        originalDeadlineDate: deadlineDateKey,
        reminderLabel: label,
      },
    };
  });
}

// ── Response Normalization ─────────────────────────────────────────────────────

/**
 * Helper to add a reminder item into the deadline map at the given dateKey.
 * Creates the CalendarDayData entry if it doesn't exist; appends otherwise.
 * Deduplicates by checking (fileName + reminderType + originalDeadlineDate).
 */
function addReminderToMap(
  map: CalendarDeadlineMap,
  dateKey: string,
  item: CalendarDeadlineItem
): void {
  if (!map[dateKey]) {
    map[dateKey] = {
      date: dateKey,
      count: 0,
      documentsAffected: [],
      items: [],
    };
  }

  const entry = map[dateKey];

  // Deduplicate: skip if an identical reminder already exists
  const isDuplicate = entry.items.some(
    (existing) =>
      existing.fileName === item.fileName &&
      existing.reminderType === item.reminderType &&
      existing.originalDeadlineDate === item.originalDeadlineDate
  );
  if (isDuplicate) return;

  entry.items.push(item);
  entry.count = entry.items.length;

  // Update documentsAffected (unique file names)
  if (!entry.documentsAffected.includes(item.fileName)) {
    entry.documentsAffected.push(item.fileName);
  }
}

/**
 * Transform the raw API calendar entries into a date-keyed lookup map.
 *
 * For each deadline item, generates 3 reminder events:
 *   - Critical reminder (on the deadline date, RED)
 *   - Warning reminder  (7 days before, YELLOW)
 *   - Future reminder   (30 days before, BLUE)
 *
 * Reminders are placed in the map at their calculated dates.
 * Original data is never mutated — all items are fresh copies.
 * Duplicate reminders are skipped if the function runs multiple times.
 */
export function normalizeCalendarResponse(
  calendarEntries: ApiCalendarEntry[],
  todayISO: string
): CalendarDeadlineMap {
  const map: CalendarDeadlineMap = {};

  for (const entry of calendarEntries) {
    const deadlineDateKey = entry.date;

    // Create base items from the API response
    const baseItems: CalendarDeadlineItem[] = entry.items.map((item) => ({
      fileName: item.file_name,
      sectionTitle: item.section_title,
      dateParsed: item.date_parsed,
      dateRaw: item.date_raw,
      description: item.description,
      documentDescription: item.document_description,
      severity: getDeadlineSeverity(item.date_parsed || deadlineDateKey, todayISO),
    }));

    // For each base item, generate 3 reminder events at their respective dates
    for (const baseItem of baseItems) {
      const reminders = generateDeadlineReminders(baseItem, deadlineDateKey);
      for (const { dateKey, item: reminderItem } of reminders) {
        addReminderToMap(map, dateKey, reminderItem);
      }
    }
  }

  return map;
}
