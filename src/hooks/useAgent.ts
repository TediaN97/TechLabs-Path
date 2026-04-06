import { useState, useCallback, useEffect, useRef } from "react";
import type { ChatMessage } from "../components/ChatInterface";

// ── Types ──────────────────────────────────────────────────────────────────────

export type MilestoneStatus = "done" | "overdue" | "pending";

export interface ContractingParty {
  name: string;
  role: string;
}

export interface ResolutionHint {
  frequency?: string;
  human_rule?: string;
  next_occurrence?: string;
}

export interface DeadlineEntry {
  description: string;
  date_raw: string;
  date_parsed?: string;
  section_title: string;
  section_index: string | number;
  deadline_type?: "explicit_date" | "semantic_deadline";
  days_remaining?: number | null;
  status_category?: string;
  urgency?: "high" | "medium" | "low";
  resolution_hint?: ResolutionHint;
}

export interface DeadlineSummary {
  total: number;
  overdue: number;
  needs_resolution: number;
  upcoming: number;
  completed: number;
}

export interface Milestone {
  id: string;
  deadline_date: string;
  milestone_name: string;
  document_ref: string;
  context: string;
  status: MilestoneStatus;
  raw_status: string;
  document_id?: string;
  contracting_parties?: ContractingParty[];
  deadlines?: DeadlineEntry[];
  deadline_summary?: DeadlineSummary;
  file_name: string;
  upload_time: string;
  description: string;
  lender: string;
  borrower: string;
}

export interface Execution {
  id: string;
  executed_at: string;
  label: string;
}

export interface ExportFile {
  id: string;
  filename: string;
  created_at: string;
  record_count: number;
  blob_url: string;
}

export interface ExportTemplate {
  filename: string;
  prompt: string;
  source_file: string;
  edited_file: string;
  created_at: string;
}

// ── API response types ─────────────────────────────────────────────────────────

interface ApiDeadlineEntry {
  description: string;
  date_raw: string;
  date_parsed?: string;
  section_title: string;
  section_index: string | number;
  deadline_type?: "explicit_date" | "semantic_deadline";
  days_remaining?: number | null;
  status_category?: string;
  urgency?: "high" | "medium" | "low";
  resolution_hint?: { frequency?: string; human_rule?: string; next_occurrence?: string };
}

interface ApiDocument {
  document_id: string;
  file_name: string;
  description: string;
  upload_time: string;
  status: string;
  contracting_parties?: { name: string; role: string }[];
  deadlines?: ApiDeadlineEntry[];
  deadline_summary?: {
    total: number;
    overdue: number;
    needs_resolution: number;
    upcoming?: number;
    completed?: number;
  };
}

interface GetAllDocumentsResponse {
  documents: ApiDocument[];
  total: number;
}

function mapApiStatus(status: string): MilestoneStatus {
  if (status === "vectorized") return "done";
  if (status === "error" || status === "failed") return "overdue";
  return "pending";
}

function extractPartyName(
  parties: { name: string; role: string }[] | undefined,
  ...roles: string[]
): string {
  if (!parties?.length) return "-";
  const lowerRoles = roles.map((r) => r.toLowerCase());
  const match = parties.find((p) => lowerRoles.includes(p.role.toLowerCase()));
  return match?.name || "-";
}

function computeDeadlineSummary(deadlines: ApiDeadlineEntry[]): DeadlineSummary {
  let overdue = 0;
  let needsResolution = 0;
  let upcoming = 0;
  let completed = 0;

  for (const dl of deadlines) {
    const cat = (dl.status_category || "").toLowerCase();
    if (cat === "overdue" || (dl.days_remaining != null && dl.days_remaining < 0)) {
      overdue++;
    } else if (dl.deadline_type === "semantic_deadline") {
      needsResolution++;
    } else if (cat === "completed" || cat === "done") {
      completed++;
    } else {
      upcoming++;
    }
  }

  return { total: deadlines.length, overdue, needs_resolution: needsResolution, upcoming, completed };
}

function mapDocumentToMilestone(doc: ApiDocument): Milestone {
  const uploadDate = new Date(doc.upload_time);
  const deadlineDate = isNaN(uploadDate.getTime())
    ? new Date().toISOString().slice(0, 10)
    : uploadDate.toISOString().slice(0, 10);

  const parties = doc.contracting_parties ?? [];
  const rawDeadlines = doc.deadlines ?? [];

  // Map API deadlines to DeadlineEntry with all new fields
  const deadlines: DeadlineEntry[] = rawDeadlines.map((dl) => ({
    description: dl.description,
    date_raw: dl.date_raw,
    date_parsed: dl.date_parsed,
    section_title: dl.section_title,
    section_index: dl.section_index,
    deadline_type: dl.deadline_type,
    days_remaining: dl.days_remaining,
    status_category: dl.status_category,
    urgency: dl.urgency,
    resolution_hint: dl.resolution_hint,
  }));

  // Use API-provided summary or compute from deadlines
  const deadline_summary: DeadlineSummary = doc.deadline_summary
    ? {
        total: doc.deadline_summary.total,
        overdue: doc.deadline_summary.overdue,
        needs_resolution: doc.deadline_summary.needs_resolution,
        upcoming: doc.deadline_summary.upcoming ?? 0,
        completed: doc.deadline_summary.completed ?? 0,
      }
    : computeDeadlineSummary(rawDeadlines);

  return {
    id: doc.document_id,
    deadline_date: deadlineDate,
    milestone_name: doc.description || "No description",
    document_ref: doc.file_name || "—",
    context: doc.file_name || "—",
    status: mapApiStatus(doc.status),
    raw_status: doc.status || "unknown",
    document_id: doc.document_id,
    contracting_parties: parties,
    deadlines,
    deadline_summary,
    file_name: doc.file_name || "—",
    upload_time: doc.upload_time || "",
    description: doc.description || "No description",
    lender: extractPartyName(parties, "Lender", "Agent and Lender"),
    borrower: extractPartyName(parties, "Borrower"),
  };
}

// ── Config ────────────────────────────────────────────────────────────────────

/** n8n AI-agent chat webhook */
const N8N_CHAT_URL =
  "https://20.110.72.120.nip.io/webhook/chat";

/** n8n chat-with-document webhook (CSV/XLSX) */
const CHAT_WITH_DOC_URL =
  "https://20.110.72.120.nip.io/webhook/chat_with_doc";

/** Production API endpoint for fetching all documents */
const DATA_REFRESH_URL =
  "https://20.110.72.120.nip.io/webhook/getAllDocuments";

/** Production API endpoint for uploading files */
const FILE_UPLOAD_URL =
  "https://20.110.72.120.nip.io/webhook/uploadFile";

/** Production API endpoint for deleting files */
const DELETE_FILE_URL =
  "https://20.110.72.120.nip.io/webhook/deleteFile";

/** Production API endpoint for fetching triggers */
const TRIGGERS_URL =
  "https://20.110.72.120.nip.io/webhook/triggers";

/** Fetch all export template documents */
const EXPORT_TEMPLATES_URL =
  "https://20.110.72.120.nip.io/webhook/chat_with_doc_getall";

/** Download an export file by OneDrive file_id */
const DOWNLOAD_FILE_URL =
  "https://20.110.72.120.nip.io/webhook/download-file/downloadFile";

/** Delete an export template document */
const DELETE_EXPORT_TEMPLATE_URL =
  "https://20.110.72.120.nip.io/webhook/chat-api/chat_with_doc_delete";

/** Rename an export template document */
const RENAME_EXPORT_TEMPLATE_URL =
  "https://20.110.72.120.nip.io/webhook/chat_with_doc_edit_name";

/** Calendar timeframe endpoint (used by useCalendarTimeframe hook) */
export const CALENDAR_TIMEFRAME_URL =
  "https://20.110.72.120.nip.io/webhook/calendar/timeframe";

const REFRESH_INTERVAL_MS = 30_000;

// ── Helpers ────────────────────────────────────────────────────────────────────

function uid(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

function simulateApi<T>(result: T, delayMs = 800): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(result), delayMs));
}

// ── Session management ────────────────────────────────────────────────────────

const SESSION_STORAGE_KEY = "techpath_session_id";

function getOrCreateSessionId(): string {
  try {
    let sessionId = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
    }
    return sessionId;
  } catch {
    // localStorage may be unavailable (private browsing, quota exceeded, etc.)
    return crypto.randomUUID();
  }
}

// ── n8n Chat webhook ─────────────────────────────────────────────────────────

/**
 * POST to the n8n AI-agent chat webhook.
 * Sends { session_id, message } and returns the raw JSON response.
 */
async function sendChatMessage(
  message: string
): Promise<unknown[] | null> {
  try {
    const sessionId = getOrCreateSessionId();
    const res = await fetch(N8N_CHAT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "sendMessage",
        session_id: sessionId,
        sessionId,
        message,
        chatInput: message,
        timezone: (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return "Europe/Bratislava"; } })(),
        utc_offset: (() => { try { const o = -new Date().getTimezoneOffset() / 60; return Number.isFinite(o) ? o : 2; } catch { return 2; } })(),
      }),
    });
    if (!res.ok) {
      console.warn("[Chat] n8n returned HTTP", res.status);
      return null;
    }
    // Read body as text first to handle empty responses
    const text = await res.text();
    if (!text || text.trim().length === 0) {
      console.warn("[Chat] n8n returned empty body (200 OK). Check that the workflow has a 'Respond to Webhook' node sending data back.");
      return null;
    }
    const json = JSON.parse(text);
    console.log("[Chat] n8n response:", json);
    // The API returns an array
    return Array.isArray(json) ? json : [json];
  } catch (err) {
    console.error("[Chat] request failed:", err);
    return null;
  }
}

/** Content types that indicate a file/binary response from chat_with_doc */
const FILE_CONTENT_TYPES = [
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream",
];

/** Result type for chat_with_doc: either JSON or a downloadable file */
interface ChatWithDocResult {
  kind: "json" | "file";
  json?: unknown[];
  file?: { blob: Blob; fileName: string; mimeType: string };
}

/**
 * Extract filename from Content-Disposition header.
 * Handles: attachment; filename="report.csv"  or  attachment; filename=report.csv
 */
function parseContentDispositionFilename(header: string | null): string | null {
  if (!header) return null;
  // Try quoted filename first: filename="..."
  const quoted = header.match(/filename\*?=["']?([^"';\n]+)["']?/i);
  return quoted?.[1]?.trim() || null;
}

/**
 * Generate a fallback filename based on content type and current timestamp.
 */
function generateFallbackFilename(mimeType: string): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  if (mimeType.includes("spreadsheetml") || mimeType.includes("xlsx")) {
    return `export-${ts}.xlsx`;
  }
  return `export-${ts}.csv`;
}

/**
 * POST to the n8n chat-with-document webhook.
 * Sends multipart/form-data with file, message, and session_id.
 *
 * The backend may respond with JSON (normal chat reply) or a binary file.
 * We inspect Content-Type to decide how to handle the response.
 */
async function sendChatWithDoc(
  message: string,
  file: File
): Promise<ChatWithDocResult | null> {
  try {
    const sessionId = getOrCreateSessionId();
    const formData = new FormData();
    formData.append("file", file);
    formData.append("message", message);
    formData.append("session_id", sessionId);

    const res = await fetch(CHAT_WITH_DOC_URL, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      console.warn("[ChatWithDoc] n8n returned HTTP", res.status);
      return null;
    }

    // ── Detect file vs JSON response ──────────────────────────────────
    const contentType = (res.headers.get("Content-Type") || "").toLowerCase();
    const isFileResponse = FILE_CONTENT_TYPES.some((ft) =>
      contentType.includes(ft)
    );

    if (isFileResponse) {
      const blob = await res.blob();
      const dispositionName = parseContentDispositionFilename(
        res.headers.get("Content-Disposition")
      );
      const fileName = dispositionName || generateFallbackFilename(contentType);
      console.log("[ChatWithDoc] file response:", fileName, contentType);
      return {
        kind: "file",
        file: { blob, fileName, mimeType: contentType },
      };
    }

    // ── Fallback: treat as JSON (existing behavior) ───────────────────
    const text = await res.text();
    if (!text || text.trim().length === 0) {
      console.warn("[ChatWithDoc] n8n returned empty body.");
      return null;
    }
    const json = JSON.parse(text);
    console.log("[ChatWithDoc] n8n response:", json);
    return {
      kind: "json",
      json: Array.isArray(json) ? json : [json],
    };
  } catch (err) {
    console.error("[ChatWithDoc] request failed:", err);
    return null;
  }
}

/**
 * Extract the last assistant message from the n8n chat response.
 *
 * Response shape: an array whose first element has a stringified `history`
 * field containing a JSON array of { role, content } objects.
 *
 * We parse that history string, walk it backwards to find the last
 * entry with role === "assistant", and return only its content.
 */
function extractAssistantReply(responseArray: unknown[]): string | null {
  try {
    if (!responseArray.length) return null;

    const first = responseArray[0] as Record<string, unknown>;
    const historyRaw = first?.history;

    // history may already be an array or a stringified JSON array
    let history: { role: string; content: string }[];
    if (typeof historyRaw === "string") {
      history = JSON.parse(historyRaw);
    } else if (Array.isArray(historyRaw)) {
      history = historyRaw as { role: string; content: string }[];
    } else {
      // Fallback: check if there's a direct "output" or "reply" field
      const fallback = first?.output ?? first?.reply ?? first?.text;
      return typeof fallback === "string" ? fallback : null;
    }

    if (!Array.isArray(history) || history.length === 0) return null;

    // Walk backwards to find the last assistant message
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].role === "assistant" && history[i].content) {
        return history[i].content;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Extract intent from n8n response array.
 * The intent may be on the first response object as `intent`.
 */
function extractIntent(responseArray: unknown[]): string | undefined {
  try {
    if (!responseArray.length) return undefined;
    const first = responseArray[0] as Record<string, unknown>;
    const intent = first?.intent;
    return typeof intent === "string" ? intent : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Detect if the assistant's reply indicates a data change that
 * should trigger a table refresh.
 */
function replyIndicatesDataChange(text: string): boolean {
  const lower = text.toLowerCase();
  const triggers = [
    "uploaded", "deleted", "removed", "created", "updated",
    "modified", "added", "saved", "processed", "imported",
    "sent", "executed",
  ];
  return triggers.some((t) => lower.includes(t));
}

/**
 * GET the production API to fetch all documents.
 * Returns the parsed response on success, or `null` on failure.
 */
async function fetchAllDocuments(): Promise<GetAllDocumentsResponse | null> {
  try {
    const res = await fetch(DATA_REFRESH_URL, { method: "GET" });
    if (!res.ok) return null;
    return (await res.json()) as GetAllDocumentsResponse;
  } catch {
    return null;
  }
}

// ── Trigger types & fetch ─────────────────────────────────────────────────────

export interface Trigger {
  id: string;
  label: string;
  created_at: string;
  status: string;
  last_execution_status: string;
  frequency: string;
  next_run_at: string;
  recipient_email: string;
  scheduled_end: string;
  prompt: string;
  time: string;
  day_of_week: string;
  day_of_month: string;
}

/**
 * GET the production API to fetch all triggers.
 * Response shape: { ok: boolean, triggers: { ... } | [ ... ] }
 * Returns the parsed array on success, or `null` on failure.
 */
async function fetchTriggers(): Promise<Trigger[] | null> {
  try {
    const res = await fetch(TRIGGERS_URL, { method: "GET" });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text || text.trim().length === 0) return null;
    const json = JSON.parse(text);

    // Unwrap: API may return { ok, triggers } wrapper or a bare array
    let raw: Record<string, unknown>[];
    if (json && typeof json === "object" && !Array.isArray(json) && json.triggers) {
      const inner = json.triggers;
      raw = Array.isArray(inner) ? inner : [inner];
    } else if (Array.isArray(json)) {
      raw = json;
    } else {
      raw = [json];
    }

    const arr: Trigger[] = raw.map(
      (t: Record<string, unknown>, idx: number) => ({
        id: (t.id as string) || String(idx),
        label: (t.label as string) || "Untitled trigger",
        created_at: (t.created_at as string) || "",
        status: (t.status as string) || "unknown",
        last_execution_status: (t.last_execution_status as string) || "unknown",
        frequency: (t.frequency as string) || "",
        next_run_at: (t.next_run_at as string) || "",
        recipient_email: (t.recipient_email as string) || "",
        scheduled_end: (t.scheduled_end as string) || "",
        prompt: (t.prompt as string) || "",
        time: (t.time as string) || "",
        day_of_week: (t.day_of_week as string) || "",
        day_of_month: (t.day_of_month as string) || "",
      })
    );
    // Sort by created_at descending (most recent first)
    arr.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    return arr;
  } catch {
    return null;
  }
}

/**
 * Convert 12-hour AM/PM time string to 24-hour HH:MM format.
 * e.g. "02:30 PM" → "14:30", "12:00 AM" → "00:00", "12:30 PM" → "12:30"
 */
function to24h(time12: string): string {
  const m = time12.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return time12; // fallback: return as-is
  let h = parseInt(m[1], 10);
  const min = m[2];
  const period = m[3].toUpperCase();
  if (period === "AM" && h === 12) h = 0;
  else if (period === "PM" && h !== 12) h += 12;
  return `${String(h).padStart(2, "0")}:${min}`;
}

/**
 * Map weekday name → numeric string for the backend run_day field.
 * Sunday = "0", Monday = "1", …, Saturday = "6"
 */
const WEEKDAY_TO_NUM: Record<string, string> = {
  sunday: "0",
  monday: "1",
  tuesday: "2",
  wednesday: "3",
  thursday: "4",
  friday: "5",
  saturday: "6",
};

/**
 * Build run_day / run_date based STRICTLY on frequency.
 *
 *  weekly  → run_day = mapped number,  run_date = null
 *  monthly → run_day = null,           run_date = day-of-month string
 *  other   → run_day = null,           run_date = null
 */
function buildRunFields(
  frequency: string,
  dayOfWeek: string | undefined,
  dayOfMonth: string | undefined
): { run_day: string | null; run_date: string | null } {
  if (frequency === "weekly") {
    return {
      run_day: WEEKDAY_TO_NUM[(dayOfWeek || "monday").toLowerCase()] ?? "1",
      run_date: null,
    };
  }
  if (frequency === "monthly") {
    return {
      run_day: null,
      run_date: String(dayOfMonth || "1"),
    };
  }
  // daily / hourly — neither field applies
  return { run_day: null, run_date: null };
}

/**
 * PATCH a trigger (edit fields).
 *
 * Backend expects: { id, frequency, run_time, run_day, run_date,
 *                    recipient_email, label, status, scheduled_end }
 *
 * The UI form works with `time` (AM/PM), `day_of_week`, `day_of_month`.
 * This function transforms them into the backend's expected field names
 * and enforces mutual exclusivity of run_day / run_date.
 */
async function patchTrigger(
  id: string,
  fields: Partial<Pick<Trigger, "frequency" | "recipient_email" | "scheduled_end" | "label" | "status" | "prompt" | "time" | "day_of_week" | "day_of_month">>
): Promise<boolean> {
  try {
    const freq = fields.frequency || "daily";

    // Strictly derive run_day / run_date from frequency
    const { run_day, run_date } = buildRunFields(
      freq,
      fields.day_of_week,
      fields.day_of_month
    );

    // Convert AM/PM time → 24-hour HH:MM
    const run_time = fields.time ? to24h(fields.time) : null;

    const payload = {
      id,
      frequency: freq,
      run_time,
      run_day,
      run_date,
      recipient_email: fields.recipient_email ?? null,
      label: fields.label ?? null,
      status: fields.status ?? null,
      scheduled_end: fields.scheduled_end || null,
    };

    const res = await fetch(TRIGGERS_URL, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return false;
    const text = await res.text();
    if (!text) return true;
    const json = JSON.parse(text);
    return json?.ok !== false;
  } catch {
    return false;
  }
}

/**
 * DELETE a trigger.
 */
/**
 * DELETE a file/document and all its analyzed data.
 */
export interface DeleteFileResult {
  success: boolean;
  message: string;
}

async function deleteFileApi(docId: string): Promise<DeleteFileResult> {
  try {
    const res = await fetch(DELETE_FILE_URL, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doc_id: docId }),
    });
    if (!res.ok) return { success: false, message: `HTTP ${res.status}` };
    const text = await res.text();
    if (!text) return { success: true, message: "File deleted successfully." };
    const json = JSON.parse(text);
    return {
      success: json.success !== false,
      message: json.message || "File deleted successfully.",
    };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : "Unknown error" };
  }
}

async function deleteTriggerApi(id: string): Promise<boolean> {
  try {
    const res = await fetch(TRIGGERS_URL, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) return false;
    const text = await res.text();
    if (!text) return true;
    const json = JSON.parse(text);
    return json?.ok !== false;
  } catch {
    return false;
  }
}

/**
 * POST to fetch all export template documents.
 */
async function fetchExportTemplates(): Promise<ExportTemplate[] | null> {
  try {
    const res = await fetch(EXPORT_TEMPLATES_URL, { method: "POST" });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text || text.trim().length === 0) return null;
    const json = JSON.parse(text);
    // Response may be { data: [...] } or a bare array
    const items = json?.data ?? json;
    const raw: Record<string, unknown>[] = Array.isArray(items) ? items : [items];
    return raw.map((t) => ({
      filename: (t.filename as string) || (t.name as string) || "Untitled",
      prompt: (t.prompt as string) || "",
      // API has a typo: "souce_file" (missing 'r') — handle both spellings
      source_file: (t.source_file as string) || (t.souce_file as string) || "",
      edited_file: (t.edited_file as string) || "",
      created_at: (t.created_at as string) || "",
    }));
  } catch {
    return null;
  }
}

/**
 * Download an export file using its OneDrive file_id (edited_file).
 * Uses GET with a JSON body containing { file_id }.
 */
async function downloadExportFile(fileId: string, filename: string): Promise<void> {
  try {
    const url = `${DOWNLOAD_FILE_URL}/${encodeURIComponent(fileId)}`;
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      throw new Error(`Download failed (HTTP ${res.status})`);
    }
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename || "export-file";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch (err) {
    console.error("[Download] failed:", err);
    alert(err instanceof Error ? err.message : "Download failed. Please try again.");
  }
}

/**
 * POST to chat_with_doc in reload/update mode (no file, uses file_id instead).
 */
async function sendChatWithDocReload(
  message: string,
  sourceFileId: string
): Promise<ChatWithDocResult | null> {
  try {
    const sessionId = getOrCreateSessionId();
    const formData = new FormData();
    formData.append("message", message);
    formData.append("file_id", sourceFileId);
    formData.append("session_id", sessionId);

    const res = await fetch(CHAT_WITH_DOC_URL, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      console.warn("[ChatWithDocReload] n8n returned HTTP", res.status);
      return null;
    }

    const contentType = (res.headers.get("Content-Type") || "").toLowerCase();
    const isFileResponse = FILE_CONTENT_TYPES.some((ft) =>
      contentType.includes(ft)
    );

    if (isFileResponse) {
      const blob = await res.blob();
      const dispositionName = parseContentDispositionFilename(
        res.headers.get("Content-Disposition")
      );
      const fileName = dispositionName || generateFallbackFilename(contentType);
      return { kind: "file", file: { blob, fileName, mimeType: contentType } };
    }

    const text = await res.text();
    if (!text || text.trim().length === 0) return null;
    const json = JSON.parse(text);
    return { kind: "json", json: Array.isArray(json) ? json : [json] };
  } catch (err) {
    console.error("[ChatWithDocReload] request failed:", err);
    return null;
  }
}

export function deriveStatus(deadline: string, explicit?: MilestoneStatus): MilestoneStatus {
  if (explicit) return explicit;
  const d = new Date(deadline + "T23:59:59");
  if (isNaN(d.getTime())) return "pending";
  return d < new Date() ? "overdue" : "pending";
}

// ── HTML Table Parser ──────────────────────────────────────────────────────────

export function parseHtmlTable(html: string): Milestone[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const table = doc.querySelector("table");
  if (!table) return [];

  const rows = table.querySelectorAll("tr");
  const milestones: Milestone[] = [];

  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i].querySelectorAll("td, th");
    if (cells.length < 2) continue;
    const t = Array.from(cells).map((c) => c.textContent?.trim() ?? "");
    const deadline = t[0] || new Date().toISOString().slice(0, 10);
    const statusRaw = (t[4] || "").toLowerCase();
    const status: MilestoneStatus =
      statusRaw === "done" ? "done" : statusRaw === "overdue" ? "overdue" : deriveStatus(deadline);
    milestones.push({
      id: uid(),
      deadline_date: deadline,
      milestone_name: t[1] || `Row ${i}`,
      document_ref: t[2] || "—",
      context: t[3] || "Imported",
      status,
      raw_status: statusRaw || status,
      file_name: t[2] || "—",
      upload_time: deadline,
      description: t[1] || `Row ${i}`,
      lender: "-",
      borrower: "-",
    });
  }
  return milestones;
}

// ── CSV Text Parser ────────────────────────────────────────────────────────────

export function parseCsvText(csv: string): Milestone[] {
  const lines = csv.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  const milestones: Milestone[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i]
      .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
      .map((c) => c.replace(/^"|"$/g, "").trim());
    if (cells.length < 2) continue;
    const deadline = cells[0] || new Date().toISOString().slice(0, 10);
    const statusRaw = (cells[4] || "").toLowerCase();
    const status: MilestoneStatus =
      statusRaw === "done" ? "done" : statusRaw === "overdue" ? "overdue" : deriveStatus(deadline);
    milestones.push({
      id: uid(),
      deadline_date: deadline,
      milestone_name: cells[1] || `Row ${i}`,
      document_ref: cells[2] || "—",
      context: cells[3] || "Imported",
      status,
      raw_status: statusRaw || status,
      file_name: cells[2] || "—",
      upload_time: deadline,
      description: cells[1] || `Row ${i}`,
      lender: "-",
      borrower: "-",
    });
  }
  return milestones;
}

// ── CSV export generator ───────────────────────────────────────────────────────

export function generateCsvExport(data: Milestone[]): string {
  const header = "Name,Upload Date,Lender,Borrower,Status";
  const rows = data.map(
    (m) =>
      `"${m.file_name}","${m.upload_time}","${m.lender}","${m.borrower}",${m.status}`
  );
  return [header, ...rows].join("\n");
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useAgent() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [data, setData] = useState<Milestone[]>([]);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [exports, setExports] = useState<ExportFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string>(now());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingFileName, setUploadingFileName] = useState("");
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [detailMilestone, setDetailMilestone] = useState<Milestone | null>(null);
  const [previewMilestone, setPreviewMilestone] = useState<Milestone | null>(null);
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [isTriggersLoading, setIsTriggersLoading] = useState(true);
  const [exportTemplates, setExportTemplates] = useState<ExportTemplate[]>([]);
  const [isExportTemplatesLoading, setIsExportTemplatesLoading] = useState(true);
  const [isExportProcessing, setIsExportProcessing] = useState(false);
  const [highlightedEditedFile, setHighlightedEditedFile] = useState<string | null>(null);
  const [reloadMode, setReloadMode] = useState<{
    active: boolean;
    sourceFileId: string;
    fileName: string;
  }>({ active: false, sourceFileId: "", fileName: "" });

  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const triggersTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasFetchedOnce = useRef(false);
  const hasFetchedTriggersOnce = useRef(false);
  const exportSnapshotRef = useRef<ExportTemplate[]>([]);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const logExecution = useCallback((label: string) => {
    setExecutions((prev) => [
      { id: uid(), executed_at: now(), label },
      ...prev,
    ]);
  }, []);

  // ── refreshData: poll the production API ────────────────────────────────

  const refreshData = useCallback(async () => {
    const isFirst = !hasFetchedOnce.current;
    if (isFirst) {
      setIsInitialLoading(true);
    } else {
      setIsRefreshing(true);
    }
    try {
      const res = await fetchAllDocuments();
      if (res?.documents) {
        const mapped = res.documents.map(mapDocumentToMilestone);
        setData(mapped);
        setFetchError(null);
      } else {
        setFetchError("Connection to data source lost, retrying...");
      }
      setLastRefreshed(now());
      hasFetchedOnce.current = true;
    } catch {
      setFetchError("Connection to data source lost, retrying...");
    } finally {
      setIsInitialLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // ── Initial fetch + auto-refresh every 30 s ─────────────────────────────

  useEffect(() => {
    refreshData();
    refreshTimerRef.current = setInterval(() => {
      refreshData();
    }, REFRESH_INTERVAL_MS);
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [refreshData]);

  // ── refreshTriggers: poll the triggers API ──────────────────────────────

  const refreshTriggers = useCallback(async () => {
    const isFirst = !hasFetchedTriggersOnce.current;
    if (isFirst) setIsTriggersLoading(true);
    try {
      const res = await fetchTriggers();
      if (res) setTriggers(res);
      hasFetchedTriggersOnce.current = true;
    } catch {
      // silently retry on next interval
    } finally {
      setIsTriggersLoading(false);
    }
  }, []);

  // ── Initial triggers fetch + auto-refresh every 30 s ───────────────────

  useEffect(() => {
    refreshTriggers();
    triggersTimerRef.current = setInterval(() => {
      refreshTriggers();
    }, REFRESH_INTERVAL_MS);
    return () => {
      if (triggersTimerRef.current) clearInterval(triggersTimerRef.current);
    };
  }, [refreshTriggers]);

  // ── refreshExportTemplates: fetch export templates (no polling) ──────

  const refreshExportTemplates = useCallback(async () => {
    setIsExportTemplatesLoading(true);
    try {
      const res = await fetchExportTemplates();
      const items = res ?? [];
      const sorted = [...items].sort((a, b) => {
        const da = a.created_at ? new Date(a.created_at).getTime() : 0;
        const db = b.created_at ? new Date(b.created_at).getTime() : 0;
        return db - da; // newest first
      });
      setExportTemplates(sorted);
    } catch {
      // silently ignore — keep current state on network error
    } finally {
      setIsExportTemplatesLoading(false);
    }
  }, []);

  /**
   * Refresh export templates and highlight the newly created or updated item.
   * Compares the snapshot taken before submit with the fresh list.
   */
  const refreshExportTemplatesAndHighlight = useCallback(async () => {
    const prev = exportSnapshotRef.current;
    const res = await fetchExportTemplates();
    const items = res ?? [];
    const sorted = [...items].sort((a, b) => {
      const da = a.created_at ? new Date(a.created_at).getTime() : 0;
      const db = b.created_at ? new Date(b.created_at).getTime() : 0;
      return db - da;
    });
    setExportTemplates(sorted);
    setIsExportTemplatesLoading(false);

    // Detect the single changed item using edited_file ONLY.
    // Build a map of previous edited_file → created_at for comparison.
    const prevByEditedFile = new Map<string, string | undefined>();
    for (const item of prev) {
      if (item.edited_file) {
        prevByEditedFile.set(item.edited_file, item.created_at);
      }
    }

    let matchedEditedFile: string | null = null;

    for (const item of sorted) {
      if (!item.edited_file) continue;

      if (!prevByEditedFile.has(item.edited_file)) {
        // New item: edited_file didn't exist in previous snapshot
        matchedEditedFile = item.edited_file;
        break;
      }

      // Updated item: same edited_file but created_at changed
      if (prevByEditedFile.get(item.edited_file) !== item.created_at) {
        matchedEditedFile = item.edited_file;
        break;
      }
    }

    if (matchedEditedFile) {
      // Clear any previous highlight timer
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      setHighlightedEditedFile(matchedEditedFile);
      highlightTimerRef.current = setTimeout(() => {
        setHighlightedEditedFile(null);
        highlightTimerRef.current = null;
      }, 2000);
    }
  }, []);

  // ── Initial export templates fetch (once on mount) ──────────────────

  useEffect(() => {
    refreshExportTemplates();
  }, [refreshExportTemplates]);

  // ── Cleanup blob URLs on unmount to prevent memory leaks ──────────────
  useEffect(() => {
    return () => {
      // Revoke all export blob URLs when the hook unmounts
      setExports((prev) => {
        for (const exp of prev) {
          if (exp.blob_url?.startsWith("blob:")) {
            URL.revokeObjectURL(exp.blob_url);
          }
        }
        return prev;
      });
    };
  }, []);

  // ── sendMessage: POST to n8n AI-agent → parse response → display ─────

  const sendMessage = useCallback(
    async (text: string, structuredFile?: File) => {
      // Build the request payload for debug visibility
      const sessionId = getOrCreateSessionId();
      const requestPayload = {
        action: "sendMessage",
        session_id: sessionId,
        sessionId,
        message: text,
        chatInput: text,
        ...(structuredFile ? { attached_file: structuredFile.name } : {}),
      };

      // 1. Append user message with raw request
      const userMsg: ChatMessage = {
        id: uid(),
        role: "user",
        content: structuredFile
          ? `${text}\n📎 ${structuredFile.name}`
          : text,
        rawJson: requestPayload,
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsProcessing(true);

      try {
        // 2. Route to the appropriate webhook based on file attachment or reload mode
        const isReload = reloadMode.active && reloadMode.sourceFileId;
        const isChatWithDoc = isReload || !!structuredFile;

        // Snapshot current export templates and show processing state
        if (isChatWithDoc) {
          exportSnapshotRef.current = [...exportTemplates];
          setIsExportProcessing(true);
        }

        if (isReload) {
          // ── Reload/update path: chat_with_doc without file ──────
          const docResult = await sendChatWithDocReload(text, reloadMode.sourceFileId);

          if (docResult?.kind === "file" && docResult.file) {
            const { fileName, mimeType } = docResult.file;
            const assistantMsg: ChatMessage = {
              id: uid(),
              role: "assistant",
              content: `Export updated: **${fileName}** (${mimeType.split(";")[0]})\nThe file is available in the Export templates panel.`,
            };
            setMessages((prev) => [...prev, assistantMsg]);
            logExecution(`Export updated: ${fileName}`);
            // Success — clear reload mode and refresh templates from server
            setReloadMode({ active: false, sourceFileId: "", fileName: "" });
            await refreshExportTemplatesAndHighlight();
          } else if (docResult?.kind === "json" && docResult.json) {
            const assistantContent = extractAssistantReply(docResult.json);
            const replyText = assistantContent || "I've processed your update request.";
            const assistantMsg: ChatMessage = {
              id: uid(),
              role: "assistant",
              content: replyText,
              rawJson: docResult.json,
              intent: extractIntent(docResult.json),
            };
            setMessages((prev) => [...prev, assistantMsg]);
            logExecution("AI agent responded (reload)");
            if (replyIndicatesDataChange(replyText)) {
              await refreshData();
            }
            // Success — clear reload mode and refresh templates
            setReloadMode({ active: false, sourceFileId: "", fileName: "" });
            await refreshExportTemplatesAndHighlight();
          } else {
            // Failed — keep reload mode active so user can retry
            const fallbackMsg: ChatMessage = {
              id: uid(),
              role: "assistant",
              content: "I received your message but the AI service is currently unavailable. Please try again shortly.",
            };
            setMessages((prev) => [...prev, fallbackMsg]);
          }
        } else if (structuredFile) {
          // ── chat_with_doc path (may return file OR JSON) ──────────
          const docResult = await sendChatWithDoc(text, structuredFile);

          if (docResult?.kind === "file" && docResult.file) {
            // Backend returned a generated file
            const { fileName, mimeType } = docResult.file;
            const assistantMsg: ChatMessage = {
              id: uid(),
              role: "assistant",
              content: `Export generated: **${fileName}** (${mimeType.split(";")[0]})\nThe file is available in the Export templates panel.`,
            };
            setMessages((prev) => [...prev, assistantMsg]);
            logExecution(`Export generated: ${fileName}`);
            // Refresh export templates from server
            await refreshExportTemplatesAndHighlight();
          } else if (docResult?.kind === "json" && docResult.json) {
            // Normal JSON reply from chat_with_doc
            const assistantContent = extractAssistantReply(docResult.json);
            const replyText = assistantContent || "I've processed your request.";

            const assistantMsg: ChatMessage = {
              id: uid(),
              role: "assistant",
              content: replyText,
              rawJson: docResult.json,
              intent: extractIntent(docResult.json),
            };
            setMessages((prev) => [...prev, assistantMsg]);
            logExecution("AI agent responded");

            if (replyIndicatesDataChange(replyText)) {
              await refreshData();
            }
            // Refresh export templates after successful chat_with_doc
            await refreshExportTemplatesAndHighlight();
          } else {
            // Null / error from chat_with_doc
            const fallbackMsg: ChatMessage = {
              id: uid(),
              role: "assistant",
              content:
                "I received your message but the AI service is currently unavailable. Please try again shortly.",
            };
            setMessages((prev) => [...prev, fallbackMsg]);
            logExecution("AI agent unavailable — no response");
          }
        } else {
          // ── Normal chat path (unchanged) ──────────────────────────
          const responseArray = await sendChatMessage(text);

          if (responseArray) {
            const assistantContent = extractAssistantReply(responseArray);
            const replyText = assistantContent || "I've processed your request.";

            const assistantMsg: ChatMessage = {
              id: uid(),
              role: "assistant",
              content: replyText,
              rawJson: responseArray,
              intent: extractIntent(responseArray),
            };
            setMessages((prev) => [...prev, assistantMsg]);
            logExecution("AI agent responded");

            if (replyIndicatesDataChange(replyText)) {
              await refreshData();
            }
          } else {
            const fallbackMsg: ChatMessage = {
              id: uid(),
              role: "assistant",
              content:
                "I received your message but the AI service is currently unavailable. Please try again shortly.",
            };
            setMessages((prev) => [...prev, fallbackMsg]);
            logExecution("AI agent unavailable — no response");
          }
        }
      } catch {
        const errorMsg: ChatMessage = {
          id: uid(),
          role: "assistant",
          content:
            "Sorry, something went wrong while processing your message. Please try again.",
        };
        setMessages((prev) => [...prev, errorMsg]);
        logExecution("Processing failed");
      } finally {
        setIsProcessing(false);
        setIsExportProcessing(false);
      }
    },
    [logExecution, refreshData, refreshExportTemplatesAndHighlight, reloadMode, exportTemplates]
  );

  // ── Export template actions ─────────────────────────────────────────────

  const handleExportDownload = useCallback(
    async (editedFileId: string, filename: string) => {
      await downloadExportFile(editedFileId, filename);
    },
    []
  );

  const handleExportReload = useCallback(
    (prompt: string, sourceFileId: string, fileName: string) => {
      setReloadMode({ active: true, sourceFileId, fileName });
      return prompt;
    },
    []
  );

  const clearReloadMode = useCallback(() => {
    setReloadMode({ active: false, sourceFileId: "", fileName: "" });
  }, []);

  const clearChatAndMemory = useCallback(() => {
    // Clear all chat messages
    setMessages([]);
    // Generate a fresh session id
    const newSessionId = crypto.randomUUID();
    try { localStorage.setItem(SESSION_STORAGE_KEY, newSessionId); } catch { /* ignore */ }
    // Clear reload mode
    setReloadMode({ active: false, sourceFileId: "", fileName: "" });
  }, []);

  const handleExportDelete = useCallback(
    async (sourceFileId: string): Promise<boolean> => {
      try {
        const url = `${DELETE_EXPORT_TEMPLATE_URL}/${encodeURIComponent(sourceFileId)}`;
        const res = await fetch(url, { method: "DELETE" });
        if (!res.ok) {
          throw new Error(`Delete failed (HTTP ${res.status})`);
        }
        await refreshExportTemplates();
        logExecution("Export template deleted");
        return true;
      } catch (err) {
        console.error("[DeleteExport] failed:", err);
        alert(err instanceof Error ? err.message : "Failed to delete export template. Please try again.");
        return false;
      }
    },
    [refreshExportTemplates, logExecution]
  );

  const handleExportRename = useCallback(
    async (sourceFileId: string, newName: string): Promise<boolean> => {
      try {
        const res = await fetch(RENAME_EXPORT_TEMPLATE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source_file: sourceFileId, new_name: newName }),
        });
        if (!res.ok) {
          throw new Error(`Rename failed (HTTP ${res.status})`);
        }
        await refreshExportTemplates();
        logExecution(`Export template renamed to: ${newName}`);
        return true;
      } catch (err) {
        console.error("[RenameExport] failed:", err);
        alert(err instanceof Error ? err.message : "Failed to rename export template. Please try again.");
        return false;
      }
    },
    [refreshExportTemplates, logExecution]
  );

  // ── File upload handler (POST to production endpoint) ────────────────────

  const handleFileUpload = useCallback(
    async (file: File) => {
      // 1. Show user message about the file
      const userMsg: ChatMessage = {
        id: uid(),
        role: "user",
        content: `📎 Uploaded file: ${file.name}`,
      };
      setMessages((prev) => [...prev, userMsg]);

      // 2. Show "Uploading…" status message
      const uploadingMsgId = uid();
      const uploadingMsg: ChatMessage = {
        id: uploadingMsgId,
        role: "assistant",
        content: `⏳ Uploading ${file.name}…`,
      };
      setMessages((prev) => [...prev, uploadingMsg]);
      setIsUploading(true);
      setUploadingFileName(file.name);

      try {
        // 3. Build multipart/form-data payload
        const formData = new FormData();
        formData.append("data", file);

        // 4. POST to production upload endpoint
        const res = await fetch(FILE_UPLOAD_URL, {
          method: "POST",
          body: formData,
        });

        // 5. Remove the "Uploading…" placeholder
        setMessages((prev) => prev.filter((m) => m.id !== uploadingMsgId));

        if (res.ok) {
          // Success — confirm in chat
          setMessages((prev) => [
            ...prev,
            {
              id: uid(),
              role: "assistant",
              content: `✅ File "${file.name}" uploaded successfully.`,
            },
          ]);
          logExecution(`File uploaded: ${file.name}`);

          // 6. Trigger immediate table refresh so the new document appears
          await refreshData();
        } else {
          // Server returned an error status
          setMessages((prev) => [
            ...prev,
            {
              id: uid(),
              role: "assistant",
              content: `❌ Upload failed for "${file.name}" (server returned ${res.status}). Please try again.`,
            },
          ]);
          logExecution(`Upload failed: ${file.name} — HTTP ${res.status}`);
        }
      } catch {
        // Network / other error
        setMessages((prev) => prev.filter((m) => m.id !== uploadingMsgId));
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: "assistant",
            content: `❌ Could not upload "${file.name}". Please check your connection and try again.`,
          },
        ]);
        logExecution(`Upload error: ${file.name}`);
      } finally {
        setIsUploading(false);
        setUploadingFileName("");
      }
    },
    [logExecution, refreshData]
  );

  // ── deleteMilestone ──────────────────────────────────────────────────────

  const deleteMilestone = useCallback(
    async (docId: string): Promise<DeleteFileResult> => {
      const result = await deleteFileApi(docId);
      if (result.success) {
        // Remove from local state immediately
        setData((prev) => prev.filter((m) => (m.document_id || m.id) !== docId));
        logExecution(`File deleted: ${docId}`);
        // Also re-fetch server truth
        await refreshData();
      }
      return result;
    },
    [logExecution, refreshData]
  );

  // ── Trigger actions ─────────────────────────────────────────────────────

  const updateTrigger = useCallback(
    async (
      id: string,
      fields: Partial<Pick<Trigger, "frequency" | "recipient_email" | "scheduled_end" | "label" | "status" | "prompt" | "time" | "day_of_week" | "day_of_month">>
    ): Promise<boolean> => {
      const ok = await patchTrigger(id, fields);
      if (ok) {
        // Optimistic: patch local state immediately
        setTriggers((prev) =>
          prev.map((t) => (t.id === id ? { ...t, ...fields } : t))
        );
        logExecution(`Trigger updated: ${fields.label || id}`);
        // Also re-fetch to get server-truth
        await refreshTriggers();
      }
      return ok;
    },
    [logExecution, refreshTriggers]
  );

  const deleteTrigger = useCallback(
    async (id: string): Promise<boolean> => {
      const ok = await deleteTriggerApi(id);
      if (ok) {
        setTriggers((prev) => prev.filter((t) => t.id !== id));
        logExecution("Trigger deleted");
        await refreshTriggers();
      }
      return ok;
    },
    [logExecution, refreshTriggers]
  );

  // ── CSV export ───────────────────────────────────────────────────────────

  const createCsvExport = useCallback(async () => {
    setIsExporting(true);
    try {
      await simulateApi(null, 500);

      const content = generateCsvExport(data);
      const blob = new Blob([content], { type: "text/csv" });
      const blobUrl = URL.createObjectURL(blob);
      const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

      const exportFile: ExportFile = {
        id: uid(),
        filename: `milestones-${ts}.csv`,
        created_at: now(),
        record_count: data.length,
        blob_url: blobUrl,
      };

      setExports((prev) => [exportFile, ...prev]);
      logExecution(`CSV export created — ${data.length} records`);
    } catch {
      logExecution("Export failed");
    } finally {
      setIsExporting(false);
    }
  }, [data, logExecution]);

  return {
    messages,
    data,
    executions,
    exports,
    isProcessing,
    isExporting,
    isUploading,
    uploadingFileName,
    isRefreshing,
    isInitialLoading,
    fetchError,
    lastRefreshed,
    triggers,
    isTriggersLoading,
    exportTemplates,
    isExportTemplatesLoading,
    isExportProcessing,
    highlightedEditedFile,
    reloadMode,
    detailMilestone,
    previewMilestone,
    setDetailMilestone,
    setPreviewMilestone,
    sendMessage,
    handleFileUpload,
    createCsvExport,
    refreshData,
    deleteMilestone,
    updateTrigger,
    deleteTrigger,
    handleExportDownload,
    handleExportReload,
    handleExportDelete,
    handleExportRename,
    clearReloadMode,
    clearChatAndMemory,
  };
}
