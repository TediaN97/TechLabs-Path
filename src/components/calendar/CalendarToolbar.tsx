// ── CalendarToolbar ─────────────────────────────────────────────────────────
//
// Composes the calendar toolbar: month navigation, Today button, and
// upcoming-deadlines badge. Owns no state — all values and handlers
// come from props.

// ── Icons ───────────────────────────────────────────────────────────────────

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

// ── Props ───────────────────────────────────────────────────────────────────

interface CalendarToolbarProps {
  /** Display label for the current month, e.g. "March 2026" */
  monthLabel: string;
  /** Number of upcoming (non-overdue) deadlines */
  upcomingCount: number;
  /** Navigate to the previous month */
  onPrevMonth: () => void;
  /** Navigate to the next month */
  onNextMonth: () => void;
  /** Jump to today's month */
  onGoToToday: () => void;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function CalendarToolbar({
  monthLabel,
  upcomingCount,
  onPrevMonth,
  onNextMonth,
  onGoToToday,
}: CalendarToolbarProps) {
  return (
    <div className="px-6 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 flex-shrink-0">
      {/* Left: Month navigation */}
      <div className="flex items-center gap-2">
        <button
          onClick={onPrevMonth}
          className="p-1.5 text-gray-500 hover:text-[#6556d2] hover:bg-[#6556d2]/10 rounded-md transition-colors cursor-pointer"
          title="Previous month"
        >
          <ChevronLeftIcon />
        </button>
        <h4 className="text-sm font-semibold text-gray-800 min-w-[160px] text-center">
          {monthLabel}
        </h4>
        <button
          onClick={onNextMonth}
          className="p-1.5 text-gray-500 hover:text-[#6556d2] hover:bg-[#6556d2]/10 rounded-md transition-colors cursor-pointer"
          title="Next month"
        >
          <ChevronRightIcon />
        </button>
      </div>

      {/* Right: Today + Upcoming badge */}
      <div className="flex items-center gap-2">
        <button
          onClick={onGoToToday}
          className="px-2.5 py-1 text-[11px] font-medium text-[#6556d2] border border-[#6556d2]/30 rounded-md hover:bg-[#6556d2]/5 transition-colors cursor-pointer"
        >
          Today
        </button>

        {/* Upcoming Deadlines badge */}
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-[#6556d2] select-none">
          Deadlines:
          <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 text-[10px] font-bold text-white bg-[#6556d2] rounded-full">
            {upcomingCount}
          </span>
        </span>
      </div>
    </div>
  );
}
