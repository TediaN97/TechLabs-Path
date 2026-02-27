import { Fragment, useState, useMemo } from "react";
import type { Milestone, MilestoneStatus } from "../hooks/useAgent";

// ── Icons ──────────────────────────────────────────────────────────────────────

function SearchIcon() {
  return (
    <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
    </svg>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
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
      <td className="px-4 py-3"><div className="h-4 w-44 bg-gray-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-32 bg-gray-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-28 bg-gray-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-14 bg-gray-200 rounded" /></td>
      <td className="px-4 py-3 text-right"><div className="h-7 w-20 bg-gray-200 rounded ml-auto" /></td>
    </tr>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

interface DataTableProps {
  data: Milestone[];
  isLoading: boolean;
}

export default function DataTable({ data, isLoading }: DataTableProps) {
  const [filterText, setFilterText] = useState("");
  const [detailsOpen, setDetailsOpen] = useState<string | null>(null);

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

  function toggleDetails(id: string) {
    setDetailsOpen(detailsOpen === id ? null : id);
  }

  return (
    <div className="bg-white shadow-sm rounded-lg min-w-0">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800">Data</h2>
          <span className="text-xs text-gray-400 font-medium">
            {isLoading ? "Loading…" : `${filtered.length} record${filtered.length !== 1 ? "s" : ""}`}
          </span>
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

      {/* Table — 6 columns */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm table-fixed">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="w-[12%] px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Deadline
              </th>
              <th className="w-[28%] px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Description
              </th>
              <th className="w-[18%] px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Doc. Reference
              </th>
              <th className="w-[22%] px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Agreement / Context
              </th>
              <th className="w-[8%] px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="w-[12%] px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
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
              filtered.map((entry) => (
                <Fragment key={entry.id}>
                  <tr className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-3 text-gray-700 font-medium truncate">
                      {formatDate(entry.deadline_date)}
                    </td>
                    <td className="px-4 py-3 text-gray-600 truncate">
                      {entry.milestone_name}
                    </td>
                    <td className="px-4 py-3 text-gray-500 truncate">
                      {entry.document_ref}
                    </td>
                    <td className="px-4 py-3 text-gray-500 truncate">
                      {entry.context}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={entry.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => toggleDetails(entry.id)}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-[#319795] rounded-md hover:bg-[#2C7A7B] active:bg-[#285E61] transition-colors cursor-pointer"
                      >
                        {detailsOpen === entry.id ? "Hide" : "View Details"}
                      </button>
                    </td>
                  </tr>

                  {detailsOpen === entry.id && (
                    <tr className="bg-gray-50/80">
                      <td colSpan={6} className="px-5 py-4">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                          <div>
                            <span className="font-semibold text-gray-500 uppercase tracking-wider">ID</span>
                            <p className="mt-1 text-gray-700 font-mono text-[11px] break-all">{entry.id}</p>
                          </div>
                          <div>
                            <span className="font-semibold text-gray-500 uppercase tracking-wider">Deadline</span>
                            <p className="mt-1 text-gray-700">{formatDate(entry.deadline_date)}</p>
                          </div>
                          <div>
                            <span className="font-semibold text-gray-500 uppercase tracking-wider">Document</span>
                            <p className="mt-1 text-gray-700">{entry.document_ref}</p>
                          </div>
                          <div>
                            <span className="font-semibold text-gray-500 uppercase tracking-wider">Context</span>
                            <p className="mt-1 text-gray-700">{entry.context}</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
