import { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";

// ── DeadlineDropdownButton ───────────────────────────────────────────────────
//
// Action button with a **portal-rendered** floating dropdown menu for
// selecting the deadline mode.
//
// The trigger label is ALWAYS the fixed text "Deadlines" — it never changes.
// The selected option is reflected only inside the dropdown (highlighted
// with a checkmark), not in the button text.
//
// The dropdown menu is rendered via createPortal into document.body so it
// floats above all modal content. It does NOT:
//   • push layout content
//   • create scrollbars
//   • affect modal height
//   • render inline inside the action row
//
// Positioning is computed from the trigger button's bounding rect.
// By default the menu opens below; if there is not enough viewport space
// below, it flips above the button.

// ── Types ────────────────────────────────────────────────────────────────────

export type DeadlineModeType = "vectorized" | "aiAnalyzed";

interface DeadlineDropdownButtonProps {
  /** Currently selected mode */
  value: DeadlineModeType;
  /** Fires when the user picks a mode */
  onDeadlineModeChange: (mode: DeadlineModeType) => void;
  /** Unique id seed — avoids ARIA id collisions across multiple instances */
  instanceId?: string;
}

// ── Options ──────────────────────────────────────────────────────────────────

const MODE_OPTIONS: { value: DeadlineModeType; label: string }[] = [
  { value: "aiAnalyzed", label: "AI Analyzed" },
  { value: "vectorized", label: "Vectorized" },
];

/** Estimated height of the dropdown (2 items × ~28px + 8px padding). */
const MENU_HEIGHT_ESTIMATE = 64;

// ── Icons ────────────────────────────────────────────────────────────────────

function ClockIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function ChevronDownIcon({ flipped }: { flipped?: boolean }) {
  return (
    <svg
      className={`h-3 w-3 transition-transform duration-150 ${flipped ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// ── Button styles (matches Detail / Important Info buttons) ──────────────────

const ACTION_BTN_BASE =
  "inline-flex items-center gap-1 px-2 py-1.5 text-[10px] font-medium rounded-md transition-colors cursor-pointer";

const ACTION_BTN_CLOSED =
  `${ACTION_BTN_BASE} text-white bg-[#6556d2] hover:bg-[#5445b5]`;

const ACTION_BTN_OPEN =
  `${ACTION_BTN_BASE} text-white bg-[#5445b5] ring-2 ring-[#6556d2]/40`;

// ── DeadlineDropdownMenu (portal-rendered overlay) ───────────────────────────

interface MenuPosition {
  top: number;
  left: number;
}

interface DeadlineDropdownMenuProps {
  listboxId: string;
  value: DeadlineModeType;
  focusedIndex: number;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  listRef: React.RefObject<HTMLUListElement | null>;
  onSelect: (mode: DeadlineModeType) => void;
  onFocus: (index: number) => void;
}

function DeadlineDropdownMenu({
  listboxId,
  value,
  focusedIndex,
  anchorRef,
  listRef,
  onSelect,
  onFocus,
}: DeadlineDropdownMenuProps) {
  const [position, setPosition] = useState<MenuPosition>({ top: 0, left: 0 });

  // Compute position from anchor button rect
  useLayoutEffect(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openBelow = spaceBelow >= MENU_HEIGHT_ESTIMATE + 4;

    setPosition({
      top: openBelow
        ? rect.bottom + 4 + window.scrollY
        : rect.top - MENU_HEIGHT_ESTIMATE - 4 + window.scrollY,
      left: rect.left + window.scrollX,
    });
  }, [anchorRef]);

  // Re-position on scroll / resize while open
  useEffect(() => {
    function reposition() {
      if (!anchorRef.current) return;
      const rect = anchorRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const openBelow = spaceBelow >= MENU_HEIGHT_ESTIMATE + 4;
      setPosition({
        top: openBelow
          ? rect.bottom + 4 + window.scrollY
          : rect.top - MENU_HEIGHT_ESTIMATE - 4 + window.scrollY,
        left: rect.left + window.scrollX,
      });
    }
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [anchorRef]);

  return createPortal(
    <ul
      ref={listRef}
      id={listboxId}
      role="listbox"
      aria-label="Deadline mode"
      aria-activedescendant={
        focusedIndex >= 0
          ? `${listboxId}-opt-${MODE_OPTIONS[focusedIndex].value}`
          : undefined
      }
      style={{
        position: "absolute",
        top: position.top,
        left: position.left,
        zIndex: 9999,
      }}
      className="w-36 bg-white border border-gray-200 rounded-lg shadow-lg py-1 animate-[fadeIn_100ms_ease-out]"
    >
      {MODE_OPTIONS.map((option, idx) => {
        const isSelected = option.value === value;
        const isFocused = idx === focusedIndex;
        return (
          <li
            key={option.value}
            id={`${listboxId}-opt-${option.value}`}
            role="option"
            aria-selected={isSelected}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(option.value);
            }}
            onMouseEnter={() => onFocus(idx)}
            className={`flex items-center justify-between px-3 py-1.5 text-[11px] font-medium cursor-pointer transition-colors ${
              isFocused
                ? "bg-[#6556d2]/10 text-[#6556d2]"
                : isSelected
                  ? "text-[#6556d2]"
                  : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            <span>{option.label}</span>
            {isSelected && (
              <span className="text-[#6556d2]">
                <CheckIcon />
              </span>
            )}
          </li>
        );
      })}
    </ul>,
    document.body
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function DeadlineDropdownButton({
  value,
  onDeadlineModeChange,
  instanceId = "default",
}: DeadlineDropdownButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // ── Close on outside click (check both trigger and portal menu) ────────

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        listRef.current?.contains(target)
      ) {
        return; // click inside trigger or menu — ignore
      }
      setIsOpen(false);
      setFocusedIndex(-1);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // ── Selection handler ───────────────────────────────────────────────────

  const handleSelect = useCallback(
    (modeValue: DeadlineModeType) => {
      onDeadlineModeChange(modeValue);
      setIsOpen(false);
      setFocusedIndex(-1);
      requestAnimationFrame(() => triggerRef.current?.focus());
    },
    [onDeadlineModeChange]
  );

  // ── Keyboard navigation ─────────────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) {
        if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
          e.preventDefault();
          setIsOpen(true);
          setFocusedIndex(Math.max(0, MODE_OPTIONS.findIndex((o) => o.value === value)));
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setFocusedIndex((prev) => Math.min(prev + 1, MODE_OPTIONS.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setFocusedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < MODE_OPTIONS.length) {
            handleSelect(MODE_OPTIONS[focusedIndex].value);
          }
          break;
        case "Escape":
          e.preventDefault();
          setIsOpen(false);
          setFocusedIndex(-1);
          triggerRef.current?.focus();
          break;
        case "Tab":
          setIsOpen(false);
          setFocusedIndex(-1);
          break;
      }
    },
    [isOpen, focusedIndex, handleSelect, value]
  );

  // ── Scroll focused item into view ───────────────────────────────────────

  useEffect(() => {
    if (focusedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll("[role='option']");
      items[focusedIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [focusedIndex]);

  // ── Render ──────────────────────────────────────────────────────────────

  const listboxId = `deadline-mode-listbox-${instanceId}`;

  return (
    <>
      {/* Trigger — always shows "Deadlines", never the selected mode */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setIsOpen((prev) => !prev);
          if (!isOpen) {
            setFocusedIndex(MODE_OPTIONS.findIndex((o) => o.value === value));
          }
        }}
        onKeyDown={handleKeyDown}
        className={isOpen ? ACTION_BTN_OPEN : ACTION_BTN_CLOSED}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        title="Deadlines"
      >
        <ClockIcon />
        Deadlines
        <ChevronDownIcon flipped={isOpen} />
      </button>

      {/* Portal-rendered floating dropdown — never affects modal layout */}
      {isOpen && (
        <DeadlineDropdownMenu
          listboxId={listboxId}
          value={value}
          focusedIndex={focusedIndex}
          anchorRef={triggerRef}
          listRef={listRef}
          onSelect={handleSelect}
          onFocus={setFocusedIndex}
        />
      )}
    </>
  );
}
