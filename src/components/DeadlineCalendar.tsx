import { useState, useMemo, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import type { Milestone, DeadlineEntry } from "../hooks/useAgent";

// ── Types ───────────────────────────────────────────────────────────────────────

interface CalendarEvent {
  milestone: Milestone;
  deadline: DeadlineEntry;
  date: Date;
  dateKey: string; // YYYY-MM-DD
}

interface DayEventsGroup {
  [dateKey: string]: CalendarEvent[];
}

interface CalendarCell {
  day: number | null;
  dateKey: string;
  isToday: boolean;
  events: CalendarEvent[];
}

// ── Date Parsing ────────────────────────────────────────────────────────────────

function parseDeadlineDate(raw: string): Date | null {
  if (!raw || raw === "—" || raw === "-") return null;

  // Skip clearly non-date strings (relative/textual deadlines)
  if (/^within|^no later|^upon|^prior|^before|^after|^at least|^not/i.test(raw.trim())) return null;

  // 1. ISO format with T separator: "2025-06-15T00:00:00"
  if (raw.includes("T")) {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d;
  }

  // 2. ISO date-only: "2025-06-15" → add T to avoid timezone shift
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const d = new Date(raw + "T00:00:00");
    if (!isNaN(d.getTime())) return d;
  }

  // 3. DD.MM.YYYY format (common in the app)
  const dotParts = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dotParts) {
    const d = new Date(+dotParts[3], +dotParts[2] - 1, +dotParts[1]);
    if (!isNaN(d.getTime())) return d;
  }

  // 4. MM/DD/YYYY
  const slashParts = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashParts) {
    const d = new Date(+slashParts[3], +slashParts[1] - 1, +slashParts[2]);
    if (!isNaN(d.getTime())) return d;
  }

  // 5. Natural language: "February 28, 2015", "June 15, 2025", etc.
  //    Use Date constructor directly (do NOT append T00:00:00)
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d;

  return null;
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── Calendar Grid Helpers ───────────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1; // Monday = 0
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ── Urgency ─────────────────────────────────────────────────────────────────────

type UrgencyLevel = "critical" | "standard" | "future" | "past";

/** Compute days remaining (floored) from today midnight to the deadline date. */
function getDaysRemaining(date: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.floor((target.getTime() - today.getTime()) / 86400000);
}

function getUrgency(date: Date): UrgencyLevel {
  const daysRemaining = getDaysRemaining(date);
  if (daysRemaining < 0) return "past";        // overdue / already passed
  if (daysRemaining < 2) return "critical";     // < 2 days  → Red
  if (daysRemaining <= 10) return "standard";   // 2–10 days → Yellow
  return "future";                              // > 10 days → Blue (labelled >30 in legend)
}

function urgencyDotColor(urgency: UrgencyLevel): string {
  switch (urgency) {
    case "critical": return "bg-red-500";
    case "standard": return "bg-amber-400";
    case "future":   return "bg-blue-500";
    case "past":     return "bg-gray-400";
  }
}

function urgencyBgTint(urgency: UrgencyLevel): string {
  switch (urgency) {
    case "critical": return "bg-red-50/60";
    case "standard": return "bg-amber-50/50";
    case "future":   return "bg-blue-50/40";
    case "past":     return "bg-gray-50/40";
  }
}

function urgencyTextColor(urgency: UrgencyLevel): string {
  switch (urgency) {
    case "critical": return "text-red-600";
    case "standard": return "text-amber-600";
    case "future":   return "text-blue-600";
    case "past":     return "text-gray-400";
  }
}

function urgencyLabel(urgency: UrgencyLevel): string {
  switch (urgency) {
    case "critical": return "Critical Reminder";
    case "standard": return "Standard Reminder";
    case "future":   return "Future Reminder";
    case "past":     return "Past";
  }
}

// ── Event Building ──────────────────────────────────────────────────────────────

function buildCalendarEvents(data: Milestone[]): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (const m of data) {
    if (!m.deadlines?.length) continue;
    for (const dl of m.deadlines) {
      const d = parseDeadlineDate(dl.date_raw);
      if (!d) continue;
      events.push({
        milestone: m,
        deadline: dl,
        date: d,
        dateKey: toDateKey(d),
      });
    }
  }
  return events;
}

function groupByDate(events: CalendarEvent[]): DayEventsGroup {
  const grouped: DayEventsGroup = {};
  for (const ev of events) {
    if (!grouped[ev.dateKey]) grouped[ev.dateKey] = [];
    grouped[ev.dateKey].push(ev);
  }
  return grouped;
}

/** Priority ordering for urgency levels (lower = more urgent). */
const URGENCY_PRIORITY: Record<UrgencyLevel, number> = {
  critical: 0,
  standard: 1,
  future: 2,
  past: 3,
};

/** Deduplicate events by file within a day – show one entry per file per day */
function uniqueFilesForDay(events: CalendarEvent[]): {
  milestone: Milestone;
  maxUrgency: UrgencyLevel;
  count: number;
}[] {
  const seen = new Map<
    string,
    { milestone: Milestone; maxUrgency: UrgencyLevel; count: number }
  >();
  for (const ev of events) {
    const key = ev.milestone.document_id || ev.milestone.id;
    const urgency = getUrgency(ev.date);
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, { milestone: ev.milestone, maxUrgency: urgency, count: 1 });
    } else {
      existing.count++;
      if (URGENCY_PRIORITY[urgency] < URGENCY_PRIORITY[existing.maxUrgency]) {
        existing.maxUrgency = urgency;
      }
    }
  }
  return Array.from(seen.values());
}

// ── Icons ───────────────────────────────────────────────────────────────────────

function CalendarButtonIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <polyline points="9 6 15 12 9 18" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

// ── Range Types ──────────────────────────────────────────────────────────────────

export interface CalendarRange {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}

// ── Timeframe Selection Modal ────────────────────────────────────────────────────

function TimeframeSelectionModal({
  onConfirm,
  onClose,
}: {
  onConfirm: (range: { start: Date; end: Date }) => void;
  onClose: () => void;
}) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    if (!startDate || !endDate) {
      setError("Please select both a start and end date.");
      return;
    }
    const s = new Date(startDate + "T00:00:00");
    const e = new Date(endDate + "T00:00:00");
    if (isNaN(s.getTime()) || isNaN(e.getTime())) {
      setError("Invalid date format.");
      return;
    }
    if (s > e) {
      setError("Start date must be before end date.");
      return;
    }
    setError(null);
    onConfirm({ start: s, end: e });
  }

  // Close on Escape
  useEffect(() => {
    function handleKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 animate-[fadeIn_150ms_ease-out]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden animate-[fadeIn_150ms_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-[#6556d2] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center">
              <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Select Timeframe</h3>
              <p className="text-[11px] text-white/70 mt-0.5">Choose a date range to view deadlines</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white cursor-pointer text-lg leading-none"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setError(null); }}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#6556d2]/40 focus:border-[#6556d2] transition-colors"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setError(null); }}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#6556d2]/40 focus:border-[#6556d2] transition-colors"
            />
          </div>
          {error && (
            <p className="text-xs text-red-500 font-medium">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-end gap-2 bg-gray-50/50">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-1.5 text-xs font-medium text-white bg-[#6556d2] rounded-md hover:bg-[#5445b5] transition-colors cursor-pointer"
          >
            Show Calendar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Props ────────────────────────────────────────────────────────────────────────

export type CalendarActionType = "detail" | "importantInfo" | "aiDeadlines" | "vectorDeadlines";

interface DeadlineCalendarProps {
  data: Milestone[];
  onAction: (type: CalendarActionType, milestone: Milestone) => void;
  /** Persisted date range — if set, calendar opens directly without timeframe selection */
  persistedRange: CalendarRange | null;
  /** Called when user confirms a range selection */
  onRangeChange: (range: { start: Date | null; end: Date | null }) => void;
}

// ── API Response Types ──────────────────────────────────────────────────────────

interface ApiCalendarItem {
  file_name: string;
  section_title: string;
  date_parsed: string;
  date_raw: string;
  description: string;
  document_description: string | null;
}

interface ApiCalendarDay {
  date: string;
  count: number;
  documents_affected: string[];
  items: ApiCalendarItem[];
}

interface ApiCalendarResponse {
  ok: boolean;
  generated_at: string;
  today: string;
  window_start: string;
  window_end: string;
  total_in_window: number;
  calendar: ApiCalendarDay[];
}

// ── Component ───────────────────────────────────────────────────────────────────

export default function DeadlineCalendar({ data, onAction, persistedRange, onRangeChange }: DeadlineCalendarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showTimeframeModal, setShowTimeframeModal] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedEvent, setSelectedEvent] = useState<{
    milestone: Milestone;
    dateKey: string;
    events: CalendarEvent[];
  } | null>(null);

  // ── API-fetched events state ───────────────────────────────────────────────
  const [apiEvents, setApiEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // ── Fetch deadlines from the webhook API ───────────────────────────────────
  const fetchDeadlines = useCallback(async (startISO: string, endISO: string) => {
    setIsLoading(true);
    setFetchError(null);
    setApiEvents([]);

    const url = `https://20.110.72.120.nip.io/webhook/calendar/timeframe?start_date=${startISO}&end_date=${endISO}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`Server returned ${res.status}`);

      const text = await res.text();
      if (!text || text.trim() === "") {
        // Empty response — no deadlines in this range
        setApiEvents([]);
        return;
      }

      const json: ApiCalendarResponse = JSON.parse(text);

      if (!json.calendar || !Array.isArray(json.calendar)) {
        setApiEvents([]);
        return;
      }

      // Map API items → CalendarEvent[], matching milestones by file_name
      const events: CalendarEvent[] = [];
      for (const dayGroup of json.calendar) {
        for (const item of dayGroup.items) {
          const dateParsed = item.date_parsed || dayGroup.date;
          const date = new Date(dateParsed + "T00:00:00");
          if (isNaN(date.getTime())) continue;

          // Try to match a loaded milestone by file_name (normalized)
          const norm = (s: string) => s.trim().toLowerCase();
          const matched = data.find((m) => norm(m.file_name) === norm(item.file_name));

          // Build a synthetic Milestone if no local match exists
          const milestone: Milestone = matched || {
            id: `api-${item.file_name}-${dateParsed}`,
            deadline_date: dateParsed,
            milestone_name: item.section_title || item.description,
            document_ref: "",
            context: item.description,
            status: "pending" as const,
            raw_status: "pending",
            file_name: item.file_name,
            upload_time: "",
            description: item.description,
            lender: "",
            deadlines: [{
              description: item.description,
              date_raw: item.date_raw,
              date_parsed: dateParsed,
              section_title: item.section_title,
              section_index: 0,
            }],
          };

          // Build a DeadlineEntry for this specific item
          const deadline: DeadlineEntry = {
            description: item.description,
            date_raw: item.date_raw,
            date_parsed: dateParsed,
            section_title: item.section_title,
            section_index: 0,
          };

          events.push({
            milestone,
            deadline,
            date,
            dateKey: toDateKey(date),
          });
        }
      }

      setApiEvents(events);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setFetchError("Request timed out. Please try again.");
      } else {
        setFetchError(err instanceof Error ? err.message : "Failed to load deadlines");
      }
    } finally {
      setIsLoading(false);
    }
  }, [data]);

  // ── Calendar button click: show timeframe modal or open calendar directly ──
  const handleCalendarButtonClick = useCallback(() => {
    if (persistedRange) {
      // Range already exists — open calendar directly
      const start = new Date(persistedRange.start + "T00:00:00");
      setSelectedMonth({ year: start.getFullYear(), month: start.getMonth() });
      setIsOpen(true);
      // Re-fetch if we have no data yet
      if (apiEvents.length === 0 && !isLoading) {
        fetchDeadlines(persistedRange.start, persistedRange.end);
      }
    } else {
      // No range — show timeframe selection
      setShowTimeframeModal(true);
    }
  }, [persistedRange, apiEvents.length, isLoading, fetchDeadlines]);

  // ── Handle timeframe confirmation ──────────────────────────────────────────
  const handleTimeframeConfirm = useCallback(
    (range: { start: Date; end: Date }) => {
      onRangeChange({ start: range.start, end: range.end });
      setShowTimeframeModal(false);
      setSelectedMonth({ year: range.start.getFullYear(), month: range.start.getMonth() });
      setIsOpen(true);
      // Fetch deadlines from the API
      const startISO = toDateKey(range.start);
      const endISO = toDateKey(range.end);
      fetchDeadlines(startISO, endISO);
    },
    [onRangeChange, fetchDeadlines]
  );

  // ── Change Range: reset persisted range and show timeframe modal ───────────
  const handleChangeRange = useCallback(() => {
    onRangeChange({ start: null, end: null });
    setIsOpen(false);
    setSelectedEvent(null);
    setApiEvents([]);
    setFetchError(null);
    // Show timeframe modal after a tick so the calendar closes first
    requestAnimationFrame(() => {
      setShowTimeframeModal(true);
    });
  }, [onRangeChange]);

  // ── Derived data ────────────────────────────────────────────────────────────
  // Combine local milestone events with API-fetched events
  const localEvents = useMemo(() => buildCalendarEvents(data), [data]);

  // Merge: API events take priority, then local events (deduplicated by file+date)
  const allEvents = useMemo(() => {
    if (apiEvents.length > 0) {
      // Use API events as primary source, supplement with local
      const seen = new Set<string>();
      const merged: CalendarEvent[] = [];
      for (const ev of apiEvents) {
        const key = `${ev.milestone.file_name}|${ev.dateKey}`;
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(ev);
        }
      }
      for (const ev of localEvents) {
        const key = `${ev.milestone.file_name}|${ev.dateKey}`;
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(ev);
        }
      }
      return merged;
    }
    return localEvents;
  }, [apiEvents, localEvents]);

  // Filter events by persisted range
  const rangeFilteredEvents = useMemo(() => {
    if (!persistedRange) return allEvents;
    const rangeStart = new Date(persistedRange.start + "T00:00:00");
    const rangeEnd = new Date(persistedRange.end + "T00:00:00");
    rangeStart.setHours(0, 0, 0, 0);
    rangeEnd.setHours(23, 59, 59, 999);
    return allEvents.filter((ev) => ev.date >= rangeStart && ev.date <= rangeEnd);
  }, [allEvents, persistedRange]);

  const eventsByDate = useMemo(() => groupByDate(rangeFilteredEvents), [rangeFilteredEvents]);

  // Badge count: upcoming deadlines (today + future) — scoped to range
  const upcomingCount = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const unique = new Set<string>();
    for (const ev of rangeFilteredEvents) {
      if (ev.date >= today) unique.add(ev.dateKey + "|" + (ev.milestone.document_id || ev.milestone.id));
    }
    return unique.size;
  }, [rangeFilteredEvents]);

  // Overdue count — scoped to range
  const overdueCount = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const unique = new Set<string>();
    for (const ev of rangeFilteredEvents) {
      if (ev.date < today) unique.add(ev.dateKey + "|" + (ev.milestone.document_id || ev.milestone.id));
    }
    return unique.size;
  }, [rangeFilteredEvents]);

  // ── Month navigation with range constraints ─────────────────────────────
  const { canPrev, canNext } = useMemo(() => {
    if (!persistedRange) return { canPrev: true, canNext: true };
    const rangeStart = new Date(persistedRange.start + "T00:00:00");
    const rangeEnd = new Date(persistedRange.end + "T00:00:00");
    const startYM = rangeStart.getFullYear() * 12 + rangeStart.getMonth();
    const endYM = rangeEnd.getFullYear() * 12 + rangeEnd.getMonth();
    const currentYM = selectedMonth.year * 12 + selectedMonth.month;
    return { canPrev: currentYM > startYM, canNext: currentYM < endYM };
  }, [persistedRange, selectedMonth]);

  const prevMonth = useCallback(() => {
    if (!canPrev) return;
    setSelectedMonth((prev) => {
      const m = prev.month - 1;
      return m < 0 ? { year: prev.year - 1, month: 11 } : { year: prev.year, month: m };
    });
  }, [canPrev]);

  const nextMonth = useCallback(() => {
    if (!canNext) return;
    setSelectedMonth((prev) => {
      const m = prev.month + 1;
      return m > 11 ? { year: prev.year + 1, month: 0 } : { year: prev.year, month: m };
    });
  }, [canNext]);

  const goToToday = useCallback(() => {
    const now = new Date();
    if (persistedRange) {
      const rangeStart = new Date(persistedRange.start + "T00:00:00");
      const rangeEnd = new Date(persistedRange.end + "T00:00:00");
      const todayYM = now.getFullYear() * 12 + now.getMonth();
      const startYM = rangeStart.getFullYear() * 12 + rangeStart.getMonth();
      const endYM = rangeEnd.getFullYear() * 12 + rangeEnd.getMonth();
      if (todayYM < startYM || todayYM > endYM) return; // Today outside range
    }
    setSelectedMonth({ year: now.getFullYear(), month: now.getMonth() });
  }, [persistedRange]);

  // ── Action handler (close both modals → fire callback) ────────────────────
  const handleAction = useCallback(
    (type: CalendarActionType, milestone: Milestone) => {
      // Close both modals immediately
      setSelectedEvent(null);
      setIsOpen(false);
      // Fire the action after React commits the portal unmount.
      // Using double-rAF ensures the DOM is fully flushed before the
      // target modal in StructuralDataLookup mounts.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          onAction(type, milestone);
        });
      });
    },
    [onAction]
  );

  // ── Keyboard: Escape closes modals ────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (selectedEvent) setSelectedEvent(null);
        else setIsOpen(false);
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, selectedEvent]);

  // ── Grid computation ──────────────────────────────────────────────────────
  const { year, month } = selectedMonth;
  // todayKey lives outside the memo so any re-render after midnight picks up
  // the new date, even if year/month/eventsByDate haven't changed.
  const todayKey = toDateKey(new Date());

  const cells = useMemo<CalendarCell[]>(() => {
    // Derived from year+month — computed inside to keep the dep array minimal.
    const daysInMonth = getDaysInMonth(year, month);
    const firstDayOffset = getFirstDayOfWeek(year, month); // Mon = 0 … Sun = 6

    const result: CalendarCell[] = [];

    // Leading empty cells (pads Mon-first grid before the 1st of the month)
    for (let i = 0; i < firstDayOffset; i++) {
      result.push({ day: null, dateKey: "", isToday: false, events: [] });
    }

    // Day cells
    // `month` is 0-indexed (JS Date convention); +1 produces the 1-indexed
    // month number for the YYYY-MM-DD key — matching toDateKey() & eventsByDate.
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      result.push({
        day: d,
        dateKey: key,
        isToday: key === todayKey,
        events: eventsByDate[key] || [],
      });
    }

    // Trailing empty cells to complete the final 7-column row.
    // Minimum grid = 28 cells (Feb non-leap, Mon start), max = 42 (31 days, Sat start).
    while (result.length % 7 !== 0) {
      result.push({ day: null, dateKey: "", isToday: false, events: [] });
    }

    return result;
  }, [year, month, todayKey, eventsByDate]);

  /** Does this day have any overdue (past) events? */
  const hasOverdueInDay = useCallback(
    (events: CalendarEvent[]): boolean =>
      events.some((ev) => getUrgency(ev.date) === "past"),
    []
  );

  // ── Event click: file name in a day tile ──────────────────────────────────
  const handleFileClick = useCallback(
    (milestone: Milestone, dateKey: string) => {
      const eventsForFile = (eventsByDate[dateKey] || []).filter(
        (ev) => (ev.milestone.document_id || ev.milestone.id) === (milestone.document_id || milestone.id)
      );
      setSelectedEvent({ milestone, dateKey, events: eventsForFile });
    },
    [eventsByDate]
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Timeframe Selection Modal */}
      {showTimeframeModal && (
        <TimeframeSelectionModal
          onConfirm={handleTimeframeConfirm}
          onClose={() => setShowTimeframeModal(false)}
        />
      )}

      {/* Trigger Button */}
      <button
        onClick={handleCalendarButtonClick}
        className="relative inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#6556d2] bg-[#6556d2]/10 border border-[#6556d2]/20 rounded-lg hover:bg-[#6556d2]/20 transition-colors cursor-pointer"
        title="Deadline Calendar"
      >
        <CalendarButtonIcon />
        <span className="hidden sm:inline">Calendar</span>
        {upcomingCount > 0 && (
          <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 text-[10px] font-bold text-white bg-[#6556d2] rounded-full">
            {upcomingCount > 99 ? "99+" : upcomingCount}
          </span>
        )}
        {overdueCount > 0 && (
          <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-white" />
        )}
      </button>

      {/* Main Calendar Modal */}
      {isOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 animate-[fadeIn_150ms_ease-out]"
            onClick={() => {
              if (!selectedEvent) setIsOpen(false);
            }}
          >
            <div
              className="bg-white rounded-xl shadow-2xl w-full max-w-4xl mx-4 overflow-hidden max-h-[90vh] flex flex-col animate-[fadeIn_150ms_ease-out]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-6 py-4 bg-[#6556d2] flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center">
                    <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">Deadline Calendar</h3>
                    <p className="text-[11px] text-white/70 mt-0.5">
                      {isLoading
                        ? "Loading deadlines…"
                        : `${rangeFilteredEvents.length} deadline${rangeFilteredEvents.length !== 1 ? "s" : ""} across ${data.length} document${data.length !== 1 ? "s" : ""}`}
                      {persistedRange && !isLoading && (
                        <span className="ml-1.5">
                          &middot; {persistedRange.start} to {persistedRange.end}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Change Range button */}
                  <button
                    onClick={handleChangeRange}
                    className="px-2.5 py-1 text-[11px] font-medium text-white/90 bg-white/20 border border-white/30 rounded-md hover:bg-white/30 transition-colors cursor-pointer"
                    title="Change the selected date range"
                  >
                    Change Range
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="text-white/70 hover:text-white cursor-pointer text-lg leading-none"
                  >
                    &times;
                  </button>
                </div>
              </div>

              {/* Month Navigation */}
              <div className="px-6 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    onClick={prevMonth}
                    disabled={!canPrev}
                    className="p-1.5 text-gray-500 hover:text-[#6556d2] hover:bg-[#6556d2]/10 rounded-md transition-colors cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:text-gray-500 disabled:hover:bg-transparent"
                  >
                    <ChevronLeftIcon />
                  </button>
                  <h4 className="text-sm font-semibold text-gray-800 min-w-[160px] text-center">
                    {MONTH_NAMES[month]} {year}
                  </h4>
                  <button
                    onClick={nextMonth}
                    disabled={!canNext}
                    className="p-1.5 text-gray-500 hover:text-[#6556d2] hover:bg-[#6556d2]/10 rounded-md transition-colors cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:text-gray-500 disabled:hover:bg-transparent"
                  >
                    <ChevronRightIcon />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={goToToday}
                    className="px-2.5 py-1 text-[11px] font-medium text-[#6556d2] border border-[#6556d2]/30 rounded-md hover:bg-[#6556d2]/5 transition-colors cursor-pointer"
                  >
                    Today
                  </button>
                  {/* Non-clickable upcoming deadlines counter badge */}
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-[#6556d2] bg-[#6556d2]/8 border border-[#6556d2]/20 rounded-md select-none">
                    Upcoming Deadlines:
                    <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 text-[10px] font-bold text-white bg-[#6556d2] rounded-full">
                      {upcomingCount}
                    </span>
                  </span>
                </div>
              </div>

              {/* Calendar Grid */}
              <div className="overflow-auto flex-1 p-4">
                {isLoading ? (
                  <div className="flex items-center justify-center py-24 gap-2">
                    <svg className="h-6 w-6 animate-spin text-[#6556d2]" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="text-sm text-gray-400">Loading deadlines…</span>
                  </div>
                ) : fetchError ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-xs text-amber-700">
                      <svg className="h-4 w-4 flex-shrink-0 text-amber-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {fetchError}
                    </div>
                    <button
                      onClick={() => persistedRange && fetchDeadlines(persistedRange.start, persistedRange.end)}
                      className="px-3 py-1.5 text-xs font-medium text-[#6556d2] border border-[#6556d2]/30 rounded-md hover:bg-[#6556d2]/5 transition-colors cursor-pointer"
                    >
                      Retry
                    </button>
                  </div>
                ) : rangeFilteredEvents.length === 0 && apiEvents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <svg className="h-12 w-12 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    <p className="text-sm text-gray-400">No deadlines found in this date range.</p>
                    <p className="text-xs text-gray-400">Try selecting a different timeframe or upload documents with deadline data.</p>
                  </div>
                ) : (
                  <>
                    {/* Day headers */}
                    <div className="grid grid-cols-7 gap-px mb-1">
                      {DAY_HEADERS.map((d) => (
                        <div
                          key={d}
                          className="px-2 py-1.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider"
                        >
                          {d}
                        </div>
                      ))}
                    </div>

                    {/* Day cells */}
                    <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden border border-gray-200">
                      {cells.map((cell, idx) => {
                        if (cell.day === null) {
                          return <div key={idx} className="bg-gray-50/80 min-h-[90px]" />;
                        }

                        // Check if day is outside the selected range
                        const isOutOfRange = (() => {
                          if (!persistedRange) return false;
                          const cellDate = new Date(cell.dateKey + "T00:00:00");
                          const rangeStart = new Date(persistedRange.start + "T00:00:00");
                          const rangeEnd = new Date(persistedRange.end + "T00:00:00");
                          return cellDate < rangeStart || cellDate > rangeEnd;
                        })();

                        if (isOutOfRange) {
                          return (
                            <div
                              key={idx}
                              className="min-h-[90px] p-1.5 bg-gray-200 pointer-events-none select-none relative"
                            >
                              <div className="absolute inset-0 bg-gray-900/10" />
                              <span className="text-xs font-medium text-gray-500 opacity-40 leading-none relative">
                                {cell.day}
                              </span>
                            </div>
                          );
                        }

                        const files = uniqueFilesForDay(cell.events);
                        const isOverdue = hasOverdueInDay(cell.events);
                        const maxVisible = 2;

                        // Determine cell background tint from the highest-urgency event
                        const topUrgency: UrgencyLevel | null =
                          files.length > 0
                            ? files.reduce<UrgencyLevel>((best, f) =>
                                URGENCY_PRIORITY[f.maxUrgency] < URGENCY_PRIORITY[best]
                                  ? f.maxUrgency
                                  : best
                              , files[0].maxUrgency)
                            : null;

                        return (
                          <div
                            key={idx}
                            className={`min-h-[90px] p-1.5 relative transition-colors ${
                              cell.isToday ? "ring-2 ring-[#6556d2] ring-inset" : ""
                            } ${topUrgency ? urgencyBgTint(topUrgency) : "bg-white"}`}
                          >
                            {/* Day number */}
                            <div className="flex items-center justify-between mb-1">
                              <span
                                className={`text-xs font-medium leading-none ${
                                  cell.isToday
                                    ? "h-5 w-5 flex items-center justify-center rounded-full bg-[#6556d2] text-white"
                                    : "text-gray-600"
                                }`}
                              >
                                {cell.day}
                              </span>
                              {isOverdue && !cell.isToday && (
                                <span className="text-red-400">
                                  <WarningIcon />
                                </span>
                              )}
                            </div>

                            {/* File entries */}
                            <div className="space-y-0.5">
                              {files.slice(0, maxVisible).map((f) => {
                                const fileName = f.milestone.file_name || "Unknown";
                                const truncated =
                                  fileName.length > 18
                                    ? fileName.slice(0, 16) + "…"
                                    : fileName;
                                return (
                                  <button
                                    key={f.milestone.document_id || f.milestone.id}
                                    onClick={() => handleFileClick(f.milestone, cell.dateKey)}
                                    className="w-full text-left flex items-center gap-1 px-1 py-0.5 rounded text-[10px] leading-tight hover:bg-[#6556d2]/10 transition-colors cursor-pointer group truncate"
                                    title={`${fileName} — ${f.count} deadline${f.count !== 1 ? "s" : ""}`}
                                  >
                                    <span
                                      className={`inline-block h-1.5 w-1.5 rounded-full flex-shrink-0 ${urgencyDotColor(f.maxUrgency)}`}
                                    />
                                    <span className={`truncate ${urgencyTextColor(f.maxUrgency)} group-hover:text-[#6556d2] font-medium`}>
                                      {truncated}
                                    </span>
                                  </button>
                                );
                              })}
                              {files.length > maxVisible && (
                                <span className="block px-1 text-[9px] text-gray-400 font-medium">
                                  +{files.length - maxVisible} more
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Legend */}
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-3 px-1 py-2 bg-gray-50/60 rounded-lg border border-gray-100">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-500" />
                        <span className="text-[10px] text-gray-600 font-medium">Red Reminder <span className="text-gray-400">(&lt; 2 days)</span></span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-400" />
                        <span className="text-[10px] text-gray-600 font-medium">Yellow Reminder <span className="text-gray-400">(2–10 days)</span></span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-500" />
                        <span className="text-[10px] text-gray-600 font-medium">Blue Reminder <span className="text-gray-400">(&gt; 10 days)</span></span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block h-2.5 w-2.5 rounded-sm bg-gray-400" />
                        <span className="text-[10px] text-gray-600 font-medium">Past <span className="text-gray-400">(overdue)</span></span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-3 border-t border-gray-100 flex justify-end flex-shrink-0 bg-gray-50/50">
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-1.5 text-xs font-medium text-white bg-[#6556d2] rounded-md hover:bg-[#5445b5] transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>

            {/* ── Secondary Modal: Deadlines for [File Name] ─────────────── */}
            {selectedEvent && (
              <div
                className="fixed inset-0 z-[70] flex items-center justify-center bg-black/20 animate-[fadeIn_100ms_ease-out]"
                onClick={() => setSelectedEvent(null)}
              >
                <div
                  className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden max-h-[80vh] flex flex-col animate-[fadeIn_100ms_ease-out]"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Header */}
                  <div className="px-5 py-3.5 bg-[#6556d2] flex items-center justify-between flex-shrink-0">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-white truncate">
                        Deadlines for {selectedEvent.milestone.file_name}
                      </h3>
                      <p className="text-[11px] text-white/70 mt-0.5">
                        {formatDisplayDate(selectedEvent.dateKey)} &middot; {selectedEvent.events.length} deadline{selectedEvent.events.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedEvent(null)}
                      className="text-white/70 hover:text-white cursor-pointer text-lg leading-none ml-3 flex-shrink-0"
                    >
                      &times;
                    </button>
                  </div>

                  {/* Deadline list */}
                  <div className="overflow-auto flex-1 p-5">
                    {selectedEvent.events.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-6">No deadline details available.</p>
                    ) : (
                      <div className="space-y-3">
                        {selectedEvent.events.map((ev, idx) => {
                          const urgency = getUrgency(ev.date);
                          return (
                            <div
                              key={idx}
                              className="rounded-lg border border-gray-100 bg-gray-50/50 p-3.5"
                            >
                              <div className="flex items-start gap-2">
                                <span className={`inline-block h-2 w-2 rounded-full mt-1.5 flex-shrink-0 ${urgencyDotColor(urgency)}`} />
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs text-gray-700 leading-relaxed font-medium">
                                    {ev.deadline.description || "No description"}
                                  </p>
                                  <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-400">
                                    {ev.deadline.section_title && (
                                      <span>Section: {ev.deadline.section_title}</span>
                                    )}
                                    {ev.deadline.section_index != null && (
                                      <span>Page: {String(ev.deadline.section_index)}</span>
                                    )}
                                    <span className={`font-semibold ${urgencyTextColor(urgency)}`}>
                                      {urgencyLabel(urgency)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between flex-shrink-0 bg-gray-50/50">
                    <div className="flex items-center gap-2">
                      {/* Record Detail */}
                      <button
                        onClick={() => handleAction("detail", selectedEvent.milestone)}
                        title="Record Detail"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-white bg-[#6556d2] rounded-md hover:bg-[#5445b5] transition-colors cursor-pointer"
                      >
                        <InfoIcon />
                        Detail
                      </button>
                      {/* Important Info */}
                      <button
                        onClick={() => handleAction("importantInfo", selectedEvent.milestone)}
                        title="Important Info"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-white bg-[#6556d2] rounded-md hover:bg-[#5445b5] transition-colors cursor-pointer"
                      >
                        <SparklesIcon />
                        Important Info
                      </button>
                      {/* Deadlines */}
                      <button
                        onClick={() => handleAction("aiDeadlines", selectedEvent.milestone)}
                        title="AI Deadlines"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-white bg-[#6556d2] rounded-md hover:bg-[#5445b5] transition-colors cursor-pointer"
                      >
                        <ClockIcon />
                        Deadlines
                      </button>
                    </div>
                    <button
                      onClick={() => setSelectedEvent(null)}
                      className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>,
          document.body
        )}
    </>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────────

function formatDisplayDate(dateKey: string): string {
  const parts = dateKey.split("-");
  if (parts.length !== 3) return dateKey;
  const d = new Date(+parts[0], +parts[1] - 1, +parts[2]);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
