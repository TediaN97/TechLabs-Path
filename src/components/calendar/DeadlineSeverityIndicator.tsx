import {
  useState,
  useEffect,
  useRef,
  useLayoutEffect,
} from "react";
import { createPortal } from "react-dom";
import type { DeadlineSeverity } from "../../services/calendarTimeframe";

// ── DeadlineSeverityIndicator ────────────────────────────────────────────────
//
// Renders the severity icon for a calendar day cell. For critical deadlines
// it shows a red warning triangle with a portal-rendered floating tooltip.
//
// Responsibilities:
//   • Render severity-appropriate icon and color
//   • Show a floating tooltip on hover (with delay) or keyboard focus
//   • Expose severity semantics via ARIA
//   • Remain layout-safe — tooltip is portal-rendered, never shifts cell
//
// The tooltip text for critical severity:
//   "Urgent action required — this deadline must be addressed immediately."

// ── Props ────────────────────────────────────────────────────────────────────

interface DeadlineSeverityIndicatorProps {
  /** The highest severity present on this calendar day */
  severity: DeadlineSeverity;
}

// ── Tooltip configuration ────────────────────────────────────────────────────

const TOOLTIP_TEXT =
  "Urgent action required — this deadline must be addressed immediately.";

const TOOLTIP_DELAY_MS = 200;

// ── Icons ────────────────────────────────────────────────────────────────────

function WarningTriangleIcon() {
  return (
    <svg
      className="h-3 w-3"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

// ── Floating Tooltip (portal-rendered) ───────────────────────────────────────

interface TooltipPosition {
  top: number;
  left: number;
  placement: "below" | "above";
}

function FloatingTooltip({
  anchorRef,
  text,
}: {
  anchorRef: React.RefObject<HTMLSpanElement | null>;
  text: string;
}) {
  const [position, setPosition] = useState<TooltipPosition>({
    top: 0,
    left: 0,
    placement: "below",
  });
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Compute position from anchor bounding rect
  useLayoutEffect(() => {
    computePosition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-position on scroll / resize
  useEffect(() => {
    function handleReposition() {
      computePosition();
    }
    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);
    return () => {
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function computePosition() {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const tooltipHeight = 40; // estimate
    const tooltipWidth = 260; // estimate
    const gap = 6;

    const spaceBelow = window.innerHeight - rect.bottom;
    const openBelow = spaceBelow >= tooltipHeight + gap;

    // Center horizontally, clamp to viewport
    let left = rect.left + rect.width / 2 - tooltipWidth / 2 + window.scrollX;
    left = Math.max(8 + window.scrollX, Math.min(left, window.innerWidth - tooltipWidth - 8 + window.scrollX));

    const top = openBelow
      ? rect.bottom + gap + window.scrollY
      : rect.top - tooltipHeight - gap + window.scrollY;

    setPosition({ top, left, placement: openBelow ? "below" : "above" });
  }

  return createPortal(
    <div
      ref={tooltipRef}
      role="tooltip"
      style={{
        position: "absolute",
        top: position.top,
        left: position.left,
        zIndex: 9999,
        maxWidth: 260,
      }}
      className="px-2.5 py-1.5 text-[10px] leading-snug font-medium text-white bg-gray-900 rounded-md shadow-lg pointer-events-none animate-[fadeIn_100ms_ease-out]"
    >
      {text}
      {/* Arrow */}
      <span
        className="absolute left-1/2 -translate-x-1/2 w-0 h-0"
        style={
          position.placement === "below"
            ? {
                top: -4,
                borderLeft: "5px solid transparent",
                borderRight: "5px solid transparent",
                borderBottom: "4px solid rgb(17 24 39)", // gray-900
              }
            : {
                bottom: -4,
                borderLeft: "5px solid transparent",
                borderRight: "5px solid transparent",
                borderTop: "4px solid rgb(17 24 39)",
              }
        }
      />
    </div>,
    document.body
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export default function DeadlineSeverityIndicator({
  severity,
}: DeadlineSeverityIndicatorProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isCritical = severity === "critical";
  const isPast = severity === "past";

  // Clean up hover timer on unmount
  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  // Only render for critical or past severities
  if (!isCritical && !isPast) return null;

  const iconColor = isCritical ? "text-red-500" : "text-red-400";
  const ariaLabel = isCritical
    ? "Urgent deadline — action required immediately"
    : "Overdue deadline";

  // ── Hover handlers (with delay) ─────────────────────────────────────────

  function handleMouseEnter() {
    if (!isCritical) return;
    hoverTimerRef.current = setTimeout(() => {
      setShowTooltip(true);
    }, TOOLTIP_DELAY_MS);
  }

  function handleMouseLeave() {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setShowTooltip(false);
  }

  // ── Focus handlers ──────────────────────────────────────────────────────

  function handleFocus() {
    if (isCritical) setShowTooltip(true);
  }

  function handleBlur() {
    setShowTooltip(false);
  }

  // ── Keyboard: Escape closes tooltip ─────────────────────────────────────

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape" && showTooltip) {
      setShowTooltip(false);
    }
  }

  return (
    <span
      ref={anchorRef}
      className={`${iconColor} flex-shrink-0`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      // Focusable for keyboard users, but not in normal tab order unless critical
      tabIndex={isCritical ? 0 : -1}
      role="img"
      aria-label={ariaLabel}
      // Link to tooltip for assistive tech
      aria-describedby={showTooltip ? "deadline-severity-tooltip" : undefined}
    >
      <WarningTriangleIcon />

      {showTooltip && isCritical && (
        <FloatingTooltip anchorRef={anchorRef} text={TOOLTIP_TEXT} />
      )}
    </span>
  );
}
