import { useState, useCallback, useEffect, useRef } from "react";
import type { ChatMessage } from "../components/ChatInterface";

// ── Types ──────────────────────────────────────────────────────────────────────

export type MilestoneStatus = "done" | "overdue" | "pending";

export interface ContractingParty {
  name: string;
  role: string;
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

// ── API response types ─────────────────────────────────────────────────────────

interface ApiDocument {
  document_id: string;
  file_name: string;
  description: string;
  upload_time: string;
  status: string;
  contracting_parties?: { name: string; role: string }[];
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

function mapDocumentToMilestone(doc: ApiDocument): Milestone {
  const uploadDate = new Date(doc.upload_time);
  const deadlineDate = isNaN(uploadDate.getTime())
    ? new Date().toISOString().slice(0, 10)
    : uploadDate.toISOString().slice(0, 10);

  const parties = doc.contracting_parties ?? [];

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
  "https://vltechpath.app.n8n.cloud/webhook/chat";

/** Production API endpoint for fetching all documents */
const DATA_REFRESH_URL =
  "https://20.110.72.120.nip.io/webhook/getAllDocuments";

/** Production API endpoint for uploading files */
const FILE_UPLOAD_URL =
  "https://20.110.72.120.nip.io/webhook/uploadFile";

/** Production API endpoint for fetching triggers */
const TRIGGERS_URL =
  "https://vltechpath.app.n8n.cloud/webhook/triggers";

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
  let sessionId = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  }
  return sessionId;
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
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [detailMilestone, setDetailMilestone] = useState<Milestone | null>(null);
  const [previewMilestone, setPreviewMilestone] = useState<Milestone | null>(null);
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [isTriggersLoading, setIsTriggersLoading] = useState(true);

  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const triggersTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasFetchedOnce = useRef(false);
  const hasFetchedTriggersOnce = useRef(false);

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

  // ── sendMessage: POST to n8n AI-agent → parse response → display ─────

  const sendMessage = useCallback(
    async (text: string) => {
      // 1. Append user message
      const userMsg: ChatMessage = { id: uid(), role: "user", content: text };
      setMessages((prev) => [...prev, userMsg]);
      setIsProcessing(true);

      try {
        // 2. POST { session_id, message } to the n8n chat webhook
        const responseArray = await sendChatMessage(text);

        if (responseArray) {
          // 3. Extract the last assistant reply from the response
          const assistantContent = extractAssistantReply(responseArray);

          const replyText =
            assistantContent || "I've processed your request.";

          const assistantMsg: ChatMessage = {
            id: uid(),
            role: "assistant",
            content: replyText,
          };
          setMessages((prev) => [...prev, assistantMsg]);
          logExecution("AI agent responded");

          // 4. If the reply indicates a data change, refresh the table
          if (replyIndicatesDataChange(replyText)) {
            await refreshData();
          }
        } else {
          // Webhook failed or unavailable
          const fallbackMsg: ChatMessage = {
            id: uid(),
            role: "assistant",
            content:
              "I received your message but the AI service is currently unavailable. Please try again shortly.",
          };
          setMessages((prev) => [...prev, fallbackMsg]);
          logExecution("AI agent unavailable — no response");
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
      }
    },
    [logExecution, refreshData]
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
      }
    },
    [logExecution, refreshData]
  );

  // ── deleteMilestone ──────────────────────────────────────────────────────

  const deleteMilestone = useCallback(
    (id: string) => {
      setData((prev) => prev.filter((m) => m.id !== id));
      logExecution("Record deleted");
    },
    [logExecution]
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
    isRefreshing,
    isInitialLoading,
    fetchError,
    lastRefreshed,
    triggers,
    isTriggersLoading,
    detailMilestone,
    previewMilestone,
    setDetailMilestone,
    setPreviewMilestone,
    sendMessage,
    handleFileUpload,
    createCsvExport,
    refreshData,
    deleteMilestone,
  };
}
