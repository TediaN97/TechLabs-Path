import { useState, useCallback } from "react";
import type { CalendarActionType } from "../DeadlineCalendar";
import DeadlineDropdownButton from "./DeadlineDropdownButton";
import type { DeadlineModeType } from "./DeadlineDropdownButton";

// ── DeadlineModalActions ─────────────────────────────────────────────────────
//
// Renders the action row inside the deadline detail modal / popup.
// For each affected document it shows:
//   • Detail           — plain action button
//   • Important Info   — plain action button
//   • Deadlines        — dropdown action button (DeadlineDropdownButton)
//
// Modal-scoped state: each instance of DeadlineModalActions owns a
// `deadlineMode` value that persists while the modal is open. When the
// modal unmounts the state is discarded.

// ── Types (re-exported for parent convenience) ───────────────────────────────

export type { DeadlineModeType } from "./DeadlineDropdownButton";

export interface SelectedDeadlineContext {
  fileName: string;
  date: string;
  severity: string;
}

// ── Props ────────────────────────────────────────────────────────────────────

interface DeadlineModalActionsProps {
  /** Unique document file names for the selected day */
  documentsAffected: string[];
  /** Fires when any action is triggered (detail, importantInfo, deadlines) */
  onAction: (type: CalendarActionType, fileName: string) => void;
}

// ── Icons ────────────────────────────────────────────────────────────────────

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

// ── Shared button style (matches Detail button exactly) ──────────────────────

const ACTION_BTN =
  "inline-flex items-center gap-1 px-2 py-1.5 text-[10px] font-medium text-white bg-[#6556d2] rounded-md hover:bg-[#5445b5] transition-colors cursor-pointer";

// ── Component ────────────────────────────────────────────────────────────────

export default function DeadlineModalActions({
  documentsAffected,
  onAction,
}: DeadlineModalActionsProps) {
  // Modal-scoped deadline mode — shared across all documents in this modal
  const [deadlineMode, setDeadlineMode] = useState<DeadlineModeType>("vectorized");

  // Bridge mode change → action call
  const handleModeChange = useCallback(
    (mode: DeadlineModeType, fileName: string) => {
      setDeadlineMode(mode);
      const actionType: CalendarActionType =
        mode === "aiAnalyzed" ? "aiDeadlines" : "vectorDeadlines";
      onAction(actionType, fileName);
    },
    [onAction]
  );

  return (
    <div className="flex items-center gap-2 overflow-x-auto">
      {documentsAffected.slice(0, 3).map((fileName) => (
        <div key={fileName} className="flex items-center gap-1">
          {/* Detail */}
          <button
            onClick={() => onAction("detail", fileName)}
            title={`Detail: ${fileName}`}
            className={ACTION_BTN}
          >
            <InfoIcon />
            Detail
          </button>

          {/* Important Info */}
          <button
            onClick={() => onAction("importantInfo", fileName)}
            title={`Important Info: ${fileName}`}
            className={ACTION_BTN}
          >
            <SparklesIcon />
            Important Info
          </button>

          {/* Deadlines — dropdown action button (label always "Deadlines") */}
          <DeadlineDropdownButton
            value={deadlineMode}
            onDeadlineModeChange={(mode) => handleModeChange(mode, fileName)}
            instanceId={fileName}
          />
        </div>
      ))}
    </div>
  );
}
