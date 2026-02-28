import { Fragment, useState, useMemo, useEffect } from "react";
import type { Milestone, MilestoneStatus } from "../hooks/useAgent";

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

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

const STATUS_STYLES: Record<MilestoneStatus, string> = {
  done: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
  pending: "bg-gray-100 text-gray-600",
};

const STATUS_LABELS: Record<MilestoneStatus, string> = {
  done: "Done",
  overdue: "Overdue",
  pending: "Pending",
};

function StatusBadge({ status }: { status: MilestoneStatus }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 text-[11px] font-semibold rounded-full ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-3"><div className="h-4 w-20 bg-gray-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-40 bg-gray-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-28 bg-gray-200 rounded" /></td>
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
      <div className="grid grid-cols-2 gap-4 text-xs">
        <div>
          <span className="font-semibold text-gray-500 uppercase tracking-wider">ID</span>
          <p className="mt-1 text-gray-700 font-mono text-[11px] break-all">{milestone.id}</p>
        </div>
        <div>
          <span className="font-semibold text-gray-500 uppercase tracking-wider">Deadline</span>
          <p className="mt-1 text-gray-700">{formatDate(milestone.deadline_date)}</p>
        </div>
        <div>
          <span className="font-semibold text-gray-500 uppercase tracking-wider">Task</span>
          <p className="mt-1 text-gray-700">{milestone.milestone_name}</p>
        </div>
        <div>
          <span className="font-semibold text-gray-500 uppercase tracking-wider">Document Ref</span>
          <p className="mt-1 text-gray-700">{milestone.document_ref}</p>
        </div>
        <div>
          <span className="font-semibold text-gray-500 uppercase tracking-wider">Context</span>
          <p className="mt-1 text-gray-700">{milestone.context}</p>
        </div>
        <div>
          <span className="font-semibold text-gray-500 uppercase tracking-wider">Status</span>
          <p className="mt-1"><StatusBadge status={milestone.status} /></p>
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
          <p className="text-sm font-medium text-gray-800">{milestone.milestone_name}</p>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${isPast ? "bg-red-400" : milestone.status === "done" ? "bg-green-400" : "bg-[#319795]"}`}
                style={{ width: isPast || milestone.status === "done" ? "100%" : `${Math.max(10, 100 - Math.min(100, diffDays))}%` }}
              />
            </div>
            <span className={`text-xs font-semibold ${isPast ? "text-red-500" : "text-gray-600"}`}>
              {isPast ? `${Math.abs(diffDays)}d overdue` : milestone.status === "done" ? "Complete" : `${diffDays}d remaining`}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="bg-gray-50 rounded-md p-3 border border-gray-100 text-center">
            <p className="text-gray-400 uppercase tracking-wider font-semibold">Start</p>
            <p className="mt-1 text-gray-700 font-medium">Contract Date</p>
          </div>
          <div className="bg-gray-50 rounded-md p-3 border border-gray-100 text-center">
            <p className="text-gray-400 uppercase tracking-wider font-semibold">Deadline</p>
            <p className="mt-1 text-gray-700 font-medium">{formatDate(milestone.deadline_date)}</p>
          </div>
          <div className="bg-gray-50 rounded-md p-3 border border-gray-100 text-center">
            <p className="text-gray-400 uppercase tracking-wider font-semibold">Status</p>
            <p className="mt-1"><StatusBadge status={milestone.status} /></p>
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
              <p className="text-xs font-semibold text-amber-800">Key Contractual Clause</p>
              <p className="text-xs text-amber-700 mt-1">
                This obligation is defined in <span className="font-semibold">{milestone.document_ref}</span> under
                the <span className="font-semibold">{milestone.context}</span> agreement.
              </p>
            </div>
          </div>
        </div>
        <div className="bg-gray-50 rounded-md p-4 border border-gray-100 text-xs space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-500 font-semibold">Milestone</span>
            <span className="text-gray-700">{milestone.milestone_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 font-semibold">Deadline</span>
            <span className="text-gray-700">{formatDate(milestone.deadline_date)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 font-semibold">Compliance Status</span>
            <StatusBadge status={milestone.status} />
          </div>
        </div>
        {milestone.status === "overdue" && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 text-xs text-red-700">
            This milestone is past due. Review the agreement for penalty clauses or cure periods.
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

  let riskLevel: "Low" | "Medium" | "High";
  let riskColor: string;
  if (milestone.status === "done") {
    riskLevel = "Low";
    riskColor = "text-green-600 bg-green-50 border-green-200";
  } else if (milestone.status === "overdue" || diffDays < 0) {
    riskLevel = "High";
    riskColor = "text-red-600 bg-red-50 border-red-200";
  } else if (diffDays <= 90) {
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
              ? "This deadline requires immediate attention. Consider escalating to stakeholders and reviewing remediation options."
              : riskLevel === "Medium"
                ? "This deadline is approaching. Ensure all prerequisites are in progress and allocate resources accordingly."
                : milestone.status === "done"
                  ? "This milestone has been completed successfully. No further action required."
                  : "This deadline has sufficient lead time. Monitor periodically during the next refresh cycle."}
          </p>
        </div>
        <div className="bg-gray-50 rounded-md p-4 border border-gray-100 text-xs space-y-2">
          <p className="font-semibold text-gray-600">Suggestions</p>
          <ul className="list-disc list-inside text-gray-600 space-y-1">
            {milestone.status === "overdue" ? (
              <>
                <li>Review cure period provisions in {milestone.document_ref}</li>
                <li>Notify compliance team of breach risk</li>
                <li>Prepare status report for lender review</li>
              </>
            ) : milestone.status === "done" ? (
              <>
                <li>Archive completion documentation</li>
                <li>Update compliance dashboard</li>
              </>
            ) : (
              <>
                <li>Set reminder {diffDays > 30 ? "30" : "7"} days before deadline</li>
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
  detailMilestone: Milestone | null;
  onDetailStruct: (m: Milestone | null) => void;
  onDelete: (id: string) => void;
}

export default function StructuralDataLookup({
  data,
  isLoading,
  isRefreshing,
  lastRefreshed,
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
    if (!filterText.trim()) return data;
    const q = filterText.toLowerCase();
    return data.filter(
      (m) =>
        m.milestone_name.toLowerCase().includes(q) ||
        m.document_ref.toLowerCase().includes(q) ||
        m.context.toLowerCase().includes(q) ||
        m.status.includes(q) ||
        m.deadline_date.includes(q)
    );
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

        {/* Table — 5 columns (wider Actions) */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-fixed">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="w-[11%] px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Deadline
                </th>
                <th className="w-[25%] px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="w-[20%] px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Agreement / Context
                </th>
                <th className="w-[8%] px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="w-[36%] px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
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
                  <td colSpan={5} className="px-5 py-10 text-center text-gray-400">
                    No matching records found.
                  </td>
                </tr>
              ) : (
                paginatedData.map((entry) => (
                  <Fragment key={entry.id}>
                    <tr className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-4 py-3 text-gray-700 font-medium truncate">
                        {formatDate(entry.deadline_date)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 truncate">
                        {entry.milestone_name}
                      </td>
                      <td className="px-4 py-3 text-gray-500 truncate">
                        {entry.context}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={entry.status} />
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
                          <ActionBtn label="Delete" onClick={() => onDelete(entry.id)} variant="danger">
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
