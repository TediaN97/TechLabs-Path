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

function getUrgency(date: Date): "high" | "medium" | "low" {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = (date.getTime() - today.getTime()) / 86400000;
  if (diff < 0) return "high"; // overdue
  if (diff <= 7) return "high"; // due within 7 days
  if (diff <= 30) return "medium";
  return "low";
}

function urgencyDotColor(urgency: "high" | "medium" | "low"): string {
  if (urgency === "high") return "bg-red-500";
  if (urgency === "medium") return "bg-amber-400";
  return "bg-[#6556d2]";
}

function urgencyTextColor(urgency: "high" | "medium" | "low"): string {
  if (urgency === "high") return "text-red-600";
  if (urgency === "medium") return "text-amber-600";
  return "text-[#6556d2]";
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

/** Deduplicate events by file within a day – show one entry per file per day */
function uniqueFilesForDay(events: CalendarEvent[]): {
  milestone: Milestone;
  maxUrgency: "high" | "medium" | "low";
  count: number;
}[] {
  const seen = new Map<
    string,
    { milestone: Milestone; maxUrgency: "high" | "medium" | "low"; count: number }
  >();
  for (const ev of events) {
    const key = ev.milestone.document_id || ev.milestone.id;
    const urgency = getUrgency(ev.date);
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, { milestone: ev.milestone, maxUrgency: urgency, count: 1 });
    } else {
      existing.count++;
      if (
        urgency === "high" ||
        (urgency === "medium" && existing.maxUrgency === "low")
      ) {
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

// ── Props ────────────────────────────────────────────────────────────────────────

export type CalendarActionType = "detail" | "importantInfo" | "aiDeadlines" | "vectorDeadlines";

interface DeadlineCalendarProps {
  data: Milestone[];
  onAction: (type: CalendarActionType, milestone: Milestone) => void;
}

// ── Component ───────────────────────────────────────────────────────────────────

export default function DeadlineCalendar({ data, onAction }: DeadlineCalendarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedEvent, setSelectedEvent] = useState<{
    milestone: Milestone;
    dateKey: string;
    events: CalendarEvent[];
  } | null>(null);

  // ── Derived data ────────────────────────────────────────────────────────────
  const allEvents = useMemo(() => buildCalendarEvents(data), [data]);
  const eventsByDate = useMemo(() => groupByDate(allEvents), [allEvents]);

  // Badge count: upcoming deadlines (today + future)
  const upcomingCount = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const unique = new Set<string>();
    for (const ev of allEvents) {
      if (ev.date >= today) unique.add(ev.dateKey + "|" + (ev.milestone.document_id || ev.milestone.id));
    }
    return unique.size;
  }, [allEvents]);

  // Overdue count
  const overdueCount = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const unique = new Set<string>();
    for (const ev of allEvents) {
      if (ev.date < today) unique.add(ev.dateKey + "|" + (ev.milestone.document_id || ev.milestone.id));
    }
    return unique.size;
  }, [allEvents]);

  // ── Month navigation ──────────────────────────────────────────────────────
  const prevMonth = useCallback(() => {
    setSelectedMonth((prev) => {
      const m = prev.month - 1;
      return m < 0 ? { year: prev.year - 1, month: 11 } : { year: prev.year, month: m };
    });
  }, []);

  const nextMonth = useCallback(() => {
    setSelectedMonth((prev) => {
      const m = prev.month + 1;
      return m > 11 ? { year: prev.year + 1, month: 0 } : { year: prev.year, month: m };
    });
  }, []);

  const goToToday = useCallback(() => {
    const now = new Date();
    setSelectedMonth({ year: now.getFullYear(), month: now.getMonth() });
  }, []);

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

  // Check if any day in the month has overdue events
  const hasOverdueInDay = useCallback(
    (events: CalendarEvent[]): boolean => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return events.some((ev) => ev.date < today);
    },
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
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
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
                      {allEvents.length} deadline{allEvents.length !== 1 ? "s" : ""} across {data.length} document{data.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-white/70 hover:text-white cursor-pointer text-lg leading-none"
                >
                  &times;
                </button>
              </div>

              {/* Month Navigation */}
              <div className="px-6 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    onClick={prevMonth}
                    className="p-1.5 text-gray-500 hover:text-[#6556d2] hover:bg-[#6556d2]/10 rounded-md transition-colors cursor-pointer"
                  >
                    <ChevronLeftIcon />
                  </button>
                  <h4 className="text-sm font-semibold text-gray-800 min-w-[160px] text-center">
                    {MONTH_NAMES[month]} {year}
                  </h4>
                  <button
                    onClick={nextMonth}
                    className="p-1.5 text-gray-500 hover:text-[#6556d2] hover:bg-[#6556d2]/10 rounded-md transition-colors cursor-pointer"
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
                  {overdueCount > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-md">
                      <WarningIcon />
                      {overdueCount} overdue
                    </span>
                  )}
                </div>
              </div>

              {/* Calendar Grid */}
              <div className="overflow-auto flex-1 p-4">
                {allEvents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <svg className="h-12 w-12 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    <p className="text-sm text-gray-400">No deadlines found in any documents.</p>
                    <p className="text-xs text-gray-400">Deadlines will appear here once documents with deadline data are uploaded.</p>
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

                        const files = uniqueFilesForDay(cell.events);
                        const isOverdue = hasOverdueInDay(cell.events);
                        const maxVisible = 2;

                        return (
                          <div
                            key={idx}
                            className={`bg-white min-h-[90px] p-1.5 relative transition-colors ${
                              cell.isToday ? "ring-2 ring-[#6556d2] ring-inset" : ""
                            } ${isOverdue ? "bg-red-50/40" : ""}`}
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
                    <div className="flex items-center gap-4 mt-3 px-1">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
                        <span className="text-[10px] text-gray-500">High / Overdue</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
                        <span className="text-[10px] text-gray-500">Medium (≤30 days)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block h-2 w-2 rounded-full bg-[#6556d2]" />
                        <span className="text-[10px] text-gray-500">Low (&gt;30 days)</span>
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
                                      {urgency === "high" ? "High Priority" : urgency === "medium" ? "Medium" : "Low"}
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
