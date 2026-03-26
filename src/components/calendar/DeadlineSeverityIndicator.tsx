import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import type { DeadlineSeverity } from "../../services/calendarTimeframe";

// ── DeadlineSeverityIndicator ────────────────────────────────────────────────
//
// Renders ONLY a red warning triangle icon inside a calendar day cell.
// No text, no label, no extra DOM content is rendered next to the icon.
//
// On hover (critical or past severity):
//   A portal-rendered floating tooltip appears after a short delay
//   showing contextual information about the deadlines in that cell.
//   On mouse leave the tooltip disappears.
//
// The tooltip never affects the calendar cell layout — it is rendered
// into document.body via createPortal.

// ── Types ────────────────────────────────────────────────────────────────────

export interface DeadlineTooltipItem {
  fileName: string;
  description: string | null;
  sectionTitle: string | null;
  severity: DeadlineSeverity;
}

// ── Props ────────────────────────────────────────────────────────────────────

interface DeadlineSeverityIndicatorProps {
  severity: DeadlineSeverity;
  /** Deadline items to show in the tooltip. Falls back to a generic message if empty. */
  items?: DeadlineTooltipItem[];
}

// ── Constants ────────────────────────────────────────────────────────────────

const TOOLTIP_DELAY_MS = 200;
const TOOLTIP_WIDTH = 280;
const TOOLTIP_HEIGHT_EST = 60;
const TOOLTIP_GAP = 6;

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildTooltipLines(
  severity: DeadlineSeverity,
  items?: DeadlineTooltipItem[]
): string[] {
  if (!items || items.length === 0) {
    return severity === "critical"
      ? ["Urgent action required — this deadline must be addressed immediately."]
      : ["Overdue — this deadline has passed."];
  }

  // Dedupe by fileName, pick relevant items matching this severity
  const relevant = items.filter((i) => i.severity === severity);
  const source = relevant.length > 0 ? relevant : items;

  const seen = new Set<string>();
  const lines: string[] = [];
  const MAX_LINES = 3;

  for (const item of source) {
    if (seen.has(item.fileName)) continue;
    seen.add(item.fileName);
    const desc = item.description || item.sectionTitle || null;
    const line = desc
      ? `${item.fileName}: ${desc}`
      : item.fileName;
    lines.push(line);
    if (lines.length >= MAX_LINES) break;
  }

  const remaining = new Set(source.map((i) => i.fileName)).size - lines.length;
  if (remaining > 0) {
    lines.push(`+${remaining} more`);
  }

  return lines;
}

// ── Floating Tooltip (portal into document.body) ─────────────────────────────

function FloatingTooltip({
  anchorRef,
  lines,
}: {
  anchorRef: React.RefObject<HTMLSpanElement | null>;
  lines: string[];
}) {
  const [pos, setPos] = useState({ top: 0, left: 0, below: true });

  function recompute() {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom >= TOOLTIP_HEIGHT_EST + TOOLTIP_GAP;
    let left = r.left + r.width / 2 - TOOLTIP_WIDTH / 2 + window.scrollX;
    left = Math.max(
      8 + window.scrollX,
      Math.min(left, window.innerWidth - TOOLTIP_WIDTH - 8 + window.scrollX)
    );
    const top = below
      ? r.bottom + TOOLTIP_GAP + window.scrollY
      : r.top - TOOLTIP_HEIGHT_EST - TOOLTIP_GAP + window.scrollY;
    setPos({ top, left, below });
  }

  useLayoutEffect(recompute, [anchorRef]);

  useEffect(() => {
    window.addEventListener("scroll", recompute, true);
    window.addEventListener("resize", recompute);
    return () => {
      window.removeEventListener("scroll", recompute, true);
      window.removeEventListener("resize", recompute);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div
      role="tooltip"
      style={{
        position: "absolute",
        top: pos.top,
        left: pos.left,
        zIndex: 9999,
        maxWidth: TOOLTIP_WIDTH,
      }}
      className="px-2.5 py-1.5 text-[10px] leading-snug font-medium text-white bg-gray-900 rounded-md shadow-lg pointer-events-none animate-[fadeIn_100ms_ease-out]"
    >
      {lines.map((line, i) => (
        <div key={i} className={i > 0 ? "mt-0.5 opacity-80" : ""}>
          {line}
        </div>
      ))}
      <span
        className="absolute left-1/2 -translate-x-1/2 w-0 h-0"
        style={
          pos.below
            ? {
                top: -4,
                borderLeft: "5px solid transparent",
                borderRight: "5px solid transparent",
                borderBottom: "4px solid rgb(17 24 39)",
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
  items,
}: DeadlineSeverityIndicatorProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isCritical = severity === "critical";
  const isPast = severity === "past";

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Only render for critical or past
  if (!isCritical && !isPast) return null;

  const color = isCritical ? "text-red-500" : "text-red-400";
  const srLabel = isCritical ? "Urgent deadline" : "Overdue deadline";
  const tooltipLines = buildTooltipLines(severity, items);

  return (
    <span
      ref={anchorRef}
      className={`${color} flex-shrink-0 leading-none`}
      tabIndex={0}
      aria-label={srLabel}
      aria-describedby={showTooltip ? "severity-tooltip" : undefined}
      onMouseEnter={() => {
        timerRef.current = setTimeout(() => setShowTooltip(true), TOOLTIP_DELAY_MS);
      }}
      onMouseLeave={() => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        setShowTooltip(false);
      }}
      onFocus={() => {
        timerRef.current = setTimeout(() => setShowTooltip(true), TOOLTIP_DELAY_MS);
      }}
      onBlur={() => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        setShowTooltip(false);
      }}
    >
      {/* Only the SVG icon — no text, no labels rendered in the cell */}
      <svg
        className="h-3 w-3"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>

      {/* Screen-reader-only label — visually hidden, zero layout */}
      <span className="sr-only">{srLabel}</span>

      {/* Portal tooltip — on hover/focus, for both critical and past */}
      {showTooltip && (
        <FloatingTooltip anchorRef={anchorRef} lines={tooltipLines} />
      )}
    </span>
  );
}
