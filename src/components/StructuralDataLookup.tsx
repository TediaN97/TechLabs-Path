import { Fragment, useState, useRef, useMemo, useEffect, useCallback } from "react";
import type { Milestone, DeadlineEntry } from "../hooks/useAgent";

type SortKey = "file_name" | "upload_time" | "lender" | "borrower";
type SortDirection = "asc" | "desc";
interface SortConfig {
  key: SortKey;
  direction: SortDirection;
}

interface ImportantInfoData {
  agreement_title: string | null;
  effective_date: string | null;
  borrower_name: string | null;
  borrower_entity_type: string | null;
  borrower_jurisdiction: string | null;
  lender_name: string | null;
  security_collateral_description: string | null;
  governing_law: string | null;
  administrative_agent_name: string | null;
}

interface AiDeadlinesData {
  effective_date: string | null;
  maturity_date: string | null;
  construction_completion_deadline: string | null;
}

// ── Icons ──────────────────────────────────────────────────────────────────────

function SearchIcon() {
  return (
    <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
    </svg>
  );
}


// ── Row Action Icons ───────────────────────────────────────────────────────────

function InfoIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function ChevronUpIcon() {
  return (
    <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <polyline points="6 15 12 9 18 15" />
    </svg>
  );
}

function SortIcon() {
  return (
    <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <polyline points="6 9 12 4 18 9" />
      <polyline points="6 15 12 20 18 15" />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg className="h-4 w-4 text-[#6556d2]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function Trash2Icon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

// ── Deadlines Dropdown ────────────────────────────────────────────────────────

function DeadlinesDropdown({
  onAiDeadlines,
  onVectorDeadlines,
}: {
  onAiDeadlines: () => void;
  onVectorDeadlines: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-white bg-[#6556d2] rounded-md hover:bg-[#5445b5] transition-colors cursor-pointer"
      >
        <ClockIcon />
        Deadlines
        <ChevronDownIcon />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-40 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-20">
          <button
            onClick={() => { onAiDeadlines(); setOpen(false); }}
            className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-[#6556d2]/10 hover:text-[#6556d2] transition-colors cursor-pointer"
          >
            AI analyzed
          </button>
          <button
            onClick={() => { onVectorDeadlines(); setOpen(false); }}
            className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-[#6556d2]/10 hover:text-[#6556d2] transition-colors cursor-pointer"
          >
            Vectorized
          </button>
        </div>
      )}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatUploadDate(iso: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}.${mm}.${yyyy} ${hh}:${min}`;
}

function formatDateDDMMYYYY(raw: string | null): string | null {
  if (!raw) return null;
  const d = new Date(raw.includes("T") ? raw : raw + "T00:00:00");
  if (isNaN(d.getTime())) return raw; // return as-is if unparseable
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function getStatusStyle(raw: string): string {
  const s = raw.toLowerCase();
  if (s === "vectorized") return "bg-green-100 text-green-700 border border-green-200";
  if (s === "error" || s === "failed") return "bg-red-100 text-red-700 border border-red-200";
  if (s === "processing" || s === "uploading") return "bg-blue-100 text-blue-700 border border-blue-200";
  return "bg-gray-100 text-gray-600 border border-gray-200";
}

function StatusBadge({ rawStatus }: { rawStatus: string }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 text-[11px] font-medium rounded-full whitespace-nowrap ${getStatusStyle(rawStatus)}`}
    >
      {rawStatus}
    </span>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-3"><div className="h-4 w-32 bg-gray-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-24 bg-gray-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-24 bg-gray-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-24 bg-gray-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-24 bg-gray-200 rounded ml-auto" /></td>
    </tr>
  );
}

// ── Modal Shell ────────────────────────────────────────────────────────────────

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 cursor-pointer text-lg leading-none"
          >
            &times;
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

// ── Detail Modal ───────────────────────────────────────────────────────────────

function DetailPanel({ milestone, onClose }: { milestone: Milestone; onClose: () => void }) {
  return (
    <ModalShell title="Record Detail" onClose={onClose}>
      <div className="space-y-4 text-xs">
        <div>
          <span className="font-semibold text-gray-500 uppercase tracking-wider">Document ID</span>
          <p className="mt-1 text-gray-700 font-mono text-[11px] break-all">{milestone.document_id || milestone.id}</p>
        </div>
        <div>
          <span className="font-semibold text-gray-500 uppercase tracking-wider">File Name</span>
          <p className="mt-1 text-gray-700">{milestone.file_name}</p>
        </div>
        <div>
          <span className="font-semibold text-gray-500 uppercase tracking-wider">Description</span>
          <p className="mt-1 text-gray-700 leading-relaxed">{milestone.description}</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="font-semibold text-gray-500 uppercase tracking-wider">Upload Date</span>
            <p className="mt-1 text-gray-700">{formatUploadDate(milestone.upload_time)}</p>
          </div>
          <div>
            <span className="font-semibold text-gray-500 uppercase tracking-wider">Status</span>
            <p className="mt-1"><StatusBadge rawStatus={milestone.raw_status} /></p>
          </div>
          <div>
            <span className="font-semibold text-gray-500 uppercase tracking-wider">Lender</span>
            <p className="mt-1 text-gray-700">{milestone.lender}</p>
          </div>
          <div>
            <span className="font-semibold text-gray-500 uppercase tracking-wider">Borrower</span>
            <p className="mt-1 text-gray-700">{milestone.borrower}</p>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

// ── Vectorized Deadlines Table Modal ──────────────────────────────────────────

function VectorDeadlinesPanel({ milestone, onClose }: { milestone: Milestone; onClose: () => void }) {
  const deadlines: DeadlineEntry[] = milestone.deadlines ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-3xl mx-4 overflow-hidden max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-[#6556d2] flex items-center justify-between flex-shrink-0">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white">Vectorized Deadlines</h3>
            <p className="text-[11px] text-white/70 mt-0.5 truncate" title={milestone.file_name}>
              {milestone.file_name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white cursor-pointer text-lg leading-none ml-4 flex-shrink-0"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        {deadlines.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-gray-400">No vectorized deadlines found for this document.</p>
          </div>
        ) : (
          <div className="overflow-auto flex-1">
            <table className="w-full text-sm">
              <thead className="top-0 z-10">
                <tr className="bg-[#6556d2]/5 border-b border-[#6556d2]/20">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-[#6556d2] uppercase">
                    Description
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-[#6556d2] uppercase tracking-wider whitespace-nowrap">
                    Deadline
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-[#6556d2] uppercase tracking-wider whitespace-nowrap">
                    Section Name
                  </th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold text-[#6556d2] uppercase tracking-wider whitespace-nowrap">
                    Section Page
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {deadlines.map((dl, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-3 text-gray-700 text-xs leading-relaxed">
                      {dl.description || "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                      {dl.date_raw || "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {dl.section_title || "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs text-center">
                      {dl.section_index != null ? String(dl.section_index) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between flex-shrink-0 bg-gray-50/50">
          <span className="text-[11px] text-gray-400">
            {deadlines.length} deadline{deadlines.length !== 1 ? "s" : ""} found
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-white bg-[#6556d2] rounded-md hover:bg-[#5445b5] transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── AI Deadlines Modal ─────────────────────────────────────────────────────────

function AiDeadlinesPanel({ milestone, onClose }: { milestone: Milestone; onClose: () => void }) {
  const deadline = new Date(milestone.deadline_date + "T00:00:00");
  const today = new Date();
  const diffDays = Math.round((deadline.getTime() - today.getTime()) / 86400000);

  const rawLower = milestone.raw_status.toLowerCase();
  let riskLevel: "Low" | "Medium" | "High";
  let riskColor: string;
  if (rawLower === "vectorized") {
    riskLevel = "Low";
    riskColor = "text-green-600 bg-green-50 border-green-200";
  } else if (rawLower === "error" || rawLower === "failed" || diffDays < 0) {
    riskLevel = "High";
    riskColor = "text-red-600 bg-red-50 border-red-200";
  } else if (rawLower === "processing" || rawLower === "uploading") {
    riskLevel = "Medium";
    riskColor = "text-amber-600 bg-amber-50 border-amber-200";
  } else {
    riskLevel = "Low";
    riskColor = "text-green-600 bg-green-50 border-green-200";
  }

  return (
    <ModalShell title="AI Deadline Analysis" onClose={onClose}>
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <SparklesIcon />
          <span className="text-xs text-gray-500">AI-generated risk assessment</span>
        </div>
        <div className={`rounded-md p-4 border text-xs ${riskColor}`}>
          <p className="font-semibold text-sm">Risk Level: {riskLevel}</p>
          <p className="mt-1">
            {riskLevel === "High"
              ? "This document requires immediate attention. Review processing errors and consider re-uploading."
              : riskLevel === "Medium"
                ? "This document is currently being processed. Monitor progress and ensure pipeline completion."
                : rawLower === "vectorized"
                  ? "This document has been successfully vectorized. No further action required."
                  : "This document status is nominal. Monitor periodically during the next refresh cycle."}
          </p>
        </div>
        <div className="bg-gray-50 rounded-md p-4 border border-gray-100 text-xs space-y-2">
          <p className="font-semibold text-gray-600">Suggestions</p>
          <ul className="list-disc list-inside text-gray-600 space-y-1">
            {riskLevel === "High" ? (
              <>
                <li>Review processing errors for {milestone.file_name}</li>
                <li>Notify compliance team of document issue</li>
                <li>Prepare status report for {milestone.lender !== "-" ? milestone.lender : "lender"} review</li>
              </>
            ) : rawLower === "vectorized" ? (
              <>
                <li>Archive completion documentation</li>
                <li>Update compliance dashboard</li>
              </>
            ) : (
              <>
                <li>Monitor document processing pipeline</li>
                <li>Verify deliverables checklist is current</li>
                <li>Confirm responsible party assignment</li>
              </>
            )}
          </ul>
        </div>
      </div>
    </ModalShell>
  );
}

// ── AI Analyzed Deadlines Modal ──────────────────────────────────────────────

function AiAnalyzedModal({
  milestone,
  data,
  isLoading,
  error,
  onClose,
}: {
  milestone: Milestone;
  data: AiDeadlinesData | null;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const dateRows: { label: string; value: string | null }[] = data
    ? [
        { label: "Effective Date", value: formatDateDDMMYYYY(data.effective_date) },
        { label: "Maturity Date", value: formatDateDDMMYYYY(data.maturity_date) },
        { label: "Construction Completion Deadline", value: formatDateDDMMYYYY(data.construction_completion_deadline) },
      ]
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-[#6556d2] flex items-center justify-between flex-shrink-0">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white">AI Analyzed Deadlines</h3>
            <p className="text-[11px] text-white/70 mt-0.5 truncate" title={milestone.file_name}>
              {milestone.file_name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white cursor-pointer text-lg leading-none ml-4 flex-shrink-0"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <svg className="h-8 w-8 animate-spin text-[#6556d2]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm text-gray-400">Analyzing deadlines...</span>
            </div>
          )}

          {error && !isLoading && (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <svg className="h-8 w-8 text-red-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-500 font-medium">Failed to load deadlines</p>
              <p className="text-xs text-gray-400">{error}</p>
            </div>
          )}

          {data && !isLoading && (
            <div className="space-y-4">
              {dateRows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50/50 px-4 py-3"
                >
                  <CalendarIcon />
                  <div className="min-w-0 flex-1">
                    <span className="text-[11px] font-semibold text-[#6556d2] uppercase tracking-wider">
                      {row.label}
                    </span>
                    {row.value ? (
                      <p className="mt-0.5 text-sm font-medium text-gray-700">{row.value}</p>
                    ) : (
                      <p className="mt-0.5 text-sm text-gray-400 italic">Not detected</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 flex justify-end flex-shrink-0 bg-gray-50/50">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-white bg-[#6556d2] rounded-md hover:bg-[#5445b5] transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Important Info Modal ──────────────────────────────────────────────────────

function ImportantInfoModal({
  milestone,
  data,
  isLoading,
  error,
  onClose,
}: {
  milestone: Milestone;
  data: ImportantInfoData | null;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const fields: { label: string; value: string }[] = data
    ? [
        { label: "Agreement Title", value: data.agreement_title ?? "" },
        { label: "Effective Date", value: data.effective_date ?? "" },
        {
          label: "Borrower",
          value: data.borrower_name
            ? `${data.borrower_name}${data.borrower_entity_type || data.borrower_jurisdiction ? ` (${[data.borrower_entity_type, data.borrower_jurisdiction].filter(Boolean).join(" in ")})` : ""}`
            : "",
        },
        { label: "Lender(s)", value: data.lender_name ?? "" },
        { label: "Collateral", value: data.security_collateral_description ?? "" },
        { label: "Governing Law", value: data.governing_law ?? "" },
        { label: "Admin Agent", value: data.administrative_agent_name ?? "" },
      ]
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 overflow-hidden max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-[#6556d2] flex items-center justify-between flex-shrink-0">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white">Important information</h3>
            <p className="text-[11px] text-white/70 mt-0.5 truncate" title={milestone.file_name}>
              {milestone.file_name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white cursor-pointer text-lg leading-none ml-4 flex-shrink-0"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="overflow-auto flex-1 px-6 py-5">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <svg className="h-8 w-8 animate-spin text-[#6556d2]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm text-gray-400">Fetching document analysis...</span>
            </div>
          )}

          {error && !isLoading && (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <svg className="h-8 w-8 text-red-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-500 font-medium">Failed to load document info</p>
              <p className="text-xs text-gray-400">{error}</p>
            </div>
          )}

          {data && !isLoading && (
            <div className="grid grid-cols-2 gap-x-8 gap-y-5">
              {fields.map((f) => (
                <div key={f.label} className={f.label === "Collateral" ? "col-span-2" : ""}>
                  <span className="text-[11px] font-semibold text-[#6556d2] uppercase tracking-wider">
                    {f.label}
                  </span>
                  {f.value ? (
                    <p className="mt-1 text-sm text-gray-700 leading-relaxed">{f.value}</p>
                  ) : (
                    <p className="mt-1 text-sm text-gray-400 italic">Not specified</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 flex justify-end flex-shrink-0 bg-gray-50/50">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-white bg-[#6556d2] rounded-md hover:bg-[#5445b5] transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

const RECORDS_PER_PAGE = 10;

interface StructuralDataLookupProps {
  data: Milestone[];
  isLoading: boolean;
  isRefreshing: boolean;
  lastRefreshed: string;
  fetchError: string | null;
  detailMilestone: Milestone | null;
  onDetailStruct: (m: Milestone | null) => void;
  onDelete: (id: string) => void;
  isUploading?: boolean;
  uploadingFileName?: string;
}

export default function StructuralDataLookup({
  data,
  isLoading,
  isRefreshing,
  lastRefreshed,
  fetchError,
  detailMilestone,
  onDetailStruct,
  onDelete,
  isUploading = false,
  uploadingFileName = "",
}: StructuralDataLookupProps) {
  const [filterText, setFilterText] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [vectorMilestone, setVectorMilestone] = useState<Milestone | null>(null);
  const [aiMilestone, setAiMilestone] = useState<Milestone | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: "upload_time", direction: "desc" });

  // AI Analyzed modal state
  const [aiAnalyzedMilestone, setAiAnalyzedMilestone] = useState<Milestone | null>(null);
  const [aiAnalyzedData, setAiAnalyzedData] = useState<AiDeadlinesData | null>(null);
  const [aiAnalyzedLoading, setAiAnalyzedLoading] = useState(false);
  const [aiAnalyzedError, setAiAnalyzedError] = useState<string | null>(null);

  const handleAiAnalyzed = useCallback(async (entry: Milestone) => {
    const docId = entry.document_id || entry.id;
    setAiAnalyzedMilestone(entry);
    setAiAnalyzedData(null);
    setAiAnalyzedError(null);
    setAiAnalyzedLoading(true);
    try {
      const res = await fetch(
        `https://20.110.72.120.nip.io/webhook/get-deadlines/AIdeadlines/${encodeURIComponent(docId)}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const payload = Array.isArray(json) ? json[0] ?? {} : json;
      setAiAnalyzedData(payload as AiDeadlinesData);
    } catch (err: unknown) {
      setAiAnalyzedError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setAiAnalyzedLoading(false);
    }
  }, []);

  // Important Info modal state
  const [importantInfoMilestone, setImportantInfoMilestone] = useState<Milestone | null>(null);
  const [importantInfoData, setImportantInfoData] = useState<ImportantInfoData | null>(null);
  const [importantInfoLoading, setImportantInfoLoading] = useState(false);
  const [importantInfoError, setImportantInfoError] = useState<string | null>(null);

  const handleImportantInfo = useCallback(async (entry: Milestone) => {
    const docId = entry.document_id || entry.id;
    setImportantInfoMilestone(entry);
    setImportantInfoData(null);
    setImportantInfoError(null);
    setImportantInfoLoading(true);
    try {
      const res = await fetch(
        `https://20.110.72.120.nip.io/webhook/get-deadlines/importantInfo/${encodeURIComponent(docId)}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      // Accept either the root object or first array element
      const payload = Array.isArray(json) ? json[0] ?? {} : json;
      setImportantInfoData(payload as ImportantInfoData);
    } catch (err: unknown) {
      setImportantInfoError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setImportantInfoLoading(false);
    }
  }, []);

  const handleSort = useCallback((key: SortKey) => {
    setSortConfig((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" }
    );
  }, []);

  const filtered = useMemo(() => {
    // 1. Filter
    let result = data;

    if (filterText.trim()) {
      const q = filterText.toLowerCase();
      result = data.filter(
        (m) =>
          m.file_name.toLowerCase().includes(q) ||
          (m.lender && m.lender.toLowerCase().includes(q)) ||
          (m.borrower && m.borrower.toLowerCase().includes(q)) ||
          (m.status && m.status.toLowerCase().includes(q)) ||
          formatUploadDate(m.upload_time).includes(q)
      );
    }

    // 2. Sort
    const { key, direction } = sortConfig;
    const mult = direction === "asc" ? 1 : -1;

    return [...result].sort((a, b) => {
      if (key === "upload_time") {
        return mult * (new Date(a.upload_time).getTime() - new Date(b.upload_time).getTime());
      }
      const valA = (a[key] ?? "").toLowerCase();
      const valB = (b[key] ?? "").toLowerCase();
      return mult * valA.localeCompare(valB);
    });
  }, [data, filterText, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / RECORDS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedData = filtered.slice(
    (safePage - 1) * RECORDS_PER_PAGE,
    safePage * RECORDS_PER_PAGE
  );

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filterText]);

  return (
    <>
      <div className="bg-white shadow-sm rounded-lg min-w-0">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-gray-800">Structural Data Lookup</h2>
              {/* Live indicator */}
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-gray-400">
                {isRefreshing ? "Refreshing…" : `Updated ${formatTime(lastRefreshed)}`}
              </span>
              <span className="text-xs text-gray-400 font-medium">
                {isLoading ? "Loading…" : `${filtered.length} record${filtered.length !== 1 ? "s" : ""}`}
              </span>
            </div>
          </div>

          <div className="relative mt-2.5">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3">
              <SearchIcon />
            </span>
            <input
              type="text"
              placeholder="Filter data..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-md bg-gray-50 text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#6556d2]/40 focus:border-[#6556d2] transition-colors"
            />
          </div>
        </div>

        {/* Error banner */}
        {fetchError && !isLoading && (
          <div className="mx-5 mt-3 flex items-center gap-2 rounded-md bg-amber-50 border border-amber-200 px-4 py-2.5 text-xs text-amber-700">
            <svg className="h-4 w-4 flex-shrink-0 text-amber-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {fetchError}
          </div>
        )}

        {/* Loading spinner overlay for initial fetch */}
        {isLoading && data.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <svg className="h-8 w-8 animate-spin text-[#6556d2]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm text-gray-400">Loading documents...</span>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto" style={{ display: isLoading && data.length === 0 ? "none" : undefined }}>
          <table className="w-full text-sm table-fixed" style={{ minWidth: "900px" }}>
            <thead>
              <tr className="border-b border-gray-100">
                {([
                  { key: "file_name" as SortKey, label: "Name", width: "w-[24%]" },
                  { key: "upload_time" as SortKey, label: "Upload Date", width: "w-[12%]" },
                  { key: "lender" as SortKey, label: "StakeHolder 1", width: "w-[24%]" },
                  { key: "borrower" as SortKey, label: "StakeHolder 2", width: "w-[24%]" },
                ] as const).map((col) => {
                  const isActive = sortConfig.key === col.key;
                  return (
                    <th
                      key={col.key}
                      className={`${col.width} px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider select-none cursor-pointer group ${
                        isActive ? "text-[#6556d2]" : "text-gray-500"
                      }`}
                      onClick={() => handleSort(col.key)}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        <span className={isActive ? "text-[#6556d2]" : "text-gray-300 group-hover:text-gray-400 transition-colors"}>
                          {isActive
                            ? sortConfig.direction === "asc"
                              ? <ChevronUpIcon />
                              : <ChevronDownIcon />
                            : <SortIcon />}
                        </span>
                      </span>
                    </th>
                  );
                })}
                <th className="w-[20%] px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {/* Ghost row while uploading */}
              {isUploading && uploadingFileName && !isLoading && (
                <tr className="animate-pulse bg-[#6556d2]/[0.03]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[#6556d2] font-medium truncate" title={uploadingFileName}>
                        {uploadingFileName}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-[#6556d2] bg-[#6556d2]/10 rounded-full whitespace-nowrap flex-shrink-0">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#6556d2]" />
                        Batch Processing...
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#6556d2]/70 text-xs italic">Just now</td>
                  <td className="px-4 py-3"><div className="h-4 w-24 bg-[#6556d2]/10 rounded animate-pulse" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-24 bg-[#6556d2]/10 rounded animate-pulse" /></td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-2 opacity-30 pointer-events-none">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 font-medium text-white bg-[#6556d2] rounded-md"><InfoIcon /></span>
                    </div>
                  </td>
                </tr>
              )}
              {isLoading ? (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              ) : filtered.length === 0 && !isUploading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-gray-400">
                    No matching records found.
                  </td>
                </tr>
              ) : (
                paginatedData.map((entry) => (
                  <Fragment key={entry.id}>
                    <tr className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-gray-700 font-medium truncate" title={entry.file_name}>
                            {entry.file_name}
                          </span>
                          {entry.raw_status.toLowerCase() !== "vectorized" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-[#6556d2] bg-[#6556d2]/10 rounded-full whitespace-nowrap flex-shrink-0 animate-pulse">
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#6556d2]" />
                              Batch Processing
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 truncate">
                        {formatUploadDate(entry.upload_time)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 truncate" title={entry.lender}>
                        {entry.lender}
                      </td>
                      <td className="px-4 py-3 text-gray-600 truncate" title={entry.borrower}>
                        {entry.borrower}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center justify-end gap-2">
                          {/* 1. Detail Icon */}
                          <button
                            onClick={() => onDetailStruct(entry)}
                            title="Detail"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 font-medium text-white bg-[#6556d2] rounded-md hover:bg-[#5445b5] transition-colors cursor-pointer whitespace-nowrap"
                          >
                            <InfoIcon />
                          </button>
                          {/* 2. Deadlines Dropdown */}
                          <DeadlinesDropdown
                            onAiDeadlines={() => handleAiAnalyzed(entry)}
                            onVectorDeadlines={() => setVectorMilestone(entry)}
                          />
                          {/* 3. Important Info Button */}
                          <button
                            onClick={() => handleImportantInfo(entry)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-white bg-[#6556d2] rounded-md hover:bg-[#5445b5] transition-colors cursor-pointer whitespace-nowrap"
                          >
                            <SparklesIcon />
                            Important info
                          </button>
                          {/* 4. Delete Icon */}
                          <button
                            onClick={() => onDelete(entry.document_id || entry.id)}
                            title="Delete"
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                          >
                            <Trash2Icon />
                          </button>
                        </div>
                      </td>
                    </tr>
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filtered.length > RECORDS_PER_PAGE && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-400">
              Showing {(safePage - 1) * RECORDS_PER_PAGE + 1}–{Math.min(safePage * RECORDS_PER_PAGE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="px-2.5 py-1 text-xs font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    page === safePage
                      ? "bg-[#6556d2] text-white"
                      : "text-gray-600 border border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="px-2.5 py-1 text-xs font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {detailMilestone && (
        <DetailPanel milestone={detailMilestone} onClose={() => onDetailStruct(null)} />
      )}
      {vectorMilestone && (
        <VectorDeadlinesPanel milestone={vectorMilestone} onClose={() => setVectorMilestone(null)} />
      )}
      {aiMilestone && (
        <AiDeadlinesPanel milestone={aiMilestone} onClose={() => setAiMilestone(null)} />
      )}
      {aiAnalyzedMilestone && (
        <AiAnalyzedModal
          milestone={aiAnalyzedMilestone}
          data={aiAnalyzedData}
          isLoading={aiAnalyzedLoading}
          error={aiAnalyzedError}
          onClose={() => setAiAnalyzedMilestone(null)}
        />
      )}
      {importantInfoMilestone && (
        <ImportantInfoModal
          milestone={importantInfoMilestone}
          data={importantInfoData}
          isLoading={importantInfoLoading}
          error={importantInfoError}
          onClose={() => setImportantInfoMilestone(null)}
        />
      )}
    </>
  );
}
