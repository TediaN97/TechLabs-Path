import { useState, useCallback, useEffect, useRef } from "react";
import type { ChatMessage } from "../components/ChatInterface";

// ── Types ──────────────────────────────────────────────────────────────────────

export type MilestoneStatus = "done" | "overdue" | "pending";

export interface Milestone {
  id: string;
  deadline_date: string;
  milestone_name: string;
  document_ref: string;
  context: string;
  status: MilestoneStatus;
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

// ── Mock Data ──────────────────────────────────────────────────────────────────

const INITIAL_MILESTONES: Milestone[] = [
  {
    id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    deadline_date: "2019-09-30",
    milestone_name: "Construction Commencement",
    document_ref: "Loan Agreement, Section 2.1",
    context: "Bridger Solutions - Construction Loan",
    status: "done",
  },
  {
    id: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    deadline_date: "2020-07-01",
    milestone_name: "Substantial Completion of Project",
    document_ref: "Loan Agreement, Section 5.3",
    context: "Bridger Solutions - Construction Loan",
    status: "overdue",
  },
  {
    id: "c3d4e5f6-a7b8-9012-cdef-123456789012",
    deadline_date: "2020-12-31",
    milestone_name: "Maintain Debt Service Coverage Ratio (1.25 to 1.00)",
    document_ref: "Loan Agreement, Section 7.2",
    context: "Bridger Solutions - Construction Loan",
    status: "overdue",
  },
  {
    id: "d4e5f6a7-b8c9-0123-defa-234567890123",
    deadline_date: "2026-04-30",
    milestone_name: "Deliver Audited Financial Statements (120 days post-year end)",
    document_ref: "Loan Agreement, Section 6.1",
    context: "Bridger Solutions - Construction Loan",
    status: "pending",
  },
  {
    id: "e5f6a7b8-c9d0-1234-efab-345678901234",
    deadline_date: "2025-06-15",
    milestone_name: "Hangar structural inspection",
    document_ref: "Exhibit A, Section 3.4",
    context: "Hangar Remodel Project",
    status: "pending",
  },
  {
    id: "f6a7b8c9-d0e1-2345-fabc-456789012345",
    deadline_date: "2025-09-01",
    milestone_name: "Fire suppression system installation",
    document_ref: "Exhibit B, Section 8.1",
    context: "Hangar Remodel Project",
    status: "pending",
  },
  {
    id: "f6a7b8c9-d0e1-2345-fabc-456789012344",
    deadline_date: "2025-09-01",
    milestone_name: "Fire suppression system installation",
    document_ref: "Exhibit B, Section 8.1",
    context: "Hangar Remodel Project",
    status: "pending",
  },
  {
    id: "f6a7b8c9-d0e1-2345-fabc-456789012342",
    deadline_date: "2025-09-01",
    milestone_name: "Fire suppression system installation",
    document_ref: "Exhibit B, Section 8.1",
    context: "Hangar Remodel Project",
    status: "pending",
  },
  {
    id: "f6a7b8c9-d0e1-2345-fabc-456789012348",
    deadline_date: "2025-09-01",
    milestone_name: "Fire suppression system installation",
    document_ref: "Exhibit B, Section 8.1",
    context: "Hangar Remodel Project",
    status: "pending",
  },
  {
    id: "f6a7b8c9-d0e1-2345-fabc-456789012349",
    deadline_date: "2025-09-01",
    milestone_name: "Fire suppression system installation",
    document_ref: "Exhibit B, Section 8.1",
    context: "Hangar Remodel Project",
    status: "pending",
  },
  {
    id: "f6a7b8c9-d0e1-2345-fabc-456789012347",
    deadline_date: "2025-09-01",
    milestone_name: "Fire suppression system installation",
    document_ref: "Exhibit B, Section 8.1",
    context: "Hangar Remodel Project",
    status: "pending",
  },
  {
    id: "f6a7b8c9-d0e1-2345-fabc-456789012346",
    deadline_date: "2025-09-01",
    milestone_name: "Fire suppression system installation",
    document_ref: "Exhibit B, Section 8.1",
    context: "Hangar Remodel Project",
    status: "pending",
  },
];

// ── Config ────────────────────────────────────────────────────────────────────

/** Replace with your actual n8n webhook URL */
const N8N_WEBHOOK_URL =
  "https://your-n8n-instance.com/webhook/prompt-dashboard";

/** Replace with your actual data-refresh endpoint (n8n / Supabase) */
const DATA_REFRESH_URL =
  "https://your-n8n-instance.com/webhook/data-refresh";

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

// ── Webhook ───────────────────────────────────────────────────────────────────

interface ChatWebhookPayload {
  message: string;
  chat_history: { role: string; content: string }[];
  context: string;
  timestamp: string;
  file_metadata?: { name: string; size: number; type: string } | null;
  files?: { name: string; size: number; type: string; content: string }[] | null;
}

interface WebhookResponse {
  reply?: string;
  milestones?: {
    deadline_date?: string;
    milestone_name?: string;
    document_ref?: string;
    context?: string;
    status?: string;
  }[];
  [key: string]: unknown;
}

/**
 * POST to the n8n webhook. Returns the parsed response on success,
 * or `null` on any network / parse failure so callers can fall back
 * to local processing.
 */
async function sendChatWebhook(
  payload: ChatWebhookPayload
): Promise<WebhookResponse | null> {
  try {
    const res = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    return (await res.json()) as WebhookResponse;
  } catch {
    // Network error — caller will fall back to local logic
    return null;
  }
}

/**
 * GET/POST to the data-refresh endpoint to fetch the latest milestones.
 * Returns milestones array on success, or `null` on failure.
 */
async function fetchLatestData(): Promise<WebhookResponse | null> {
  try {
    const res = await fetch(DATA_REFRESH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "refresh",
        context: "Bridger Solutions Loan Agreement",
        timestamp: new Date().toISOString(),
      }),
    });
    if (!res.ok) return null;
    return (await res.json()) as WebhookResponse;
  } catch {
    return null;
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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
    });
  }
  return milestones;
}

// ── CSV export generator ───────────────────────────────────────────────────────

export function generateCsvExport(data: Milestone[]): string {
  const header = "Deadline,Task,Document Reference,Agreement / Project Context,Status";
  const rows = data.map(
    (m) =>
      `${m.deadline_date},"${m.milestone_name}","${m.document_ref}","${m.context}",${m.status}`
  );
  return [header, ...rows].join("\n");
}

// ── Context detection helper ───────────────────────────────────────────────────

function detectDocumentContext(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("contract") || lower.includes("bridger solutions") || lower.includes("loan agreement")) {
    return "Bridger Solutions Loan Agreement";
  }
  return "Bridger Solutions Loan Agreement";
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useAgent() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [data, setData] = useState<Milestone[]>(INITIAL_MILESTONES);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [exports, setExports] = useState<ExportFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string>(now());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [detailMilestone, setDetailMilestone] = useState<Milestone | null>(null);
  const [previewMilestone, setPreviewMilestone] = useState<Milestone | null>(null);

  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const logExecution = useCallback((label: string) => {
    setExecutions((prev) => [
      { id: uid(), executed_at: now(), label },
      ...prev,
    ]);
  }, []);

  // ── refreshData: poll the data endpoint ─────────────────────────────────

  const refreshData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetchLatestData();
      if (res?.milestones && res.milestones.length > 0) {
        const remote: Milestone[] = res.milestones.map((m) => ({
          id: uid(),
          deadline_date: m.deadline_date || new Date().toISOString().slice(0, 10),
          milestone_name: m.milestone_name || "Untitled",
          document_ref: m.document_ref || "—",
          context: m.context || "Bridger Solutions - Construction Loan",
          status: (m.status as MilestoneStatus) || deriveStatus(m.deadline_date || ""),
        }));
        setData(remote);
      }
      setLastRefreshed(now());
    } catch {
      // silent — next cycle will retry
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // ── Auto-refresh every 30 s ──────────────────────────────────────────────

  useEffect(() => {
    refreshTimerRef.current = setInterval(() => {
      refreshData();
    }, REFRESH_INTERVAL_MS);
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [refreshData]);

  // ── sendMessage: add to chat → webhook → append response ────────────────

  const sendMessage = useCallback(
    async (text: string) => {
      // 1. Append user message
      const userMsg: ChatMessage = { id: uid(), role: "user", content: text };
      setMessages((prev) => [...prev, userMsg]);
      setIsProcessing(true);

      try {
        // Build chat history for the webhook (all messages + the new one)
        const chatHistoryForWebhook = [
          ...messages.map((m) => ({ role: m.role, content: m.content })),
          { role: "user", content: text },
        ];

        const context = detectDocumentContext(text);

        // 2. Send to n8n webhook with full chat history
        const webhookRes = await sendChatWebhook({
          message: text,
          chat_history: chatHistoryForWebhook,
          context,
          timestamp: now(),
        });

        // 3. If webhook returned a response
        if (webhookRes) {
          // Append assistant reply
          const replyText =
            webhookRes.reply ||
            (webhookRes.milestones && webhookRes.milestones.length > 0
              ? `I found ${webhookRes.milestones.length} milestone${webhookRes.milestones.length !== 1 ? "s" : ""} from the analysis. The data table has been updated.`
              : "I've processed your request.");

          const assistantMsg: ChatMessage = {
            id: uid(),
            role: "assistant",
            content: replyText,
          };
          setMessages((prev) => [...prev, assistantMsg]);

          // Sync milestones to data table if present
          if (webhookRes.milestones && webhookRes.milestones.length > 0) {
            const remote: Milestone[] = webhookRes.milestones.map((m) => ({
              id: uid(),
              deadline_date: m.deadline_date || new Date().toISOString().slice(0, 10),
              milestone_name: m.milestone_name || "Untitled",
              document_ref: m.document_ref || "—",
              context: m.context || "Bridger Solutions - Construction Loan",
              status: (m.status as MilestoneStatus) || deriveStatus(m.deadline_date || ""),
            }));
            setData((prev) => [...prev, ...remote]);
            logExecution(
              `Webhook executed — ${remote.length} milestone${remote.length !== 1 ? "s" : ""} received`
            );
          } else {
            logExecution("Webhook executed — response received");
          }
          return;
        }

        // 4. Webhook failed or unavailable — local fallback
        let parsed: Milestone[] = [];
        let fallbackReply = "";

        if (/<table[\s>]/i.test(text)) {
          parsed = parseHtmlTable(text);
          fallbackReply = `I parsed an HTML table and extracted ${parsed.length} milestone${parsed.length !== 1 ? "s" : ""}. The data table has been updated.`;
          logExecution(`HTML table parsed — ${parsed.length} rows extracted`);
        } else if (
          text.includes(",") &&
          text.split("\n").filter((l) => l.trim()).length >= 2
        ) {
          parsed = parseCsvText(text);
          fallbackReply = `I parsed CSV data and extracted ${parsed.length} milestone${parsed.length !== 1 ? "s" : ""}. The data table has been updated.`;
          logExecution(`CSV text parsed — ${parsed.length} rows extracted`);
        }

        if (parsed.length > 0) {
          setData((prev) => [...prev, ...parsed]);
        } else {
          // Simulate a helpful assistant reply when webhook is unavailable
          fallbackReply =
            "I received your message but the AI service is currently unavailable. Please check your webhook configuration and try again.";
          logExecution("Webhook unavailable — fallback response");
        }

        const assistantMsg: ChatMessage = {
          id: uid(),
          role: "assistant",
          content: fallbackReply,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch {
        const errorMsg: ChatMessage = {
          id: uid(),
          role: "assistant",
          content: "Sorry, something went wrong while processing your message. Please try again.",
        };
        setMessages((prev) => [...prev, errorMsg]);
        logExecution("Processing failed");
      } finally {
        setIsProcessing(false);
      }
    },
    [messages, logExecution]
  );

  // ── File upload handler ──────────────────────────────────────────────────

  const handleFileUpload = useCallback(
    async (file: File) => {
      // Add a user message about the file upload
      const userMsg: ChatMessage = {
        id: uid(),
        role: "user",
        content: `📎 Uploaded file: ${file.name}`,
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsProcessing(true);

      try {
        const ext = file.name.split(".").pop()?.toLowerCase();
        const fileText = await file.text();
        const base64 = await fileToBase64(file);

        const chatHistoryForWebhook = [
          ...messages.map((m) => ({ role: m.role, content: m.content })),
          { role: "user", content: `Uploaded file: ${file.name}` },
        ];

        // Fire webhook with file data and chat history
        const webhookRes = await sendChatWebhook({
          message: `Analyze the uploaded file: ${file.name}`,
          chat_history: chatHistoryForWebhook,
          context: "Bridger Solutions Loan Agreement",
          timestamp: now(),
          file_metadata: { name: file.name, size: file.size, type: file.type || "application/octet-stream" },
          files: [
            {
              name: file.name,
              size: file.size,
              type: file.type || "application/octet-stream",
              content: base64,
            },
          ],
        });

        if (webhookRes) {
          const replyText =
            webhookRes.reply ||
            (webhookRes.milestones && webhookRes.milestones.length > 0
              ? `I analyzed ${file.name} and found ${webhookRes.milestones.length} milestone${webhookRes.milestones.length !== 1 ? "s" : ""}. The data table has been updated.`
              : `I've processed ${file.name}.`);

          setMessages((prev) => [
            ...prev,
            { id: uid(), role: "assistant", content: replyText },
          ]);

          if (webhookRes.milestones && webhookRes.milestones.length > 0) {
            const remote: Milestone[] = webhookRes.milestones.map((m) => ({
              id: uid(),
              deadline_date: m.deadline_date || new Date().toISOString().slice(0, 10),
              milestone_name: m.milestone_name || "Untitled",
              document_ref: m.document_ref || "—",
              context: m.context || "Bridger Solutions - Construction Loan",
              status: (m.status as MilestoneStatus) || deriveStatus(m.deadline_date || ""),
            }));
            setData((prev) => [...prev, ...remote]);
          }
          logExecution(`Webhook notified — file ${file.name} sent`);
          return;
        }

        // Local fallback parsing
        let parsed: Milestone[] = [];
        let fallbackReply = "";

        if (ext === "csv") {
          parsed = parseCsvText(fileText);
          await simulateApi(null, 600);
          fallbackReply = `I parsed ${file.name} and extracted ${parsed.length} milestone${parsed.length !== 1 ? "s" : ""} from the CSV data. The data table has been updated.`;
          logExecution(`File processed: ${file.name} — ${parsed.length} rows`);
        } else if (ext === "html" || ext === "htm") {
          parsed = parseHtmlTable(fileText);
          await simulateApi(null, 600);
          fallbackReply = `I parsed ${file.name} and extracted ${parsed.length} milestone${parsed.length !== 1 ? "s" : ""} from the HTML table. The data table has been updated.`;
          logExecution(`HTML file processed: ${file.name} — ${parsed.length} rows`);
        } else {
          await simulateApi(null, 1200);
          const futureDate = new Date(Date.now() + 30 * 86400000)
            .toISOString()
            .slice(0, 10);
          const simulated: Milestone = {
            id: uid(),
            deadline_date: futureDate,
            milestone_name: `Extracted from ${file.name}`,
            document_ref: file.name,
            context: "Imported",
            status: deriveStatus(futureDate),
          };
          parsed = [simulated];
          fallbackReply = `I analyzed ${file.name} and extracted 1 milestone. The data table has been updated.`;
          logExecution(`File analyzed: ${file.name} — 1 milestone`);
        }

        if (parsed.length > 0) {
          setData((prev) => [...prev, ...parsed]);
        }

        setMessages((prev) => [
          ...prev,
          { id: uid(), role: "assistant", content: fallbackReply },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          { id: uid(), role: "assistant", content: `Sorry, I couldn't process ${file.name}. Please try again.` },
        ]);
        logExecution(`File failed: ${file.name}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [messages, logExecution]
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
    isRefreshing,
    lastRefreshed,
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
