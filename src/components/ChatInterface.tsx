import { type FormEvent, useRef, useEffect, useCallback } from "react";

// ── Types ───────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
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

function UploadIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
      />
    </svg>
  );
}

// ── Typing indicator ────────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-start gap-2 mb-3">
      <div className="flex-shrink-0 h-7 w-7 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-500">
        AI
      </div>
      <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-white border border-gray-100 shadow-sm">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-gray-400 animate-pulse" />
          <span className="h-2 w-2 rounded-full bg-gray-400 animate-pulse [animation-delay:0.2s]" />
          <span className="h-2 w-2 rounded-full bg-gray-400 animate-pulse [animation-delay:0.4s]" />
        </div>
      </div>
    </div>
  );
}

// ── Upload progress indicator ─────────────────────────────────────────────────

function UploadProgressIndicator() {
  return (
    <div className="flex items-start gap-2 mb-3">
      <div className="flex-shrink-0 h-7 w-7 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-500">
        AI
      </div>
      <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-white border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 animate-spin text-[#319795]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm text-gray-500">Uploading file…</span>
        </div>
      </div>
    </div>
  );
}

// ── Message bubble ──────────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex items-start gap-2 mb-3 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div
        className={`flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold ${
          isUser
            ? "bg-[#319795] text-white"
            : "bg-gray-200 text-gray-500"
        }`}
      >
        {isUser ? "You" : "AI"}
      </div>

      {/* Bubble */}
      <div
        className={`max-w-[75%] px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? "bg-[#319795] text-white rounded-2xl rounded-tr-sm"
            : "bg-white text-gray-700 border border-gray-100 shadow-sm rounded-2xl rounded-tl-sm"
        }`}
      >
        {message.content}
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
  onSendMessage: (text: string) => void;
  onFileUpload: (file: File) => void;
  isLoading: boolean;
  isUploading?: boolean;
}

export default function ChatInterface({
  messages,
  onSendMessage,
  onFileUpload,
  isLoading,
  isUploading = false,
}: ChatInterfaceProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputValueRef = useRef("");

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
    if (!value || isLoading || isUploading) return;
    onSendMessage(value);
    // Clear textarea
    inputValueRef.current = "";
    if (textareaRef.current) {
      textareaRef.current.value = "";
      // Reset height back to single line after sending
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.overflowY = "hidden";
    }
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

        {isUploading && <UploadProgressIndicator />}
        {isLoading && <TypingIndicator />}
      </div>

      {/* Input bar — pinned to bottom, grows upward */}
      <div className="border-t border-gray-100 px-4 py-3 flex-shrink-0">
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          {/* Hidden file input */}
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.html,.pdf,.doc,.docx,.txt"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Upload button — pinned to bottom of the row */}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={isLoading}
            className="flex-shrink-0 p-2 mb-0.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title="Upload file"
          >
            <UploadIcon />
          </button>

          {/* Auto-expanding textarea */}
          <textarea
            ref={textareaRef}
            rows={1}
            placeholder="Type a message…"
            onChange={(e) => {
              inputValueRef.current = e.target.value;
              resizeTextarea();
            }}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            className="flex-1 px-4 py-2 text-sm text-gray-700 border border-gray-200 rounded-2xl bg-gray-50 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 transition-colors disabled:opacity-50 resize-none leading-relaxed"
            style={{ caretColor: "black", overflowY: "hidden" }}
          />

          {/* Send button — pinned to bottom of the row */}
          <button
            type="submit"
            disabled={isLoading}
            className="flex-shrink-0 p-2.5 mb-0.5 text-white bg-[#319795] rounded-full hover:bg-[#2C7A7B] active:bg-[#285E61] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title="Send message"
          >
            <SendIcon />
          </button>
        </form>
      </div>
    </div>
  );
}
