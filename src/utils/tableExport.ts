import * as XLSX from "xlsx";

/**
 * Generate a timestamp string for filenames: YYYY-MM-DD-HH-mm
 */
function fileTimestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}-${pad(d.getMinutes())}`;
}

/**
 * Trigger a browser download for a Blob.
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Escape a single CSV cell value.
 * Wraps in quotes if it contains commas, quotes, or newlines.
 */
function escapeCsvCell(value: unknown): string {
  if (value == null) return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Export table data as a CSV file download.
 */
export function exportTableCsv(columns: string[], rows: unknown[][]): void {
  const header = columns.map(escapeCsvCell).join(",");
  const body = rows
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\r\n");
  const csv = header + "\r\n" + body;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, `chat-export-${fileTimestamp()}.csv`);
}

/**
 * Export table data as an XLSX file download.
 */
export function exportTableXlsx(columns: string[], rows: unknown[][]): void {
  const wsData = [columns, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Export");
  const wbOut = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbOut], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  downloadBlob(blob, `chat-export-${fileTimestamp()}.xlsx`);
}
