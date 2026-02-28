import { type FormEvent, useRef, useEffect } from "react";

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

// ── Component ───────────────────────────────────────────────────────────────────

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onFileUpload: (file: File) => void;
  isLoading: boolean;
}

export default function ChatInterface({
  messages,
  onSendMessage,
  onFileUpload,
  isLoading,
}: ChatInterfaceProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputValueRef = useRef("");

  // Auto-scroll to bottom when messages change or loading state changes
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, isLoading]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const value = inputValueRef.current.trim();
    if (!value || isLoading) return;
    onSendMessage(value);
    inputValueRef.current = "";
    if (inputRef.current) inputRef.current.value = "";
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

      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-5 py-4 bg-gray-50/50"
      >
        {messages.length === 0 && !isLoading && (
          <div className="flex items-center justify-center h-full text-sm text-gray-400">
            Send a message to start the conversation.
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {isLoading && <TypingIndicator />}
      </div>

      {/* Input bar */}
      <div className="border-t border-gray-100 px-4 py-3 flex-shrink-0">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          {/* Hidden file input */}
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.html,.pdf,.doc,.docx,.txt"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Upload button */}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={isLoading}
            className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title="Upload file"
          >
            <UploadIcon />
          </button>

          {/* Text input */}
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a message…"
            onChange={(e) => {
              inputValueRef.current = e.target.value;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                handleSubmit(e);
              }
            }}
            disabled={isLoading}
            className="flex-1 px-4 py-2 text-sm text-gray-700 border border-gray-200 rounded-full bg-gray-50 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 transition-colors disabled:opacity-50"
            style={{ caretColor: "black" }}
          />

          {/* Send button */}
          <button
            type="submit"
            disabled={isLoading}
            className="flex-shrink-0 p-2.5 text-white bg-[#319795] rounded-full hover:bg-[#2C7A7B] active:bg-[#285E61] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title="Send message"
          >
            <SendIcon />
          </button>
        </form>
      </div>
    </div>
  );
}
