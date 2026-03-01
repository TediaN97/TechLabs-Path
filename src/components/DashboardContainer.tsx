import { useAgent } from "../hooks/useAgent";
import type { Trigger, ExportFile } from "../hooks/useAgent";
import ChatInterface from "./ChatInterface";
import StructuralDataLookup from "./StructuralDataLookup";

// ── Icons ──────────────────────────────────────────────────────────────────────

function ClockIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17v3a2 2 0 002 2h14a2 2 0 002-2v-3" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function SpinnerIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Trigger helpers ──────────────────────────────────────────────────────────

function formatTriggerDate(iso: string): string {
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

function triggerStatusColor(status: string, lastExec: string): { dot: string; text: string } {
  const s = (lastExec || status || "").toLowerCase();
  if (s === "success" || s === "completed")
    return { dot: "bg-emerald-500", text: "text-emerald-600" };
  if (s === "error" || s === "failed")
    return { dot: "bg-red-500", text: "text-red-600" };
  return { dot: "bg-gray-400", text: "text-gray-500" };
}

function triggerStatusLabel(status: string, lastExec: string): string {
  const s = (lastExec || status || "unknown").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Triggers Panel (production API) ─────────────────────────────────────────

function TriggersPanel({
  triggers,
  isLoading,
}: {
  triggers: Trigger[];
  isLoading: boolean;
}) {
  return (
    <div className="bg-white shadow-sm rounded-lg">
      <div className="px-5 py-3.5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <ClockIcon />
          <h2 className="text-base font-semibold text-gray-800">Triggers</h2>
        </div>
        <p className="mt-1 text-xs text-gray-400">Automated workflows</p>
      </div>

      {isLoading ? (
        <div className="px-5 py-8 flex items-center justify-center gap-2 text-sm text-gray-400">
          <SpinnerIcon className="h-3.5 w-3.5" />
          Loading triggers…
        </div>
      ) : triggers.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-gray-400">
          No triggers found.
        </div>
      ) : (
        <ul className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
          {triggers.map((t) => {
            const color = triggerStatusColor(t.status, t.last_execution_status);
            return (
              <li key={t.id} className="px-5 py-3">
                <p className="text-sm text-gray-700 leading-snug">{t.label}</p>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-[11px] text-gray-400">
                    {formatTriggerDate(t.created_at)}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className={`inline-block h-1.5 w-1.5 rounded-full ${color.dot}`} />
                    <span className={`text-[11px] font-medium ${color.text}`}>
                      {triggerStatusLabel(t.status, t.last_execution_status)}
                    </span>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── Exports Panel ──────────────────────────────────────────────────────────────

function ExportsPanel({
  exportFiles,
  isExporting,
  onCreateCsv,
}: {
  exportFiles: ExportFile[];
  isExporting: boolean;
  onCreateCsv: () => void;
}) {
  return (
    <div className="bg-white shadow-sm rounded-lg">
      <div className="px-5 py-3.5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <DownloadIcon />
          <h2 className="text-base font-semibold text-gray-800">Exports</h2>
        </div>
      </div>

      <div className="px-5 py-3 border-b border-gray-50">
        <button
          onClick={onCreateCsv}
          disabled={isExporting}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#319795] rounded-md hover:bg-[#2C7A7B] active:bg-[#285E61] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isExporting ? <SpinnerIcon className="h-3 w-3" /> : <FileIcon />}
          Create CSV Export
        </button>
      </div>

      {exportFiles.length === 0 ? (
        <div className="px-5 py-5 text-center text-sm text-gray-400">
          No exports yet.
        </div>
      ) : (
        <ul className="divide-y divide-gray-50 max-h-60 overflow-y-auto">
          {exportFiles.map((f) => (
            <li key={f.id} className="px-5 py-2.5 flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs text-gray-700 font-medium truncate">{f.filename}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {f.record_count} records &middot; {formatTimestamp(f.created_at)}
                </p>
              </div>
              <a
                href={f.blob_url}
                download={f.filename}
                className="flex-shrink-0 px-3 py-1 text-xs font-medium text-[#319795] border border-[#319795]/30 rounded-md hover:bg-[#319795]/5 active:bg-[#319795]/10 transition-colors cursor-pointer"
              >
                Download
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Main Dashboard Container ───────────────────────────────────────────────────

export default function DashboardContainer() {
  const agent = useAgent();
  const isLoading = agent.isProcessing || agent.isExporting || agent.isUploading;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14">
          <h1 className="text-lg font-bold text-gray-800 tracking-tight">
            TechPath Labs
          </h1>
          <div className="flex items-center gap-3">
            {isLoading && (
              <span className="flex items-center gap-1.5 text-xs text-[#319795]">
                <SpinnerIcon className="h-3.5 w-3.5" />
                Processing…
              </span>
            )}
            <div className="h-8 w-8 rounded-full bg-[#319795] flex items-center justify-center text-white text-xs font-bold">
              TL
            </div>
          </div>
        </div>
      </header>

      {/* Grid: left center (Prompt + Data) | right sidebar (Triggers + Exports) */}
      <main className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          {/* ── Left / Center: Chat + Data ───────────────────────────────── */}
          <div className="flex flex-col gap-6 min-w-0">
            <ChatInterface
              messages={agent.messages}
              onSendMessage={agent.sendMessage}
              onFileUpload={agent.handleFileUpload}
              isLoading={agent.isProcessing}
              isUploading={agent.isUploading}
            />
            <StructuralDataLookup
              data={agent.data}
              isLoading={agent.isInitialLoading}
              isRefreshing={agent.isRefreshing}
              lastRefreshed={agent.lastRefreshed}
              fetchError={agent.fetchError}
              detailMilestone={agent.detailMilestone}
              onDetailStruct={agent.setDetailMilestone}
              onDelete={agent.deleteMilestone}
            />
          </div>

          {/* ── Right sidebar: Triggers + Exports stacked ────────────────── */}
          <div className="flex flex-col gap-6">
            <TriggersPanel
              triggers={agent.triggers}
              isLoading={agent.isTriggersLoading}
            />
            <ExportsPanel
              exportFiles={agent.exports}
              isExporting={agent.isExporting}
              onCreateCsv={agent.createCsvExport}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
