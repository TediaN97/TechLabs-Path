import { type FormEvent, useState, useRef, useEffect, useCallback } from "react";

// ── Types ───────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  rawJson?: unknown;
  intent?: string;
}

// ── Icons ───────────────────────────────────────────────────────────────────────

function SendIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22 11 13 2 9z" />
    </svg>
  );
}

// function UploadIcon() {
//   return (
//     <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//       <path
//         strokeLinecap="round"
//         strokeLinejoin="round"
//         strokeWidth={2}
//         d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
//       />
//     </svg>
//   );
// }

// ── Thinking status messages ─────────────────────────────────────────────────

const THINKING_STEPS = [
  { message: "Analyzing your document structure...", delay: 0 },
  { message: "Scanning for complex legal clauses and entities...", delay: 10000 },
  { message: "Extracting financial data and cross-referencing...", delay: 20000 },
  { message: "Synthesizing final report. Almost finished...", delay: 30000 },
];

/** Threshold: show thinking messages immediately if prompt is long */
const COMPLEX_PROMPT_LENGTH = 100;
/** Threshold: show thinking messages after this many ms for short prompts */
const THINKING_DELAY_MS = 3000;

function ThinkingIndicator({ showImmediately }: { showImmediately: boolean }) {
  const [stepIdx, setStepIdx] = useState(0);
  const [visible, setVisible] = useState(showImmediately);
  const [fading, setFading] = useState(false);
  const startRef = useRef(Date.now());

  useEffect(() => {
    startRef.current = Date.now();
    setStepIdx(0);
    if (showImmediately) {
      setVisible(true);
    }
  }, [showImmediately]);

  useEffect(() => {
    const id = setInterval(() => {
      const elapsed = Date.now() - startRef.current;

      // For short prompts, only show after THINKING_DELAY_MS
      if (!showImmediately && !visible && elapsed >= THINKING_DELAY_MS) {
        setVisible(true);
      }

      // Advance step based on elapsed time
      for (let i = THINKING_STEPS.length - 1; i >= 0; i--) {
        if (elapsed >= THINKING_STEPS[i].delay) {
          if (i !== stepIdx) {
            setFading(true);
            setTimeout(() => {
              setStepIdx(i);
              setFading(false);
            }, 300);
          }
          break;
        }
      }
    }, 1000);

    // Also check once early for the visibility trigger (short prompts)
    const earlyId = !showImmediately ? setTimeout(() => {
      setVisible(true);
    }, THINKING_DELAY_MS) : undefined;

    return () => {
      clearInterval(id);
      if (earlyId) clearTimeout(earlyId);
    };
  }, [showImmediately, visible, stepIdx]);

  return (
    <div className="flex items-start gap-2 mb-3">
      <div className="flex-shrink-0 h-7 w-7 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-500">
        AI
      </div>
      <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-white border border-gray-100 shadow-sm">
        {visible ? (
          <div className={`flex items-center gap-2 transition-opacity duration-300 ${fading ? "opacity-0" : "opacity-100"}`}>
            <svg className="h-3.5 w-3.5 animate-spin text-[#6556d2] flex-shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm italic text-gray-500">{THINKING_STEPS[stepIdx].message}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#6556d2] animate-pulse" />
            <span className="h-2 w-2 rounded-full bg-[#6556d2] animate-pulse [animation-delay:0.2s]" />
            <span className="h-2 w-2 rounded-full bg-[#6556d2] animate-pulse [animation-delay:0.4s]" />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Upload progress indicator ─────────────────────────────────────────────────

function FileDocIcon() {
  return (
    <svg className="h-4 w-4 text-[#6556d2]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

const UPLOAD_STEPS = [
  () => `Analyzing your document structure...`,
  () => "Scanning for complex legal clauses and entities...",
  () => "Extracting financial data and cross-referencing...",
  () => "Synthesizing final report. Almost finished...",
];
const UPLOAD_THRESHOLDS = [10000, 20000, 30000]; // ms

function UploadProgressBubble({ fileName }: { fileName: string }) {
  const [step, setStep] = useState(0);
  const [fading, setFading] = useState(false);
  const startRef = useRef(Date.now());

  useEffect(() => {
    startRef.current = Date.now();
    setStep(0);
    const id = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      let newStep = 0;
      if (elapsed >= UPLOAD_THRESHOLDS[2]) newStep = 3;
      else if (elapsed >= UPLOAD_THRESHOLDS[1]) newStep = 2;
      else if (elapsed >= UPLOAD_THRESHOLDS[0]) newStep = 1;

      setStep((prev) => {
        if (newStep !== prev) {
          setFading(true);
          setTimeout(() => setFading(false), 300);
        }
        return newStep;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-start gap-2 mb-3 flex-row-reverse">
      <div className="flex-shrink-0 h-7 w-7 rounded-full bg-[#6556d2] flex items-center justify-center text-[10px] font-bold text-white">
        You
      </div>
      <div className="max-w-[75%] px-4 py-2.5 text-sm leading-relaxed bg-[#f0effb] text-[#3b2e7e] rounded-2xl rounded-tr-sm">
        <div className="flex items-center gap-2 mb-1">
          <FileDocIcon />
          <span className="font-medium truncate">{fileName}</span>
        </div>
        <div className={`flex items-center gap-2 transition-opacity duration-300 ${fading ? "opacity-0" : "opacity-100"}`}>
          <svg className="h-3.5 w-3.5 animate-spin text-[#6556d2] flex-shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-xs text-[#6556d2]">{UPLOAD_STEPS[step]()}</span>
        </div>
      </div>
    </div>
  );
}

// ── Table data detection & rendering ─────────────────────────────────────────

interface TableData {
  columns: string[];
  rows: unknown[][];
}

/** ISO date pattern: 2024-01-15 or 2024-01-15T... */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T|$)/;

/** Looks like a number (including currency-prefixed like $1,234.56) */
function isNumericValue(v: unknown): boolean {
  if (typeof v === "number") return true;
  if (typeof v !== "string") return false;
  const cleaned = v.replace(/[$€£¥,\s]/g, "");
  return cleaned.length > 0 && !isNaN(Number(cleaned));
}

import { formatStandardDate } from "../utils/formatDate";

/** Format ISO date string to MM/DD/YYYY HH:MM:SS AM/PM */
function formatDate(v: string): string {
  return formatStandardDate(v);
}

/** Format a cell value for display */
function formatCell(v: unknown): string {
  if (v == null) return "—";
  const s = String(v);
  if (s === "") return "—";
  if (ISO_DATE_RE.test(s)) return formatDate(s);
  return s;
}

/**
 * Extract table data from the rawJson response.
 * Looks for { columns: [...], rows: [[...], ...] } in the response array.
 */
function extractTableData(rawJson: unknown): TableData | null {
  if (!rawJson) return null;
  const items = Array.isArray(rawJson) ? rawJson : [rawJson];
  for (const item of items) {
    if (item && typeof item === "object") {
      const obj = item as Record<string, unknown>;
      if (Array.isArray(obj.columns) && Array.isArray(obj.rows)) {
        const columns = obj.columns.map(String);
        const rows = (obj.rows as unknown[][]).map((row) =>
          Array.isArray(row) ? row : columns.map((c) => (row as Record<string, unknown>)?.[c])
        );
        if (columns.length > 0) return { columns, rows };
      }
    }
  }
  return null;
}

function TableRenderer({ data }: { data: TableData }) {
  return (
    <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            {data.columns.map((col) => (
              <th
                key={col}
                className="px-4 py-2 text-left text-xs font-semibold text-white uppercase tracking-wider bg-[#6556d2] border-b border-[#5445b5] whitespace-nowrap"
              >
                {col.replace(/_/g, " ")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, ri) => (
            <tr
              key={ri}
              className={`${
                ri % 2 === 0 ? "bg-white" : "bg-[#f8f7ff]"
              } hover:bg-[#eeedfa] transition-colors`}
            >
              {row.map((cell, ci) => {
                const formatted = formatCell(cell);
                const numeric = isNumericValue(cell);
                return (
                  <td
                    key={ci}
                    className={`px-4 py-2 border-b border-slate-100 whitespace-nowrap ${
                      numeric ? "text-right tabular-nums" : ""
                    }`}
                  >
                    {formatted}
                  </td>
                );
              })}
            </tr>
          ))}
          {data.rows.length === 0 && (
            <tr>
              <td
                colSpan={data.columns.length}
                className="px-4 py-4 text-center text-gray-400 italic"
              >
                No data rows returned.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── JSON code block icon ─────────────────────────────────────────────────────

function CodeIcon() {
  return (
    <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

// ── Feedback Icons ──────────────────────────────────────────────────────────────

function ThumbsUpIcon({ filled }: { filled?: boolean }) {
  return filled ? (
    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M2 20h2V10H2v10zm20-9a2 2 0 00-2-2h-6.32l.95-4.57.03-.32a1.5 1.5 0 00-.44-1.06L13.17 2 7.59 7.59A1.98 1.98 0 007 9v10a2 2 0 002 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" />
    </svg>
  ) : (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" />
    </svg>
  );
}

function ThumbsDownIcon({ filled }: { filled?: boolean }) {
  return filled ? (
    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M22 4h-2v10h2V4zM2 13a2 2 0 002 2h6.32l-.95 4.57-.03.32c0 .4.17.78.44 1.06L10.83 22l5.58-5.59A1.98 1.98 0 0017 15V5a2 2 0 00-2-2H6c-.83 0-1.54.5-1.84 1.22L1.14 11.27c-.09.23-.14.47-.14.73v2z" />
    </svg>
  ) : (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10zM17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17" />
    </svg>
  );
}

// ── Feedback endpoints ──────────────────────────────────────────────────────────

const FEEDBACK_POSITIVE_URL = "https://20.110.72.120.nip.io/webhook/feedback/positive";
const FEEDBACK_NEGATIVE_URL = "https://20.110.72.120.nip.io/webhook/feedback/negative";

const FEEDBACK_INTENTS = new Set(["query_only", "query_and_send"]);

function getSessionId(): string {
  try {
    return localStorage.getItem("techpath_session_id") || "";
  } catch {
    return "";
  }
}

// ── Negative Feedback Modal ────────────────────────────────────────────────────

function NegativeFeedbackModal({
  onSubmit,
  onCancel,
  isSubmitting,
}: {
  onSubmit: (comment: string) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}) {
  const [comment, setComment] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3.5 bg-[#6556d2]">
          <h3 className="text-sm font-semibold text-white">What could be improved?</h3>
        </div>
        <div className="p-5">
          <textarea
            ref={textareaRef}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Tell us what needs improvement..."
            disabled={isSubmitting}
            className="w-full h-24 px-3 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#6556d2]/30 focus:border-[#6556d2]/40 disabled:opacity-50"
          />
        </div>
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(comment)}
            disabled={isSubmitting}
            className="px-3 py-1.5 text-xs font-medium text-white bg-[#6556d2] rounded-md hover:bg-[#5445b5] transition-colors cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? "Sending..." : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Message bubble ──────────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const [showJson, setShowJson] = useState(false);
  const hasJson = message.rawJson != null;
  const tableData = !isUser ? extractTableData(message.rawJson) : null;

  // Feedback state
  const showFeedback = !isUser && !!message.intent && FEEDBACK_INTENTS.has(message.intent);
  const [feedbackGiven, setFeedbackGiven] = useState<"up" | "down" | null>(null);
  const [showNegativeModal, setShowNegativeModal] = useState(false);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  const handleThumbsUp = useCallback(async () => {
    if (feedbackGiven) return;
    const sessionId = getSessionId();
    if (!sessionId) return;
    setFeedbackGiven("up");
    try {
      const res = await fetch(FEEDBACK_POSITIVE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });
      if (!res.ok) {
        console.warn("[Feedback] positive failed:", res.status);
        setFeedbackGiven(null);
      }
    } catch {
      setFeedbackGiven(null);
    }
  }, [feedbackGiven]);

  const handleThumbsDown = useCallback(() => {
    if (feedbackGiven) return;
    setShowNegativeModal(true);
  }, [feedbackGiven]);

  const handleNegativeSubmit = useCallback(async (comment: string) => {
    const sessionId = getSessionId();
    if (!sessionId) return;
    setIsSubmittingFeedback(true);
    try {
      const res = await fetch(FEEDBACK_NEGATIVE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, comment: comment.trim() }),
      });
      if (!res.ok) {
        console.warn("[Feedback] negative failed:", res.status);
        alert("Failed to submit feedback. Please try again.");
        setIsSubmittingFeedback(false);
        return;
      }
      setFeedbackGiven("down");
      setShowNegativeModal(false);
    } catch {
      alert("Failed to submit feedback. Please try again.");
    } finally {
      setIsSubmittingFeedback(false);
    }
  }, []);

  return (
    <div className={`flex items-start gap-2 mb-3 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar — clickable when rawJson exists */}
      <div
        onClick={hasJson ? () => setShowJson((v) => !v) : undefined}
        title={hasJson ? `View raw ${isUser ? "request" : "response"} JSON` : undefined}
        className={`flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold ${
          isUser
            ? "bg-[#6556d2] text-white"
            : "bg-gray-200 text-gray-500"
        } ${hasJson ? "cursor-pointer hover:ring-2 hover:ring-[#6556d2]/40 transition-shadow" : ""} ${
          showJson ? "ring-2 ring-[#6556d2]" : ""
        }`}
      >
        {isUser ? "You" : "AI"}
      </div>

      {/* Bubble + optional table + optional JSON block */}
      <div className={`${tableData ? "max-w-[90%]" : "max-w-[75%]"} ${isUser ? "text-right" : ""}`}>
        <div
          className={`px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
            isUser
              ? "bg-[#f0effb] text-[#3b2e7e] rounded-2xl rounded-tr-sm"
              : `bg-white text-gray-700 border border-gray-100 shadow-sm ${tableData ? "rounded-t-2xl rounded-tl-sm" : "rounded-2xl rounded-tl-sm"}`
          }`}
        >
          {message.content}
        </div>

        {/* Structured data table */}
        {tableData && (
          <div className="bg-white border border-t-0 border-gray-100 shadow-sm rounded-b-2xl overflow-hidden pb-1">
            <TableRenderer data={tableData} />
          </div>
        )}

        {/* Feedback controls — only for qualifying intents */}
        {showFeedback && (
          <div className="flex items-center gap-1 mt-1">
            <button
              onClick={handleThumbsUp}
              disabled={!!feedbackGiven}
              title="Good response"
              className={`p-1 rounded transition-colors cursor-pointer ${
                feedbackGiven === "up"
                  ? "text-green-600"
                  : feedbackGiven
                    ? "text-gray-300 cursor-default"
                    : "text-gray-400 hover:text-green-600 hover:bg-green-50"
              }`}
            >
              <ThumbsUpIcon filled={feedbackGiven === "up"} />
            </button>
            <button
              onClick={handleThumbsDown}
              disabled={!!feedbackGiven}
              title="Needs improvement"
              className={`p-1 rounded transition-colors cursor-pointer ${
                feedbackGiven === "down"
                  ? "text-red-500"
                  : feedbackGiven
                    ? "text-gray-300 cursor-default"
                    : "text-gray-400 hover:text-red-500 hover:bg-red-50"
              }`}
            >
              <ThumbsDownIcon filled={feedbackGiven === "down"} />
            </button>
            {feedbackGiven && (
              <span className="text-[10px] text-gray-400 ml-1">Thanks for your feedback</span>
            )}
          </div>
        )}

        {/* Togglable JSON debug view */}
        {showJson && hasJson && (
          <div className={`mt-1.5 rounded-lg border border-[#6556d2]/20 overflow-hidden ${isUser ? "text-left" : ""}`}>
            <div className="flex items-center justify-between px-3 py-1.5 bg-[#6556d2]/5 border-b border-[#6556d2]/10">
              <span className="text-[10px] font-semibold text-[#6556d2] uppercase tracking-wider flex items-center gap-1">
                <CodeIcon />
                {isUser ? "Request JSON" : "Response JSON"}
              </span>
              <button
                onClick={() => setShowJson(false)}
                className="text-[10px] text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                &times;
              </button>
            </div>
            <pre className="px-3 py-2.5 text-[11px] leading-relaxed font-mono text-gray-300 bg-[#1e1e1e] overflow-x-auto max-h-64 overflow-y-auto whitespace-pre">
              {JSON.stringify(message.rawJson, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Negative feedback modal */}
      {showNegativeModal && (
        <NegativeFeedbackModal
          onSubmit={handleNegativeSubmit}
          onCancel={() => setShowNegativeModal(false)}
          isSubmitting={isSubmittingFeedback}
        />
      )}
    </div>
  );
}

// ── Constants ────────────────────────────────────────────────────────────────────

/** Max height in px before the textarea becomes internally scrollable (~7 lines) */
const TEXTAREA_MAX_HEIGHT = 200;

// ── Example prompt suggestions ──────────────────────────────────────────────────

const EXAMPLE_PROMPTS = [
  "Extract borrowers and lenders from the document",
  "Find contracts missing insurance requirements",
  "Show documents with defined extension rights",
  "List agreements with guarantors",
  "Extract loan purpose from all documents",
  "Find missing reporting requirements",
  "Summarize key terms of this agreement",
  "Find documents with missing approvals",
  "List contracts with events of default",
  "Check which fields are incomplete",
];

/** Number of prompt chips visible at once */
const VISIBLE_PROMPTS = 4;
/** Rotation interval in ms */
const ROTATION_INTERVAL_MS = 5_000;

/** Pick `count` unique random prompts from EXAMPLE_PROMPTS */
function pickInitialPrompts(count: number): string[] {
  const shuffled = [...EXAMPLE_PROMPTS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// ── Component ───────────────────────────────────────────────────────────────────

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (text: string, structuredFile?: File) => void;
  onFileUpload: (file: File) => void;
  isLoading: boolean;
  isUploading?: boolean;
  uploadingFileName?: string;
  /** When set, populates the chat input with this value (for reload mode) */
  pendingInput?: string | null;
  /** Called after the pending input has been consumed */
  onPendingInputConsumed?: () => void;
  /** Whether reload mode is active (shows indicator) */
  isReloadMode?: boolean;
  /** Name of the file being updated in reload mode */
  reloadFileName?: string;
  /** Called to cancel reload mode */
  onCancelReload?: () => void;
  /** Called to clear all chat messages and reset session memory */
  onClearChat?: () => void;
}

export default function ChatInterface({
  messages,
  onSendMessage,
  onFileUpload,
  isLoading,
  isUploading = false,
  uploadingFileName = "",
  pendingInput,
  onPendingInputConsumed,
  isReloadMode = false,
  reloadFileName = "",
  onCancelReload,
  onClearChat,
}: ChatInterfaceProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const structuredFileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputValueRef = useRef("");
  const [structuredFile, setStructuredFile] = useState<File | null>(null);

  // ── Rotating prompt suggestions (single-item replacement) ──────────────────
  const [visiblePrompts, setVisiblePrompts] = useState(() => pickInitialPrompts(VISIBLE_PROMPTS));
  const hoveredRef = useRef(false);

  useEffect(() => {
    // Only rotate when the empty state is visible
    if (messages.length > 0 || isLoading) return;
    const id = setInterval(() => {
      if (hoveredRef.current) return; // pause while hovering
      setVisiblePrompts((prev) => {
        // Pick a random slot to replace
        const slotIdx = Math.floor(Math.random() * prev.length);
        // Pick a replacement that isn't already visible
        const candidates = EXAMPLE_PROMPTS.filter((p) => !prev.includes(p));
        if (candidates.length === 0) return prev;
        const replacement = candidates[Math.floor(Math.random() * candidates.length)];
        const next = [...prev];
        next[slotIdx] = replacement;
        return next;
      });
    }, ROTATION_INTERVAL_MS);
    return () => clearInterval(id);
  }, [messages.length, isLoading]);

  function handlePromptClick(text: string) {
    inputValueRef.current = text;
    if (textareaRef.current) {
      // Set value via native setter so React picks it up
      textareaRef.current.value = text;
      textareaRef.current.focus();
      resizeTextarea();
    }
  }

  // ── Auto-resize textarea to fit content ──────────────────────────────────
  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    // Reset to single-row so scrollHeight recalculates correctly
    el.style.height = "auto";
    // Clamp to max height
    const next = Math.min(el.scrollHeight, TEXTAREA_MAX_HEIGHT);
    el.style.height = `${next}px`;
    // Enable internal scroll once content overflows max height
    el.style.overflowY = el.scrollHeight > TEXTAREA_MAX_HEIGHT ? "auto" : "hidden";
  }, []);

  // ── Handle external pending input (reload mode) ───────────────────────────
  useEffect(() => {
    if (pendingInput != null && pendingInput !== "") {
      inputValueRef.current = pendingInput;
      if (textareaRef.current) {
        textareaRef.current.value = pendingInput;
        textareaRef.current.focus();
        textareaRef.current.selectionStart = pendingInput.length;
        textareaRef.current.selectionEnd = pendingInput.length;
      }
      resizeTextarea();
      onPendingInputConsumed?.();
    }
  }, [pendingInput, onPendingInputConsumed, resizeTextarea]);

  // Auto-scroll chat to bottom when messages change or loading/uploading state changes
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, isLoading, isUploading]);

  // ── Submit handler ─────────────────────────────────────────────────────────
  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const value = inputValueRef.current.trim();
    // If a structured file is attached, allow empty message; otherwise require text
    if ((!value && !structuredFile) || isLoading || isUploading) return;
    onSendMessage(value, structuredFile ?? undefined);
    // Clear textarea
    inputValueRef.current = "";
    if (textareaRef.current) {
      textareaRef.current.value = "";
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.overflowY = "hidden";
    }
    // Clear attached structured file after send
    setStructuredFile(null);
    if (structuredFileRef.current) structuredFileRef.current.value = "";
  }

  // ── Key handler: Enter = send, Shift+Enter = newline ───────────────────────
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
    // Shift+Enter falls through naturally and inserts a newline
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file);
      e.target.value = "";
    }
  }

  function handleStructuredFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext !== "csv" && ext !== "xlsx") {
        alert("Only .csv and .xlsx files are supported.");
        e.target.value = "";
        return;
      }
      setStructuredFile(file);
    }
  }

  return (
    <div className="bg-white shadow-sm rounded-lg flex flex-col" style={{ height: "460px" }}>
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-gray-100 flex-shrink-0 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Chat</h2>
          <p className="text-xs text-gray-400 mt-0.5">Ask questions about your documents</p>
        </div>
        {onClearChat && messages.length > 0 && (
          <button
            onClick={() => {
              if (window.confirm("Are you sure you want to clear the chat and reset memory?")) {
                onClearChat();
              }
            }}
            title="Clear chat and memory"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Clear chat
          </button>
        )}
      </div>

      {/* Messages area — flex-1 so it shrinks when the input bar grows */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-5 py-4 bg-gray-50/50 min-h-0"
      >
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <p className="text-sm text-gray-400">Ask questions about your documents</p>
            <div
              className="flex flex-wrap justify-center gap-2 max-w-lg"
              onMouseEnter={() => { hoveredRef.current = true; }}
              onMouseLeave={() => { hoveredRef.current = false; }}
            >
              {visiblePrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => handlePromptClick(prompt)}
                  className="px-3 py-1.5 text-xs text-[#6556d2] bg-[#6556d2]/5 border border-[#6556d2]/20 rounded-full hover:bg-[#6556d2]/10 hover:border-[#6556d2]/40 transition-colors cursor-pointer leading-snug animate-[fadeIn_300ms_ease-out]"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {isUploading && <UploadProgressBubble fileName={uploadingFileName} />}
        {isLoading && (
          <ThinkingIndicator
            showImmediately={
              (messages.length > 0 &&
                messages[messages.length - 1].role === "user" &&
                messages[messages.length - 1].content.length > COMPLEX_PROMPT_LENGTH)
            }
          />
        )}
      </div>

      {/* Input bar — pinned to bottom, grows upward */}
      <div className="border-t border-gray-100 px-4 py-3 flex-shrink-0">
        {/* Reload mode indicator */}
        {isReloadMode && (
          <div className="flex items-center gap-2 mb-2 px-1 py-1.5 bg-[#6556d2]/5 border border-[#6556d2]/20 rounded-md">
            <svg className="h-3.5 w-3.5 text-[#6556d2] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
            </svg>
            <span className="text-[11px] text-[#6556d2] font-medium flex-1 truncate">
              Reload mode — updating: <span className="font-semibold">{reloadFileName || "document"}</span>. Edit the prompt and send.
            </span>
            <button
              type="button"
              onClick={onCancelReload}
              className="text-gray-400 hover:text-red-500 text-xs font-bold leading-none cursor-pointer"
              title="Cancel reload"
            >
              &times;
            </button>
          </div>
        )}

        {/* Attached structured file indicator */}
        {structuredFile && (
          <div className="flex items-center gap-2 mb-2 px-1">
            <FileDocIcon />
            <span className="text-xs text-gray-600 truncate max-w-[200px]">{structuredFile.name}</span>
            <button
              type="button"
              onClick={() => {
                setStructuredFile(null);
                if (structuredFileRef.current) structuredFileRef.current.value = "";
              }}
              className="text-gray-400 hover:text-red-500 text-xs font-bold leading-none cursor-pointer"
              title="Remove attached file"
            >
              &times;
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          {/* Hidden file input for Upload (existing) */}
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.html,.pdf,.doc,.docx,.txt"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Hidden file input for structured CSV/XLSX attachment */}
          <input
            ref={structuredFileRef}
            type="file"
            accept=".csv,.xlsx"
            onChange={handleStructuredFileChange}
            className="hidden"
          />

          {/* Upload button — pinned to bottom of the row (UNCHANGED) */}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={isLoading || isUploading}
            className="inline-flex items-center mb-1 gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-white bg-[#6556d2] rounded-md hover:bg-[#5445b5] transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            title="Upload file"
          >
            Upload
          </button>

          {/* Attach CSV/XLSX button — right after Upload, before textarea */}
          <button
            type="button"
            onClick={() => structuredFileRef.current?.click()}
            disabled={isLoading || isUploading}
            className={`inline-flex items-center mb-1 gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed ${
              structuredFile
                ? "bg-[#6556d2] text-white hover:bg-[#5445b5]"
                : "border border-[#6556d2] text-[#6556d2] bg-white hover:bg-[#f0effb]"
            }`}
            title="Attach CSV or XLSX file for chat-with-document"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            Add Export Template
          </button>

          {/* Auto-expanding textarea */}
          <textarea
            ref={textareaRef}
            rows={1}
            placeholder={structuredFile ? "Ask about your data file…" : "Type a message…"}
            onChange={(e) => {
              inputValueRef.current = e.target.value;
              resizeTextarea();
            }}
            onKeyDown={handleKeyDown}
            disabled={isLoading || isUploading}
            className="flex-1 px-4 py-2 text-sm text-gray-700 border border-gray-200 rounded-2xl bg-gray-50 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#6556d2]/40 focus:border-[#6556d2] transition-colors disabled:opacity-50 resize-none leading-relaxed"
            style={{ caretColor: "black", overflowY: "hidden" }}
          />

          {/* Send button — pinned to bottom of the row */}
          <button
            type="submit"
            disabled={isLoading || isUploading}
            className="flex-shrink-0 p-2.5 mb-0.5 text-white bg-[#6556d2] rounded-full hover:bg-[#5445b5] active:bg-[#4a3a9e] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title="Send message"
          >
            <SendIcon />
          </button>
        </form>
      </div>
    </div>
  );
}
