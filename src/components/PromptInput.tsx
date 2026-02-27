import { type FormEvent, useRef } from "react";

// ── Icons ──────────────────────────────────────────────────────────────────────

function PlayIcon() {
  return (
    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
      <path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

interface PromptInputProps {
  prompt: string;
  onPromptChange: (value: string) => void;
  onRun: (prompt: string) => void;
  onFileUpload: (file: File) => void;
  isLoading: boolean;
}

export default function PromptInput({
  prompt,
  onPromptChange,
  onRun,
  onFileUpload,
  isLoading,
}: PromptInputProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;
    onRun(prompt);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file);
      e.target.value = "";
    }
  }

  return (
    <div className="bg-white shadow-sm rounded-lg">
      <div className="px-5 py-3.5 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-800">Prompt</h2>
      </div>

      <form onSubmit={handleSubmit} className="px-5 py-4">
        <textarea
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 text-sm text-gray-700 border border-gray-200 rounded-md bg-gray-50 placeholder-gray-400 resize-y focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 transition-colors"
          placeholder="Paste text, HTML table, or CSV data to analyze…"
          disabled={isLoading}
        />

        <div className="mt-3 flex items-center justify-end gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.html,.pdf,.doc,.docx,.txt"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <UploadIcon />
            Upload File
          </button>

          <button
            type="submit"
            disabled={!prompt.trim() || isLoading}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#319795] rounded-md hover:bg-[#2C7A7B] active:bg-[#285E61] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? <SpinnerIcon /> : <PlayIcon />}
            {isLoading ? "Running…" : "Run Now"}
          </button>
        </div>
      </form>
    </div>
  );
}
