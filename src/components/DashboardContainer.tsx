import { useState, useCallback } from "react";
import { useAgent } from "../hooks/useAgent";
import type { Trigger, ExportFile, Milestone } from "../hooks/useAgent";
import ChatInterface from "./ChatInterface";
import StructuralDataLookup from "./StructuralDataLookup";
import DeadlineCalendar from "./DeadlineCalendar";

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

function triggerStatusStyle(status: string, lastExec: string): {
  dot: string;
  text: string;
  bg: string;
  pulse: boolean;
} {
  const s = (lastExec || status || "").toLowerCase();
  if (s === "active")
    return { dot: "bg-[#6556d2]", text: "text-[#6556d2]", bg: "bg-[#6556d2]/10", pulse: true };
  if (s === "success" || s === "completed")
    return { dot: "bg-blue-500", text: "text-blue-600", bg: "bg-blue-50", pulse: false };
  if (s === "cancelled" || s === "disabled")
    return { dot: "bg-gray-400", text: "text-gray-500", bg: "bg-gray-100", pulse: false };
  if (s === "paused")
    return { dot: "bg-amber-400", text: "text-amber-600", bg: "bg-amber-50", pulse: false };
  if (s === "error" || s === "failed")
    return { dot: "bg-red-500", text: "text-red-600", bg: "bg-red-50", pulse: false };
  return { dot: "bg-gray-400", text: "text-gray-500", bg: "bg-gray-100", pulse: false };
}

function triggerStatusLabel(status: string, lastExec: string): string {
  const s = (lastExec || status || "unknown").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Trigger card icons ──────────────────────────────────────────────────────

function SettingsIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

function SmallClockIcon() {
  return (
    <svg className="h-3 w-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function Trash2SmallIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    </svg>
  );
}

// ── Edit Trigger Modal ────────────────────────────────────────────────────

function EditTriggerModal({
  trigger,
  onClose,
  onSave,
}: {
  trigger: Trigger;
  onClose: () => void;
  onSave: (fields: Partial<Pick<Trigger, "frequency" | "recipient_email" | "scheduled_end" | "label" | "status" | "prompt">>) => Promise<boolean>;
}) {
  const [label, setLabel] = useState(trigger.label);
  const [frequency, setFrequency] = useState(trigger.frequency || "daily");
  const [status, setStatus] = useState(trigger.status);
  const [email, setEmail] = useState(trigger.recipient_email);
  const [scheduledEnd, setScheduledEnd] = useState(trigger.scheduled_end ? trigger.scheduled_end.slice(0, 10) : "");
  const [prompt, setPrompt] = useState(trigger.prompt || "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave({ label, frequency, status, recipient_email: email, scheduled_end: scheduledEnd || undefined, prompt });
    setSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 overflow-hidden max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <h3 className="text-sm font-semibold text-gray-800">Edit Trigger</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer text-lg leading-none">&times;</button>
        </div>
        <div className="px-5 py-4 space-y-3 overflow-auto flex-1">
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Label</label>
            <input value={label} onChange={(e) => setLabel(e.target.value)} className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#6556d2]/40 focus:border-[#6556d2]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Frequency</label>
              <select value={frequency} onChange={(e) => setFrequency(e.target.value)} className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#6556d2]/40 focus:border-[#6556d2]">
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#6556d2]/40 focus:border-[#6556d2]">
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Recipient Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#6556d2]/40 focus:border-[#6556d2]" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Scheduled End</label>
            <input type="date" value={scheduledEnd} onChange={(e) => setScheduledEnd(e.target.value)} className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#6556d2]/40 focus:border-[#6556d2]" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder="AI instruction that drives this trigger…"
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#6556d2]/40 focus:border-[#6556d2] resize-y"
            />
          </div>
        </div>
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-end gap-2 flex-shrink-0">
          <button onClick={onClose} className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 text-xs font-medium text-white bg-[#6556d2] rounded-md hover:bg-[#5445b5] cursor-pointer disabled:opacity-50 flex items-center gap-1.5">
            {saving && (
              <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete Confirmation Modal ────────────────────────────────────────────

function DeleteTriggerModal({
  trigger,
  onClose,
  onConfirm,
}: {
  trigger: Trigger;
  onClose: () => void;
  onConfirm: () => Promise<boolean>;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    await onConfirm();
    setDeleting(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-xs mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 text-center">
          <div className="mx-auto h-10 w-10 rounded-full bg-red-50 flex items-center justify-center mb-3">
            <svg className="h-5 w-5 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-gray-800">Delete Trigger</h3>
          <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
            Are you sure you want to delete <span className="font-medium text-gray-700">"{trigger.label}"</span>? This action cannot be undone.
          </p>
        </div>
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-center gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer">Cancel</button>
          <button onClick={handleDelete} disabled={deleting} className="px-3 py-1.5 text-xs font-medium text-white bg-red-500 rounded-md hover:bg-red-600 cursor-pointer disabled:opacity-50">
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Triggers Panel (production API) ─────────────────────────────────────────

function TriggersPanel({
  triggers,
  isLoading,
  onUpdate,
  onDelete,
}: {
  triggers: Trigger[];
  isLoading: boolean;
  onUpdate: (id: string, fields: Partial<Pick<Trigger, "frequency" | "recipient_email" | "scheduled_end" | "label" | "status" | "prompt">>) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}) {
  const [editTrigger, setEditTrigger] = useState<Trigger | null>(null);
  const [deletingTrigger, setDeletingTrigger] = useState<Trigger | null>(null);

  return (
    <>
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
          <ul className="divide-y divide-gray-50 max-h-[420px] overflow-y-auto">
            {triggers.map((t) => {
              const style = triggerStatusStyle(t.status, t.last_execution_status);
              return (
                <li key={t.id} className="px-4 py-3 group hover:bg-gray-50/60 transition-colors">
                  {/* Row 1: Label + action buttons */}
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-700 leading-snug">{t.label}</p>
                    <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setEditTrigger(t)}
                        title="Edit trigger"
                        className="p-1 text-[#6556d2] hover:bg-[#6556d2]/10 rounded transition-colors cursor-pointer"
                      >
                        <SettingsIcon />
                      </button>
                      <button
                        onClick={() => setDeletingTrigger(t)}
                        title="Delete trigger"
                        className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors cursor-pointer"
                      >
                        <Trash2SmallIcon />
                      </button>
                    </div>
                  </div>
                  {/* Row 2: Frequency badge + Status badge */}
                  <div className="flex items-center gap-2 mt-1.5">
                    {t.frequency && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium text-[#6556d2] bg-[#6556d2]/10 rounded">
                        {t.frequency.charAt(0).toUpperCase() + t.frequency.slice(1)}
                      </span>
                    )}
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${style.bg}`}>
                      <span className={`inline-block h-1.5 w-1.5 rounded-full ${style.dot} ${style.pulse ? "animate-pulse" : ""}`} />
                      <span className={`text-[10px] font-medium ${style.text}`}>
                        {triggerStatusLabel(t.status, t.last_execution_status)}
                      </span>
                    </span>
                  </div>
                  {/* Row 3: Next run time */}
                  {t.next_run_at && (
                    <div className="flex items-center gap-1 mt-1.5 text-[10px] text-gray-400">
                      <SmallClockIcon />
                      <span>Next run: {formatTriggerDate(t.next_run_at)}</span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Edit modal */}
      {editTrigger && (
        <EditTriggerModal
          trigger={editTrigger}
          onClose={() => setEditTrigger(null)}
          onSave={(fields) => onUpdate(editTrigger.id, fields)}
        />
      )}

      {/* Delete confirmation modal */}
      {deletingTrigger && (
        <DeleteTriggerModal
          trigger={deletingTrigger}
          onClose={() => setDeletingTrigger(null)}
          onConfirm={() => onDelete(deletingTrigger.id)}
        />
      )}
    </>
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
          <h2 className="text-base font-semibold text-gray-800">Export templates</h2>
        </div>
      </div>

      <div className="px-5 py-3 border-b border-gray-50">
        <button
          onClick={onCreateCsv}
          disabled={isExporting}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#6556d2] rounded-md hover:bg-[#5445b5] active:bg-[#4a3a9e] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
                className="flex-shrink-0 px-3 py-1 text-xs font-medium text-[#6556d2] border border-[#6556d2]/30 rounded-md hover:bg-[#6556d2]/5 active:bg-[#6556d2]/10 transition-colors cursor-pointer"
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

  // Calendar → StructuralDataLookup modal bridge
  const [detailAction, setDetailAction] = useState<"info" | "importantInfo" | "deadlines" | null>(null);

  const handleCalendarInfo = useCallback((m: Milestone) => {
    agent.setDetailMilestone(m);
    setDetailAction("info");
  }, [agent]);

  const handleCalendarImportantInfo = useCallback((m: Milestone) => {
    agent.setDetailMilestone(m);
    setDetailAction("importantInfo");
  }, [agent]);

  const handleCalendarDeadlines = useCallback((m: Milestone) => {
    agent.setDetailMilestone(m);
    setDetailAction("deadlines");
  }, [agent]);

  const handleClearDetailAction = useCallback(() => {
    setDetailAction(null);
    agent.setDetailMilestone(null);
  }, [agent]);

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
              <span className="flex items-center gap-1.5 text-xs text-[#6556d2]">
                <SpinnerIcon className="h-3.5 w-3.5" />
                Processing…
              </span>
            )}
            {/* Calendar icon trigger (top-right corner) */}
            <DeadlineCalendar
              milestones={agent.data}
              onInfo={handleCalendarInfo}
              onImportantInfo={handleCalendarImportantInfo}
              onDeadlines={handleCalendarDeadlines}
            />
            <div className="h-8 w-8 rounded-full bg-[#6556d2] flex items-center justify-center text-white text-xs font-bold">
              TL
            </div>
          </div>
        </div>
      </header>

      {/* Grid: left center (Prompt + Data) | right sidebar (Triggers + Exports) */}
      <main className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
          {/* ── Left / Center: Chat + Data ───────────────────────────────── */}
          <div className="flex flex-col gap-6 min-w-0">
            <ChatInterface
              messages={agent.messages}
              onSendMessage={agent.sendMessage}
              onFileUpload={agent.handleFileUpload}
              isLoading={agent.isProcessing}
              isUploading={agent.isUploading}
              uploadingFileName={agent.uploadingFileName}
            />
            <StructuralDataLookup
              data={agent.data}
              isLoading={agent.isInitialLoading}
              isRefreshing={agent.isRefreshing}
              lastRefreshed={agent.lastRefreshed}
              fetchError={agent.fetchError}
              detailMilestone={agent.detailMilestone}
              detailAction={detailAction}
              onDetailStruct={agent.setDetailMilestone}
              onClearDetailAction={handleClearDetailAction}
              onDelete={agent.deleteMilestone}
              isUploading={agent.isUploading}
              uploadingFileName={agent.uploadingFileName}
            />
          </div>

          {/* ── Right sidebar: Triggers + Exports stacked ────────────────── */}
          <div className="flex flex-col gap-6">
            <TriggersPanel
              triggers={agent.triggers}
              isLoading={agent.isTriggersLoading}
              onUpdate={agent.updateTrigger}
              onDelete={agent.deleteTrigger}
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
