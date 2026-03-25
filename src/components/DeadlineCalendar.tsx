import { useState, useMemo, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import type { Milestone } from "../hooks/useAgent";
import { useCalendarTimeframe } from "../hooks/useCalendarTimeframe";
import type {
   CalendarDayData,
  CalendarDeadlineItem,
  DeadlineSeverity,
} from "../services/calendarTimeframe";
import CalendarToolbar from "./calendar/CalendarToolbar";
import DeadlineModalActions from "./calendar/DeadlineModalActions";
import DeadlineSeverityIndicator from "./calendar/DeadlineSeverityIndicator";

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

// ── Severity Styling ─────────────────────────────────────────────────────────

function severityDotColor(severity: DeadlineSeverity): string {
  switch (severity) {
    case "critical": return "bg-red-500";
    case "warning":  return "bg-amber-400";
    case "future":   return "bg-blue-500";
    case "past":     return "bg-gray-400";
  }
}

function severityBgTint(severity: DeadlineSeverity): string {
  switch (severity) {
    case "critical": return "bg-red-50/60";
    case "warning":  return "bg-amber-50/50";
    case "future":   return "bg-blue-50/40";
    case "past":     return "bg-gray-50/40";
  }
}

function severityTextColor(severity: DeadlineSeverity): string {
  switch (severity) {
    case "critical": return "text-red-600";
    case "warning":  return "text-amber-600";
    case "future":   return "text-blue-600";
    case "past":     return "text-gray-400";
  }
}

function severityLabel(severity: DeadlineSeverity): string {
  switch (severity) {
    case "critical": return "Critical Reminder";
    case "warning":  return "Standard Reminder";
    case "future":   return "Future Reminder";
    case "past":     return "Past";
  }
}

/** Priority ordering for severity levels (lower = more urgent). */
const SEVERITY_PRIORITY: Record<DeadlineSeverity, number> = {
  critical: 0,
  warning: 1,
  future: 2,
  past: 3,
};

/**
 * Get the highest-priority (most urgent) severity from a CalendarDayData.
 * Used for cell background tint.
 */
function getTopSeverity(dayData: CalendarDayData): DeadlineSeverity {
  let top: DeadlineSeverity = dayData.items[0]?.severity ?? "past";
  for (const item of dayData.items) {
    if (SEVERITY_PRIORITY[item.severity] < SEVERITY_PRIORITY[top]) {
      top = item.severity;
    }
  }
  return top;
}

/**
 * Group items by file name, tracking max severity and count per file.
 * This deduplicates items from the same file on the same day.
 */
function groupItemsByFile(items: CalendarDeadlineItem[]): {
  fileName: string;
  maxSeverity: DeadlineSeverity;
  count: number;
  items: CalendarDeadlineItem[];
}[] {
  const fileMap = new Map<string, {
    fileName: string;
    maxSeverity: DeadlineSeverity;
    count: number;
    items: CalendarDeadlineItem[];
  }>();

  for (const item of items) {
    const key = item.fileName;
    const existing = fileMap.get(key);
    if (!existing) {
      fileMap.set(key, { fileName: key, maxSeverity: item.severity, count: 1, items: [item] });
    } else {
      existing.count++;
      existing.items.push(item);
      if (SEVERITY_PRIORITY[item.severity] < SEVERITY_PRIORITY[existing.maxSeverity]) {
        existing.maxSeverity = item.severity;
      }
    }
  }

  return Array.from(fileMap.values());
}

// ── Calendar Cell Type ──────────────────────────────────────────────────────────

interface CalendarCell {
  day: number | null;
  dateKey: string;
  isToday: boolean;
  dayData: CalendarDayData | null;
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
  const [selectedDay, setSelectedDay] = useState<CalendarDayData | null>(null);

  // ── Timeframe-based data fetching ──────────────────────────────────────────
  const {
    deadlineMap,
    serverToday,
    totalInWindow,
    isLoading: isTimeframeLoading,
    isFetching: isTimeframeFetching,
    error: timeframeError,
    timeframe,
  } = useCalendarTimeframe(selectedMonth);

  // ── Counts for badges ──────────────────────────────────────────────────────
  const { upcomingCount, overdueCount } = useMemo(() => {
    let upcoming = 0;
    let overdue = 0;
    for (const dayData of Object.values(deadlineMap)) {
      for (const item of dayData.items) {
        if (item.severity === "past") overdue++;
        else upcoming++;
      }
    }
    return { upcomingCount: upcoming, overdueCount: overdue };
  }, [deadlineMap]);

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

  // ── Action handler: find matching Milestone from prop data for actions ────
  const findMilestoneByFileName = useCallback(
    (fileName: string): Milestone | null => {
      return data.find((m) => m.file_name === fileName) ?? null;
    },
    [data]
  );

  const handleAction = useCallback(
    (type: CalendarActionType, fileName: string) => {
      const milestone = findMilestoneByFileName(fileName);
      if (!milestone) return;
      setSelectedDay(null);
      setIsOpen(false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          onAction(type, milestone);
        });
      });
    },
    [onAction, findMilestoneByFileName]
  );

  // ── Keyboard: Escape closes modals ────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (selectedDay) setSelectedDay(null);
        else setIsOpen(false);
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, selectedDay]);

  // ── Grid computation ──────────────────────────────────────────────────────
  const { year, month } = selectedMonth;
  const todayKey = serverToday;

  const cells = useMemo<CalendarCell[]>(() => {
    const daysInMonth = getDaysInMonth(year, month);
    const firstDayOffset = getFirstDayOfWeek(year, month);

    const result: CalendarCell[] = [];

    // Leading empty cells
    for (let i = 0; i < firstDayOffset; i++) {
      result.push({ day: null, dateKey: "", isToday: false, dayData: null });
    }

    // Day cells
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      result.push({
        day: d,
        dateKey: key,
        isToday: key === todayKey,
        dayData: deadlineMap[key] ?? null,
      });
    }

    // Trailing empty cells
    while (result.length % 7 !== 0) {
      result.push({ day: null, dateKey: "", isToday: false, dayData: null });
    }

    return result;
  }, [year, month, todayKey, deadlineMap]);

  // ── Render ────────────────────────────────────────────────────────────────

  const MAX_VISIBLE_FILES = 2;

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
            if (!selectedDay) setIsOpen(false);
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
                      {totalInWindow} deadline{totalInWindow !== 1 ? "s" : ""} in {MONTH_NAMES[month]} {year}
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

            {/* Month Navigation + Toolbar Controls */}
            <CalendarToolbar
              monthLabel={`${MONTH_NAMES[month]} ${year}`}
              upcomingCount={upcomingCount}
              onPrevMonth={prevMonth}
              onNextMonth={nextMonth}
              onGoToToday={goToToday}
            />

            {/* Calendar Grid */}
            <div className="overflow-auto flex-1 p-4 relative">
              {/* Fetching overlay */}
              {isTimeframeFetching && !isTimeframeLoading && (
                <div className="absolute top-2 right-6 z-10 flex items-center gap-1.5 px-2.5 py-1 bg-white/90 border border-[#6556d2]/20 rounded-full shadow-sm">
                  <span className="h-2 w-2 rounded-full bg-[#6556d2] animate-pulse" />
                  <span className="text-[10px] text-[#6556d2] font-medium">Loading…</span>
                </div>
              )}

              {/* Error banner */}
              {timeframeError && (
                <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                    <span className="text-red-500"><WarningIcon /></span>
                  <span className="text-xs text-red-600">
                    Failed to load calendar data: {timeframeError}
                  </span>
                </div>
              )}

              {/* Range indicator */}
              {timeframe && (
                <div className="mb-2 text-[10px] text-gray-400 text-right">
                  {timeframe.startDate} — {timeframe.endDate}
                </div>
              )}

              {isTimeframeLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <div className="h-8 w-8 border-2 border-[#6556d2]/30 border-t-[#6556d2] rounded-full animate-spin" />
                  <p className="text-sm text-gray-400">Loading calendar data…</p>
                </div>
              ) : (
                <>
                  {/* Day headers */}
                  <div className="grid grid-cols-7 gap-px mb-1">
                    {DAY_HEADERS.map((d) => (
                        <div key={d} className="px-2 py-1.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
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

                      const dayData = cell.dayData;
                      const hasDeadlines = dayData !== null && dayData.items.length > 0;
                      const fileGroups = hasDeadlines ? groupItemsByFile(dayData.items) : [];
                      const topSev = hasDeadlines ? getTopSeverity(dayData) : null;
                      const hasPast = hasDeadlines && dayData.items.some((i) => i.severity === "past");
                        const hasCritical = hasDeadlines && dayData.items.some((i) => i.severity === "critical");
                        /** The severity to display for the warning indicator (critical takes priority). */
                        const indicatorSeverity = hasCritical ? "critical" as const : hasPast ? "past" as const : null;

                      return (
                        <div
                          key={idx}
                          className={`min-h-[90px] p-1.5 relative transition-colors ${
                            cell.isToday ? "ring-2 ring-[#6556d2] ring-inset" : ""
                          } ${topSev ? severityBgTint(topSev) : "bg-white"}`}
                        >
                            {/* Day number + severity indicator */}
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
                              {indicatorSeverity && !cell.isToday && (
                                <DeadlineSeverityIndicator severity={indicatorSeverity} />
                            )}
                          </div>

                          {/* Deadline file entries */}
                          {hasDeadlines && (
                            <div className="space-y-0.5">
                              {fileGroups.slice(0, MAX_VISIBLE_FILES).map((fg) => {
                                const truncated =
                                  fg.fileName.length > 18
                                    ? fg.fileName.slice(0, 16) + "…"
                                    : fg.fileName;
                                return (
                                  <button
                                    key={fg.fileName}
                                    onClick={() => setSelectedDay(dayData)}
                                    className="w-full text-left flex items-center gap-1 px-1 py-0.5 rounded text-[10px] leading-tight hover:bg-[#6556d2]/10 transition-colors cursor-pointer group truncate"
                                      title={`${fg.fileName} — ${fg.count} deadline${fg.count !== 1 ? "s" : ""}`}
                                  >
                                      <span className={`inline-block h-1.5 w-1.5 rounded-full flex-shrink-0 ${severityDotColor(fg.maxSeverity)}`} />
                                      <span className={`truncate ${severityTextColor(fg.maxSeverity)} group-hover:text-[#6556d2] font-medium`}>
                                      {truncated}
                                    </span>
                                    {fg.count > 1 && (
                                        <span className="text-[9px] text-gray-400 flex-shrink-0">({fg.count})</span>
                                    )}
                                  </button>
                                );
                              })}
                              {fileGroups.length > MAX_VISIBLE_FILES && (
                                <button
                                  onClick={() => setSelectedDay(dayData)}
                                  className="block px-1 text-[9px] text-gray-400 font-medium hover:text-[#6556d2] cursor-pointer"
                                >
                                  +{fileGroups.length - MAX_VISIBLE_FILES} more
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Legend */}
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-3 px-1 py-2 bg-gray-50/60 rounded-lg border border-gray-100">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-500" />
                        <span className="text-[10px] text-gray-600 font-medium">Critical Reminder <span className="text-gray-400">(&lt; 2 days)</span></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-400" />
                        <span className="text-[10px] text-gray-600 font-medium">Warning Reminder<span className="text-gray-400">(2–10 days)</span></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-500" />
                        <span className="text-[10px] text-gray-600 font-medium">Future Reminder<span className="text-gray-400">(&gt; 10 days)</span></span>
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

            {/* ── Secondary Modal: Deadlines for selected day ─────────────── */}
            {selectedDay && (
              <div
                className="fixed inset-0 z-[70] flex items-center justify-center bg-black/20 animate-[fadeIn_100ms_ease-out]"
                onClick={() => setSelectedDay(null)}
              >
                <div
                  className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden max-h-[80vh] flex flex-col animate-[fadeIn_100ms_ease-out]"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Header */}
                  <div className="px-5 py-3.5 bg-[#6556d2] flex items-center justify-between flex-shrink-0">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-white truncate">
                        Deadlines for {formatDisplayDate(selectedDay.date)}
                      </h3>
                      <p className="text-[11px] text-white/70 mt-0.5">
                        {selectedDay.count} deadline{selectedDay.count !== 1 ? "s" : ""} &middot; {selectedDay.documentsAffected.length} document{selectedDay.documentsAffected.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedDay(null)}
                      className="text-white/70 hover:text-white cursor-pointer text-lg leading-none ml-3 flex-shrink-0"
                    >
                      &times;
                    </button>
                  </div>

                  {/* Deadline list */}
                  <div className="overflow-auto flex-1 p-5">
                    {selectedDay.items.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-6">No deadline details available.</p>
                    ) : (
                      <div className="space-y-3">
                        {selectedDay.items.map((item, idx) => (
                          <div key={idx} className="rounded-lg border border-gray-100 bg-gray-50/50 p-3.5">
                            <div className="flex items-start gap-2">
                              <span className={`inline-block h-2 w-2 rounded-full mt-1.5 flex-shrink-0 ${severityDotColor(item.severity)}`} />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs text-gray-800 font-semibold truncate" title={item.fileName}>
                                  {item.fileName}
                                </p>
                                {item.description && (
                                  <p className="text-xs text-gray-600 leading-relaxed mt-1">
                                    {item.description}
                                  </p>
                                )}
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[10px] text-gray-400">
                                  {item.sectionTitle && (
                                    <span>Section: {item.sectionTitle}</span>
                                  )}
                                  {item.dateRaw && (
                                    <span>Date: {item.dateRaw}</span>
                                  )}
                                  <span className={`font-semibold ${severityTextColor(item.severity)}`}>
                                    {severityLabel(item.severity)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between flex-shrink-0 bg-gray-50/50">
                    <DeadlineModalActions
                      documentsAffected={selectedDay.documentsAffected}
                      onAction={handleAction}
                    />
                    <button
                      onClick={() => setSelectedDay(null)}
                      className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors cursor-pointer flex-shrink-0"
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
