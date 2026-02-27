import { useState, useCallback } from "react";

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
];

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

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useAgent() {
  const [prompt, setPrompt] = useState("");
  const [data, setData] = useState<Milestone[]>(INITIAL_MILESTONES);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [exports, setExports] = useState<ExportFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const logExecution = useCallback((label: string) => {
    setExecutions((prev) => [
      { id: uid(), executed_at: now(), label },
      ...prev,
    ]);
  }, []);

  // ── processInput: unified text / HTML / CSV parser ───────────────────────

  const processInput = useCallback(
    async (text: string) => {
      setIsProcessing(true);
      try {
        await simulateApi(null, 600);

        let parsed: Milestone[] = [];

        if (/<table[\s>]/i.test(text)) {
          parsed = parseHtmlTable(text);
          logExecution(`HTML table parsed — ${parsed.length} rows extracted`);
        } else if (
          text.includes(",") &&
          text.split("\n").filter((l) => l.trim()).length >= 2
        ) {
          parsed = parseCsvText(text);
          logExecution(`CSV text parsed — ${parsed.length} rows extracted`);
        }

        if (parsed.length > 0) {
          setData((prev) => [...prev, ...parsed]);
        } else {
          const extra: Milestone = {
            id: uid(),
            deadline_date: "2025-04-15",
            milestone_name: "Elevator certification – Tower B",
            document_ref: "Exhibit E, Section 3",
            context: "Bridger Solutions - Construction Loan",
            status: deriveStatus("2025-04-15"),
          };
          setData((prev) => [...prev, extra]);
          logExecution(`Prompt analyzed — 1 milestone added`);
        }
      } catch {
        logExecution("Processing failed");
      } finally {
        setIsProcessing(false);
      }
    },
    [logExecution]
  );

  // ── File upload handler ──────────────────────────────────────────────────

  const handleFileUpload = useCallback(
    async (file: File) => {
      setIsProcessing(true);
      try {
        const ext = file.name.split(".").pop()?.toLowerCase();

        if (ext === "csv") {
          const text = await file.text();
          const parsed = parseCsvText(text);
          await simulateApi(null, 600);
          if (parsed.length > 0) {
            setData((prev) => [...prev, ...parsed]);
          }
          logExecution(`File processed: ${file.name} — ${parsed.length} rows`);
        } else if (ext === "html" || ext === "htm") {
          const text = await file.text();
          const parsed = parseHtmlTable(text);
          await simulateApi(null, 600);
          if (parsed.length > 0) {
            setData((prev) => [...prev, ...parsed]);
          }
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
          setData((prev) => [...prev, simulated]);
          logExecution(`File analyzed: ${file.name} — 1 milestone`);
        }
      } catch {
        logExecution(`File failed: ${file.name}`);
      } finally {
        setIsProcessing(false);
      }
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
    prompt,
    setPrompt,
    data,
    executions,
    exports,
    isProcessing,
    isExporting,
    processInput,
    handleFileUpload,
    createCsvExport,
  };
}
