import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import type { Milestone } from "../hooks/useAgent";

// ── Types ────────────────────────────────────────────────────────────────────

interface CalendarEntry {
  Id: string;
  FileName: string;
  Date: string; // DD.MM.YYYY
  Description: string;
}

interface ParsedCalendarEntry extends CalendarEntry {
  parsed: Date;
  daysRemaining: number;
}

type ColorCategory = "critical" | "warning" | "future" | "past";

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseDDMMYYYY(raw: string): Date {
  const [dd, mm, yyyy] = raw.split(".");
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function calcDaysRemaining(target: Date, today: Date): number {
  const t = startOfDay(target).getTime();
  const n = startOfDay(today).getTime();
  return Math.round((t - n) / 86_400_000);
}

function toISODate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDDMMYYYY(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}`;
}

function getColorCategory(days: number): ColorCategory {
  if (days < 0) return "past";
  if (days < 2) return "critical";
  if (days <= 10) return "warning";
  return "future";
}

const COLOR_MAP: Record<ColorCategory, { dot: string; bg: string; text: string; border: string; badge: string }> = {
  critical: {
    dot: "bg-red-500",
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
    badge: "bg-red-100 text-red-700 border-red-200",
  },
  warning: {
    dot: "bg-amber-400",
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    badge: "bg-amber-100 text-amber-700 border-amber-200",
  },
  future: {
    dot: "bg-blue-500",
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    badge: "bg-blue-100 text-blue-700 border-blue-200",
  },
  past: {
    dot: "bg-gray-400",
    bg: "bg-gray-50",
    text: "text-gray-500",
    border: "border-gray-200",
    badge: "bg-gray-100 text-gray-500 border-gray-200",
  },
};

const LEGEND: { key: ColorCategory; label: string }[] = [
  { key: "critical", label: "Red Reminder (< 2 days)" },
  { key: "warning", label: "Yellow Reminder (2\u201310 days)" },
  { key: "future", label: "Blue Reminder (> 10 days)" },
  { key: "past", label: "Past (overdue)" },
];

const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

function monthName(month: number): string {
  return [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ][month];
}

function buildCalendarGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// ── Icons ────────────────────────────────────────────────────────────────────

function CalendarIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <polyline points="9 6 15 12 9 18" />
    </svg>
  );
}

// ── Quick Actions Modal (Event Detail) ───────────────────────────────────────

function QuickActionsModal({
  entry,
  milestones,
  onClose,
  onCloseCalendar,
  onInfo,
  onImportantInfo,
  onDeadlines,
}: {
  entry: ParsedCalendarEntry;
  milestones: Milestone[];
  onClose: () => void;
  onCloseCalendar: () => void;
  onInfo: (m: Milestone) => void;
  onImportantInfo: (m: Milestone) => void;
  onDeadlines: (m: Milestone) => void;
}) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const cat = getColorCategory(entry.daysRemaining);
  const colors = COLOR_MAP[cat];

  // Match by normalised file_name (trim whitespace, case-insensitive)
  const norm = (s: string) => s.trim().toLowerCase();
  const matchedMilestone = milestones.find(
    (m) => norm(m.file_name) === norm(entry.FileName)
  );

  // Bridge action: close QuickActions + Calendar, then fire callback
  const fireAction = useCallback(
    (action: (m: Milestone) => void, m: Milestone) => {
      onClose();          // unmount QuickActions first
      onCloseCalendar();  // unmount entire Calendar portal
      action(m);          // trigger the dashboard modal
    },
    [onClose, onCloseCalendar],
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 bg-[#6556d2] flex items-center justify-between flex-shrink-0">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white truncate">{entry.FileName}</h3>
            <p className="text-[11px] text-white/70 mt-0.5 flex items-center gap-2">
              <span>Due: {entry.Date}</span>
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold leading-none ${
                cat === "critical" ? "bg-red-400/30 text-white" :
                cat === "warning" ? "bg-amber-400/30 text-white" :
                cat === "past" ? "bg-gray-400/30 text-white" :
                "bg-blue-400/30 text-white"
              }`}>
                {entry.daysRemaining < 0
                  ? `${Math.abs(entry.daysRemaining)}d overdue`
                  : entry.daysRemaining === 0 ? "Today"
                  : `${entry.daysRemaining}d remaining`}
              </span>
            </p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white cursor-pointer text-lg leading-none ml-4 flex-shrink-0">&times;</button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-4">
          <div className={`rounded-md p-4 border ${colors.bg} ${colors.border} ${colors.text}`}>
            <p className="text-xs font-semibold mb-1">Description</p>
            <p className="text-xs leading-relaxed">{entry.Description || "No description available."}</p>
          </div>

          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-full border leading-none ${colors.badge}`}>
              <span className={`inline-block h-2 w-2 rounded-full flex-shrink-0 ${colors.dot}`} />
              {LEGEND.find((l) => l.key === cat)?.label}
            </span>
          </div>

          {matchedMilestone ? (
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => fireAction(onInfo, matchedMilestone)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-white bg-[#6556d2] rounded-md hover:bg-[#5445b5] transition-colors cursor-pointer"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
                Record Detail
              </button>
              <button
                onClick={() => fireAction(onImportantInfo, matchedMilestone)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-white bg-[#6556d2] rounded-md hover:bg-[#5445b5] transition-colors cursor-pointer"
              >
                <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" /></svg>
                Important Info
              </button>
              <button
                onClick={() => fireAction(onDeadlines, matchedMilestone)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-white bg-[#6556d2] rounded-md hover:bg-[#5445b5] transition-colors cursor-pointer"
              >
                <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                Deadlines
              </button>
            </div>
          ) : (
            <p className="text-[11px] text-gray-400 italic">
              Full document metadata not yet loaded — action buttons will appear once the document list is available.
            </p>
          )}
        </div>

        <div className="px-6 py-3 border-t border-gray-100 flex justify-end flex-shrink-0 bg-gray-50/50">
          <button onClick={onClose} className="px-4 py-1.5 text-xs font-medium text-white bg-[#6556d2] rounded-md hover:bg-[#5445b5] transition-colors cursor-pointer">Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Step 1: Timeframe Selection Modal ────────────────────────────────────────

function TimeframeModal({
  onGenerate,
  onClose,
  initialStart,
  initialEnd,
}: {
  onGenerate: (start: string, end: string) => void;
  onClose: () => void;
  initialStart?: string;
  initialEnd?: string;
}) {
  const todayStr = toISODate(new Date());
  const [startDate, setStartDate] = useState(initialStart || todayStr);
  const [endDate, setEndDate] = useState(initialEnd || (() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 3);
    return toISODate(d);
  }));
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  function handleSubmit() {
    if (!startDate || !endDate) { setValidationError("Both dates are required."); return; }
    if (startDate > endDate) { setValidationError("Start date must be before end date."); return; }
    setValidationError(null);
    onGenerate(startDate, endDate);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 bg-[#6556d2] flex items-center gap-3">
          <CalendarIcon className="h-5 w-5 text-white/90" />
          <div>
            <h3 className="text-sm font-semibold text-white">Deadline Calendar</h3>
            <p className="text-[11px] text-white/70 mt-0.5">Select a timeframe to view deadlines</p>
          </div>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Start Date</label>
            <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setValidationError(null); }} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#6556d2]/40 focus:border-[#6556d2] transition-colors" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">End Date</label>
            <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setValidationError(null); }} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#6556d2]/40 focus:border-[#6556d2] transition-colors" />
          </div>
          {validationError && <p className="text-xs text-red-500 font-medium">{validationError}</p>}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-2 bg-gray-50/50">
          <button onClick={onClose} className="px-4 py-2 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">Cancel</button>
          <button onClick={handleSubmit} className="px-4 py-2 text-xs font-medium text-white bg-[#6556d2] rounded-lg hover:bg-[#5445b5] transition-colors cursor-pointer inline-flex items-center gap-1.5">
            <CalendarIcon className="h-3.5 w-3.5" />
            Generate Calendar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Step 2: Calendar View Modal (Screenshot-accurate) ────────────────────────

function CalendarViewModal({
  entries,
  isLoading,
  error,
  rangeStart,
  rangeEnd,
  milestones,
  totalDocuments,
  onClose,
  onCloseCalendar,
  onChangeRange,
  onInfo,
  onImportantInfo,
  onDeadlines,
}: {
  entries: ParsedCalendarEntry[];
  isLoading: boolean;
  error: string | null;
  rangeStart: Date;
  rangeEnd: Date;
  milestones: Milestone[];
  totalDocuments: number;
  onClose: () => void;
  onCloseCalendar: () => void;
  onChangeRange: () => void;
  onInfo: (m: Milestone) => void;
  onImportantInfo: (m: Milestone) => void;
  onDeadlines: (m: Milestone) => void;
}) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const [viewYear, setViewYear] = useState(rangeStart.getFullYear());
  const [viewMonth, setViewMonth] = useState(rangeStart.getMonth());
  const [selectedEntry, setSelectedEntry] = useState<ParsedCalendarEntry | null>(null);
  const [upcomingDropdownOpen, setUpcomingDropdownOpen] = useState(false);
  const [highlightedDay, setHighlightedDay] = useState<string | null>(null); // "YYYY-MM-DD"
  const upcomingBadgeRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (upcomingDropdownOpen) { setUpcomingDropdownOpen(false); return; }
        if (selectedEntry) setSelectedEntry(null);
        else onClose();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose, selectedEntry, upcomingDropdownOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!upcomingDropdownOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        upcomingBadgeRef.current && !upcomingBadgeRef.current.contains(e.target as Node)
      ) {
        setUpcomingDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [upcomingDropdownOpen]);

  // Clear highlight after animation
  useEffect(() => {
    if (!highlightedDay) return;
    const timer = setTimeout(() => setHighlightedDay(null), 2000);
    return () => clearTimeout(timer);
  }, [highlightedDay]);

  // Navigation boundary
  const startYM = rangeStart.getFullYear() * 12 + rangeStart.getMonth();
  const endYM = rangeEnd.getFullYear() * 12 + rangeEnd.getMonth();
  const currentYM = viewYear * 12 + viewMonth;
  const canPrev = currentYM > startYM;
  const canNext = currentYM < endYM;

  const grid = useMemo(() => buildCalendarGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const entriesByDay = useMemo(() => {
    const map = new Map<string, ParsedCalendarEntry[]>();
    for (const e of entries) {
      if (e.parsed.getFullYear() === viewYear && e.parsed.getMonth() === viewMonth) {
        const key = e.parsed.getDate().toString();
        const arr = map.get(key) || [];
        arr.push(e);
        map.set(key, arr);
      }
    }
    return map;
  }, [entries, viewYear, viewMonth]);

  const goToday = useCallback(() => {
    const todayYM = today.getFullYear() * 12 + today.getMonth();
    if (todayYM >= startYM && todayYM <= endYM) {
      setViewYear(today.getFullYear());
      setViewMonth(today.getMonth());
    }
  }, [today, startYM, endYM]);

  const goPrev = useCallback(() => {
    if (!canPrev) return;
    setViewMonth((m) => { if (m === 0) { setViewYear((y) => y - 1); return 11; } return m - 1; });
  }, [canPrev]);

  const goNext = useCallback(() => {
    if (!canNext) return;
    setViewMonth((m) => { if (m === 11) { setViewYear((y) => y + 1); return 0; } return m + 1; });
  }, [canNext]);

  // Upcoming deadlines within allowed range (future only, sorted by date)
  const upcomingInRange = useMemo(() => {
    const rs = startOfDay(rangeStart).getTime();
    const re = startOfDay(rangeEnd).getTime();
    return entries
      .filter((e) => {
        const t = startOfDay(e.parsed).getTime();
        return e.daysRemaining >= 0 && t >= rs && t <= re;
      })
      .sort((a, b) => a.parsed.getTime() - b.parsed.getTime());
  }, [entries, rangeStart, rangeEnd]);

  // Jump-to-date action
  const jumpToEntry = useCallback((entry: ParsedCalendarEntry) => {
    const targetYear = entry.parsed.getFullYear();
    const targetMonth = entry.parsed.getMonth();
    // Sync month if needed
    if (targetYear !== viewYear || targetMonth !== viewMonth) {
      setViewYear(targetYear);
      setViewMonth(targetMonth);
    }
    // Highlight the target day cell
    setHighlightedDay(toISODate(entry.parsed));
    // Auto-open Quick Actions for this entry
    setTimeout(() => setSelectedEntry(entry), 350);
    setUpcomingDropdownOpen(false);
  }, [viewYear, viewMonth]);

  // Badge click handler
  const handleUpcomingClick = useCallback(() => {
    if (upcomingInRange.length === 0) return;
    if (upcomingInRange.length === 1) {
      // Single event — jump directly
      jumpToEntry(upcomingInRange[0]);
    } else {
      setUpcomingDropdownOpen((v) => !v);
    }
  }, [upcomingInRange, jumpToEntry]);

  return (
    <>
      {/* Keyframe animations */}
      <style>{`
        @keyframes calendarPulse {
          0%, 100% { box-shadow: inset 0 0 0 2px rgba(245, 158, 11, 0.6); }
          50% { box-shadow: inset 0 0 0 3px rgba(245, 158, 11, 1), 0 0 12px rgba(245, 158, 11, 0.3); }
        }
        .calendar-pulse { animation: calendarPulse 0.6s ease-in-out 3; }
        @keyframes dropdownIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-6" onClick={onClose}>
        <div
          className="bg-white rounded-xl shadow-2xl w-full max-w-[900px] mx-4 overflow-hidden max-h-[94vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Deep Violet Header ── */}
          <div className="bg-[#6556d2] px-6 py-4 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
                <CalendarIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Deadline Calendar</h2>
                <p className="text-[12px] text-white/70 mt-0.5">
                  {isLoading
                    ? "Loading deadlines\u2026"
                    : `${entries.length} deadlines across ${totalDocuments} documents \u00B7 ${formatDDMMYYYY(rangeStart)} \u2013 ${formatDDMMYYYY(rangeEnd)}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onChangeRange}
                title="Change date range"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-white/90 bg-white/15 rounded-lg hover:bg-white/25 transition-colors cursor-pointer"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Change Range
              </button>
              <button
                onClick={onClose}
                className="text-white/60 hover:text-white transition-colors cursor-pointer text-xl leading-none"
              >
                &times;
              </button>
            </div>
          </div>

          {/* ── Navigation Row ── */}
          <div className="px-6 py-3 border-b border-gray-200 flex items-center justify-between flex-shrink-0 bg-white">
            {/* Left: Month nav */}
            <div className="flex items-center gap-2">
              <button
                onClick={goPrev}
                disabled={!canPrev}
                className="p-1 text-gray-500 hover:text-[#6556d2] rounded transition-colors cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed"
              >
                <ChevronLeftIcon />
              </button>
              <span className="text-[15px] font-bold text-gray-800 min-w-[150px] text-center select-none">
                {monthName(viewMonth)} {viewYear}
              </span>
              <button
                onClick={goNext}
                disabled={!canNext}
                className="p-1 text-gray-500 hover:text-[#6556d2] rounded transition-colors cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed"
              >
                <ChevronRightIcon />
              </button>
            </div>

            {/* Right: Today + Upcoming Navigator */}
            <div className="flex items-center gap-3">
              <button
                onClick={goToday}
                className="px-4 py-1.5 text-xs font-semibold text-[#6556d2] border border-[#6556d2]/30 rounded-lg hover:bg-[#6556d2]/5 transition-colors cursor-pointer"
              >
                Today
              </button>

              {/* Upcoming Deadlines — Interactive Badge */}
              <div className="relative">
                <button
                  ref={upcomingBadgeRef}
                  onClick={handleUpcomingClick}
                  disabled={upcomingInRange.length === 0}
                  className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-full transition-colors ${
                    upcomingInRange.length > 0
                      ? "text-[#6556d2] bg-[#6556d2]/10 hover:bg-[#6556d2]/20 cursor-pointer"
                      : "text-gray-400 bg-gray-100 cursor-default"
                  }`}
                >
                  Upcoming Deadlines:
                  <span className={`inline-flex items-center justify-center h-5 min-w-[20px] px-1 text-[11px] font-bold rounded-full ${
                    upcomingInRange.length > 0 ? "text-white bg-[#6556d2]" : "text-gray-400 bg-gray-200"
                  }`}>
                    {isLoading ? "\u2026" : upcomingInRange.length}
                  </span>
                  {upcomingInRange.length > 1 && (
                    <svg className={`h-3.5 w-3.5 transition-transform ${upcomingDropdownOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  )}
                </button>

                {/* Dropdown Menu */}
                {upcomingDropdownOpen && (
                  <div
                    ref={dropdownRef}
                    className="absolute right-0 top-full mt-2 w-[340px] max-h-[280px] overflow-auto bg-white rounded-xl shadow-2xl border border-gray-200 z-[70] animate-in fade-in slide-in-from-top-1"
                    style={{ animation: "dropdownIn 0.15s ease-out" }}
                  >
                    <div className="px-3.5 py-2.5 border-b border-gray-100 bg-gray-50/70 rounded-t-xl">
                      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Jump to deadline</p>
                    </div>
                    <div className="py-1">
                      {upcomingInRange.map((entry, i) => {
                        const cat = getColorCategory(entry.daysRemaining);
                        const c = COLOR_MAP[cat];
                        return (
                          <button
                            key={`${entry.Id}-${i}`}
                            onClick={() => jumpToEntry(entry)}
                            className="w-full text-left px-3.5 py-2.5 flex items-center gap-3 hover:bg-[#6556d2]/5 transition-colors cursor-pointer group"
                          >
                            <span className={`flex-shrink-0 h-2.5 w-2.5 rounded-full ${c.dot}`} />
                            <div className="min-w-0 flex-1">
                              <p className="text-[12px] font-semibold text-gray-800 truncate group-hover:text-[#6556d2] transition-colors">
                                {entry.FileName}
                              </p>
                              <p className="text-[10px] text-gray-400 mt-0.5">{entry.Description || "No description"}</p>
                            </div>
                            <div className="flex-shrink-0 text-right">
                              <span className={`inline-block text-[11px] font-bold ${c.text}`}>
                                {entry.Date}
                              </span>
                              <p className={`text-[9px] font-semibold mt-0.5 ${c.text}`}>
                                {entry.daysRemaining === 0 ? "Today" : `${entry.daysRemaining}d`}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Loading / Error ── */}
          {isLoading && (
            <div className="flex items-center justify-center py-24 gap-2">
              <svg className="h-6 w-6 animate-spin text-[#6556d2]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm text-gray-400">Loading calendar\u2026</span>
            </div>
          )}

          {error && !isLoading && (
            <div className="mx-6 mt-4 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-xs text-amber-700">
              <svg className="h-4 w-4 flex-shrink-0 text-amber-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          {/* ── Calendar Grid ── */}
          {!isLoading && (
            <div className="px-6 pt-4 pb-2 overflow-auto flex-1">
              {/* Weekday headers */}
              <div className="grid grid-cols-7 mb-px">
                {WEEKDAYS.map((d) => (
                  <div key={d} className="text-center text-[11px] font-semibold text-gray-400 uppercase tracking-widest py-2">
                    {d}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 border-l border-t border-gray-200">
                {grid.map((cell, idx) => {
                  if (!cell) {
                    return <div key={`empty-${idx}`} className="border-r border-b border-gray-200 bg-gray-200 min-h-[88px] relative"><div className="absolute inset-0 bg-gray-900/10" /></div>;
                  }

                  const dayNum = cell.getDate();
                  const cellDay = startOfDay(cell);
                  const inRange = cellDay >= startOfDay(rangeStart) && cellDay <= startOfDay(rangeEnd);
                  const isToday = isSameDay(cell, today);
                  const showToday = isToday && inRange;
                  const dayEntries = inRange ? (entriesByDay.get(dayNum.toString()) || []) : [];

                  // ── Disabled day (outside range) ──
                  if (!inRange) {
                    return (
                      <div
                        key={dayNum}
                        className="border-r border-b border-gray-200 min-h-[88px] p-1.5 bg-gray-200 pointer-events-none select-none relative"
                      >
                        <div className="absolute inset-0 bg-gray-900/10" />
                        <span className="inline-flex items-center justify-center h-7 w-7 text-[13px] font-semibold rounded-full text-gray-500 opacity-40 relative">
                          {dayNum}
                        </span>
                      </div>
                    );
                  }

                  // ── Active day (within range) ──
                  const cellIso = toISODate(cell);
                  const isHighlighted = highlightedDay === cellIso;
                  return (
                    <div
                      key={dayNum}
                      className={`border-r border-b border-gray-200 min-h-[88px] p-1.5 bg-white transition-all duration-300 ${
                        showToday ? "ring-2 ring-inset ring-[#6556d2]/60" : ""
                      } ${isHighlighted ? "ring-2 ring-inset ring-amber-400 bg-amber-50/50 calendar-pulse" : ""}`}
                    >
                      <span className={`inline-flex items-center justify-center h-7 w-7 text-[13px] font-semibold rounded-full ${
                        showToday ? "bg-[#6556d2] text-white" : "text-gray-700"
                      }`}>
                        {dayNum}
                      </span>

                      <div className="mt-0.5 space-y-0.5">
                        {dayEntries.slice(0, 2).map((e, i) => {
                          const cat = getColorCategory(e.daysRemaining);
                          const c = COLOR_MAP[cat];
                          return (
                            <button
                              key={`${e.Id}-${i}`}
                              onClick={() => setSelectedEntry(e)}
                              className={`w-full text-left px-1.5 py-[3px] text-[10px] font-medium rounded truncate border cursor-pointer transition-opacity hover:opacity-80 ${c.bg} ${c.text} ${c.border}`}
                              title={`${e.FileName} \u2014 ${e.Date}`}
                            >
                              {e.FileName}
                            </button>
                          );
                        })}
                        {dayEntries.length > 2 && (
                          <span className="block text-[10px] text-gray-400 pl-1 cursor-default">+{dayEntries.length - 2} more</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Legend (Bottom) ── */}
          <div className="px-6 py-3 border-t border-gray-100 flex items-center gap-5 flex-shrink-0">
            {LEGEND.map((l) => (
              <span key={l.key} className="inline-flex items-center gap-1.5 text-[11px] text-gray-500">
                <span className={`inline-block h-2.5 w-2.5 rounded-full flex-shrink-0 ${COLOR_MAP[l.key].dot}`} />
                {l.label}
              </span>
            ))}
          </div>

          {/* ── Footer ── */}
          <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-end flex-shrink-0 bg-white">
            <button
              onClick={onClose}
              className="px-5 py-2 text-sm font-medium text-white bg-[#6556d2] rounded-lg hover:bg-[#5445b5] transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Quick Actions modal on top of calendar */}
      {selectedEntry && (
        <QuickActionsModal
          entry={selectedEntry}
          milestones={milestones}
          onClose={() => setSelectedEntry(null)}
          onCloseCalendar={onCloseCalendar}
          onInfo={onInfo}
          onImportantInfo={onImportantInfo}
          onDeadlines={onDeadlines}
        />
      )}
    </>
  );
}

// ── Main Exported Component (2-step flow) ────────────────────────────────────

interface DeadlineCalendarProps {
  milestones: Milestone[];
  onInfo: (m: Milestone) => void;
  onImportantInfo: (m: Milestone) => void;
  onDeadlines: (m: Milestone) => void;
}

type CalendarStep = "closed" | "timeframe" | "calendar";

export default function DeadlineCalendar({ milestones, onInfo, onImportantInfo, onDeadlines }: DeadlineCalendarProps) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const [step, setStep] = useState<CalendarStep>("closed");
  const [entries, setEntries] = useState<ParsedCalendarEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rangeStart, setRangeStart] = useState<Date>(today);
  const [rangeEnd, setRangeEnd] = useState<Date>(today);

  // Persisted ISO date strings (survive modal close/reopen within the session)
  const [persistedStartISO, setPersistedStartISO] = useState<string | null>(null);
  const [persistedEndISO, setPersistedEndISO] = useState<string | null>(null);

  // Count of upcoming deadlines for the header badge (across all fetched data)
  const upcomingCount = useMemo(() => entries.filter((e) => e.daysRemaining >= 0).length, [entries]);

  // Unique document count
  const uniqueDocCount = useMemo(() => {
    const set = new Set(entries.map((e) => e.FileName));
    return set.size || milestones.length;
  }, [entries, milestones]);

  // handleOpen: if dates are persisted, skip the timeframe modal and go straight to the calendar
  const handleOpen = useCallback(() => {
    if (persistedStartISO && persistedEndISO) {
      // Re-enter directly — reuse persisted entries if available, otherwise re-fetch
      if (entries.length > 0) {
        setStep("calendar");
      } else {
        // Need to re-fetch (e.g., entries were cleared)
        setStep("calendar");
        setIsLoading(true);
        setError(null);
        const url = `https://20.110.72.120.nip.io/webhook/calendar/timeframe?start_date=${persistedStartISO}&end_date=${persistedEndISO}`;
        fetch(url)
          .then(async (res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const text = await res.text();
            if (!text) { setEntries([]); return; }
            const json = JSON.parse(text);
            let mapped: CalendarEntry[] = [];
            if (json?.calendar && Array.isArray(json.calendar)) {
              for (const dayGroup of json.calendar) {
                if (dayGroup.items && Array.isArray(dayGroup.items)) {
                  for (const item of dayGroup.items) {
                    const dp = item.date_parsed || dayGroup.date || "";
                    const [y, m, d] = dp.split("-");
                    const ddmmyyyy = d && m && y ? `${d}.${m}.${y}` : dp;
                    mapped.push({ Id: `${item.file_name}-${dp}`, FileName: item.file_name || "", Date: ddmmyyyy, Description: item.description || "" });
                  }
                }
              }
            } else {
              mapped = (Array.isArray(json) ? json : [json]).filter((e: CalendarEntry) => e?.Date && e?.FileName);
            }
            setEntries(mapped.filter((e) => e.Date && e.FileName).map((e) => {
              const parsed = parseDDMMYYYY(e.Date);
              return { ...e, parsed, daysRemaining: calcDaysRemaining(parsed, today) };
            }));
          })
          .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load"))
          .finally(() => setIsLoading(false));
      }
    } else {
      setStep("timeframe");
    }
  }, [persistedStartISO, persistedEndISO, entries.length, today]);

  const handleClose = useCallback(() => setStep("closed"), []);
  const handleChangeRange = useCallback(() => setStep("timeframe"), []);

  const handleGenerate = useCallback(async (startISO: string, endISO: string) => {
    const [sy, sm, sd] = startISO.split("-").map(Number);
    const [ey, em, ed] = endISO.split("-").map(Number);
    setRangeStart(new Date(sy, sm - 1, sd));
    setRangeEnd(new Date(ey, em - 1, ed));
    // Persist for session re-entry
    setPersistedStartISO(startISO);
    setPersistedEndISO(endISO);
    setStep("calendar");
    setIsLoading(true);
    setError(null);
    setEntries([]);

    try {
      const url = `https://20.110.72.120.nip.io/webhook/calendar/timeframe?start_date=${startISO}&end_date=${endISO}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (!text) { setEntries([]); return; }
      const json = JSON.parse(text);

      // Handle new API format: { calendar: [{ date, items: [{ file_name, date_parsed, description }] }] }
      let mapped: CalendarEntry[] = [];
      if (json && json.calendar && Array.isArray(json.calendar)) {
        for (const dayGroup of json.calendar) {
          if (dayGroup.items && Array.isArray(dayGroup.items)) {
            for (const item of dayGroup.items) {
              // Convert YYYY-MM-DD to DD.MM.YYYY for internal consistency
              const dp = item.date_parsed || dayGroup.date || "";
              const [y, m, d] = dp.split("-");
              const ddmmyyyy = d && m && y ? `${d}.${m}.${y}` : dp;
              mapped.push({
                Id: `${item.file_name}-${dp}`,
                FileName: item.file_name || "",
                Date: ddmmyyyy,
                Description: item.description || "",
              });
            }
          }
        }
      } else {
        // Fallback: legacy flat array format
        const raw: CalendarEntry[] = (Array.isArray(json) ? json : [json])
          .filter((e: CalendarEntry) => e && e.Date && e.FileName);
        mapped = raw;
      }

      setEntries(
        mapped
          .filter((e) => e.Date && e.FileName)
          .map((e) => {
            const parsed = parseDDMMYYYY(e.Date);
            return { ...e, parsed, daysRemaining: calcDaysRemaining(parsed, today) };
          })
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setIsLoading(false);
    }
  }, [today]);

  return (
    <>
      {/* ── Header Trigger Button ── */}
      <button
        onClick={handleOpen}
        title="Open Deadline Calendar"
        className="relative inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-white bg-[#6556d2] rounded-lg hover:bg-[#5445b5] transition-colors cursor-pointer"
      >
        <CalendarIcon className="h-4 w-4" />
        Calendar
        {upcomingCount > 0 && step === "closed" && (
          <span className="inline-flex items-center justify-center h-[18px] min-w-[18px] px-1 text-[10px] font-bold text-[#6556d2] bg-white rounded-full">
            {upcomingCount}
          </span>
        )}
        {/* Notification dot */}
        {upcomingCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
        )}
      </button>

      {/* Step 1 — portal */}
      {step === "timeframe" && createPortal(
        <TimeframeModal
          onGenerate={handleGenerate}
          onClose={handleClose}
          initialStart={persistedStartISO || undefined}
          initialEnd={persistedEndISO || undefined}
        />,
        document.body
      )}

      {/* Step 2 — portal */}
      {step === "calendar" && createPortal(
        <CalendarViewModal
          entries={entries}
          isLoading={isLoading}
          error={error}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          milestones={milestones}
          totalDocuments={uniqueDocCount}
          onClose={handleClose}
          onCloseCalendar={handleClose}
          onChangeRange={handleChangeRange}
          onInfo={onInfo}
          onImportantInfo={onImportantInfo}
          onDeadlines={onDeadlines}
        />,
        document.body
      )}
    </>
  );
}
