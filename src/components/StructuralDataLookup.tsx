import { Fragment, useState, useMemo, useEffect } from "react";
import type { Milestone } from "../hooks/useAgent";

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

function GitBranchIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <line x1="6" y1="3" x2="6" y2="15" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 01-9 9" />
    </svg>
  );
}

function AlertCircleIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
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

// ── Tooltip Button ─────────────────────────────────────────────────────────────

function ActionBtn({
  label,
  onClick,
  children,
  variant = "default",
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  variant?: "default" | "danger";
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`relative p-1.5 rounded-md transition-colors cursor-pointer ${
        variant === "danger"
          ? "text-gray-400 hover:text-red-500 hover:bg-red-50"
          : "text-gray-400 hover:text-[#319795] hover:bg-teal-50"
      }`}
    >
      {children}
    </button>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

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

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function getStatusStyle(raw: string): string {
  const s = raw.toLowerCase();
  if (s === "vectorized") return "bg-teal-100 text-teal-700 border border-teal-200";
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
      <td className="px-4 py-3"><div className="h-4 w-28 bg-gray-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-24 bg-gray-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-24 bg-gray-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-24 bg-gray-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-14 bg-gray-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-28 bg-gray-200 rounded ml-auto" /></td>
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

// ── Vector Deadlines Modal ─────────────────────────────────────────────────────

function VectorDeadlinesPanel({ milestone, onClose }: { milestone: Milestone; onClose: () => void }) {
  const deadline = new Date(milestone.deadline_date + "T00:00:00");
  const today = new Date();
  const diffDays = Math.round((deadline.getTime() - today.getTime()) / 86400000);
  const isPast = diffDays < 0;

  return (
    <ModalShell title="Vector Deadlines" onClose={onClose}>
      <div className="space-y-3">
        <div className="bg-gray-50 rounded-md p-4 border border-gray-100">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">Timeline Vector</p>
          <p className="text-sm font-medium text-gray-800 truncate" title={milestone.file_name}>{milestone.file_name}</p>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${isPast ? "bg-red-400" : milestone.raw_status === "vectorized" ? "bg-green-400" : "bg-[#319795]"}`}
                style={{ width: isPast || milestone.raw_status === "vectorized" ? "100%" : `${Math.max(10, 100 - Math.min(100, diffDays))}%` }}
              />
            </div>
            <span className={`text-xs font-semibold ${isPast ? "text-red-500" : "text-gray-600"}`}>
              {isPast ? `${Math.abs(diffDays)}d overdue` : milestone.raw_status === "vectorized" ? "Complete" : `${diffDays}d remaining`}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="bg-gray-50 rounded-md p-3 border border-gray-100 text-center">
            <p className="text-gray-400 uppercase tracking-wider font-semibold">Uploaded</p>
            <p className="mt-1 text-gray-700 font-medium">{formatUploadDate(milestone.upload_time)}</p>
          </div>
          <div className="bg-gray-50 rounded-md p-3 border border-gray-100 text-center">
            <p className="text-gray-400 uppercase tracking-wider font-semibold">Lender</p>
            <p className="mt-1 text-gray-700 font-medium truncate" title={milestone.lender}>{milestone.lender}</p>
          </div>
          <div className="bg-gray-50 rounded-md p-3 border border-gray-100 text-center">
            <p className="text-gray-400 uppercase tracking-wider font-semibold">Status</p>
            <p className="mt-1"><StatusBadge rawStatus={milestone.raw_status} /></p>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

// ── Important Info Modal ───────────────────────────────────────────────────────

function ImportantInfoPanel({ milestone, onClose }: { milestone: Milestone; onClose: () => void }) {
  return (
    <ModalShell title="Important Info" onClose={onClose}>
      <div className="space-y-3">
        <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
          <div className="flex items-start gap-2">
            <AlertCircleIcon />
            <div>
              <p className="text-xs font-semibold text-amber-800">Key Document Information</p>
              <p className="text-xs text-amber-700 mt-1">
                Document <span className="font-semibold">{milestone.file_name}</span> involves
                lender <span className="font-semibold">{milestone.lender}</span> and
                borrower <span className="font-semibold">{milestone.borrower}</span>.
              </p>
            </div>
          </div>
        </div>
        <div className="bg-gray-50 rounded-md p-4 border border-gray-100 text-xs space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-500 font-semibold">Lender</span>
            <span className="text-gray-700 text-right max-w-[60%] truncate" title={milestone.lender}>{milestone.lender}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 font-semibold">Borrower</span>
            <span className="text-gray-700 text-right max-w-[60%] truncate" title={milestone.borrower}>{milestone.borrower}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 font-semibold">Upload Date</span>
            <span className="text-gray-700">{formatUploadDate(milestone.upload_time)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 font-semibold">Status</span>
            <StatusBadge rawStatus={milestone.raw_status} />
          </div>
        </div>
        {(milestone.raw_status === "error" || milestone.raw_status === "failed") && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 text-xs text-red-700">
            This document has an error status. Review the processing pipeline for issues.
          </div>
        )}
      </div>
    </ModalShell>
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
}: StructuralDataLookupProps) {
  const [filterText, setFilterText] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [vectorMilestone, setVectorMilestone] = useState<Milestone | null>(null);
  const [importantMilestone, setImportantMilestone] = useState<Milestone | null>(null);
  const [aiMilestone, setAiMilestone] = useState<Milestone | null>(null);

  const filtered = useMemo(() => {
  // 1. Filtrovanie dát
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

  // 2. Zoradenie podľa upload_time (od najnovšieho po najstaršie)
  return [...result].sort((a, b) => {
    return new Date(b.upload_time).getTime() - new Date(a.upload_time).getTime();
  });

}, [data, filterText]);

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
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-md bg-gray-50 text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 transition-colors"
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
            <svg className="h-8 w-8 animate-spin text-[#319795]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm text-gray-400">Loading documents...</span>
          </div>
        )}

        {/* Table — 5 columns (wider Actions) */}
        <div className="overflow-x-auto" style={{ display: isLoading && data.length === 0 ? "none" : undefined }}>
          <table className="w-full text-sm table-fixed">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="w-[22%] px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="w-[12%] px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Upload Date
                </th>
                <th className="w-[16%] px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Lender
                </th>
                <th className="w-[16%] px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Borrower
                </th>
                <th className="w-[8%] px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="w-[26%] px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-gray-400">
                    No matching records found.
                  </td>
                </tr>
              ) : (
                paginatedData.map((entry) => (
                  <Fragment key={entry.id}>
                    <tr className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-4 py-3 text-gray-700 font-medium truncate" title={entry.file_name}>
                        {entry.file_name}
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
                      <td className="px-4 py-3">
                        <StatusBadge rawStatus={entry.raw_status} />
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center justify-end gap-0.5">
                          <ActionBtn label="Detail" onClick={() => onDetailStruct(entry)}>
                            <InfoIcon />
                          </ActionBtn>
                          <ActionBtn label="Vector Deadlines" onClick={() => setVectorMilestone(entry)}>
                            <GitBranchIcon />
                          </ActionBtn>
                          <ActionBtn label="Important Info" onClick={() => setImportantMilestone(entry)}>
                            <AlertCircleIcon />
                          </ActionBtn>
                          <ActionBtn label="AI Deadlines" onClick={() => setAiMilestone(entry)}>
                            <SparklesIcon />
                          </ActionBtn>
                          <ActionBtn label="Delete" onClick={() => onDelete(entry.document_id || entry.id)} variant="danger">
                            <Trash2Icon />
                          </ActionBtn>
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
                      ? "bg-[#319795] text-white"
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
      {importantMilestone && (
        <ImportantInfoPanel milestone={importantMilestone} onClose={() => setImportantMilestone(null)} />
      )}
      {aiMilestone && (
        <AiDeadlinesPanel milestone={aiMilestone} onClose={() => setAiMilestone(null)} />
      )}
    </>
  );
}
