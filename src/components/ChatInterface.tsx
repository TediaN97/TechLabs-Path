import { type FormEvent, useState, useRef, useEffect, useCallback } from "react";

// ── Types ───────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  rawJson?: unknown;
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
    }, 10000);

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
    }, 10000);
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

/** Format ISO date string to DD.MM.YYYY */
function formatDate(v: string): string {
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}`;
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

// ── Message bubble ──────────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const [showJson, setShowJson] = useState(false);
  const hasJson = message.rawJson != null;
  const tableData = !isUser ? extractTableData(message.rawJson) : null;

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
    </div>
  );
}

// ── Constants ────────────────────────────────────────────────────────────────────

/** Max height in px before the textarea becomes internally scrollable (~7 lines) */
const TEXTAREA_MAX_HEIGHT = 200;

// ── Component ───────────────────────────────────────────────────────────────────

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (text: string, structuredFile?: File) => void;
  onFileUpload: (file: File) => void;
  isLoading: boolean;
  isUploading?: boolean;
  uploadingFileName?: string;
}

export default function ChatInterface({
  messages,
  onSendMessage,
  onFileUpload,
  isLoading,
  isUploading = false,
  uploadingFileName = "",
}: ChatInterfaceProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const structuredFileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputValueRef = useRef("");
  const [structuredFile, setStructuredFile] = useState<File | null>(null);

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
      <div className="px-5 py-3.5 border-b border-gray-100 flex-shrink-0">
        <h2 className="text-base font-semibold text-gray-800">Chat</h2>
        <p className="text-xs text-gray-400 mt-0.5">Ask questions about your documents</p>
      </div>

      {/* Messages area — flex-1 so it shrinks when the input bar grows */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-5 py-4 bg-gray-50/50 min-h-0"
      >
        {messages.length === 0 && !isLoading && (
          <div className="flex items-center justify-center h-full text-sm text-gray-400">
            Send a message to start the conversation.
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
            Data File
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
