import { Fragment, useState, useRef, useMemo, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import type { Milestone, DeadlineEntry, DeleteFileResult } from "../hooks/useAgent";
import type { CalendarActionType } from "./DeadlineCalendar";

type SortKey = "file_name" | "upload_time" | "lender" | "borrower";
type SortDirection = "asc" | "desc";
interface SortConfig {
  key: SortKey;
  direction: SortDirection;
}

interface StructureData {
  min_structure: {
    legal?: { venue_state?: string | null; governing_law_state?: string | null };
    parties?: {
      lender?: { legal_name?: string | null; lender_id?: string | null };
      borrower?: { legal_name?: string | null; borrower_id?: string | null; entity_type?: string | null };
    };
    covenants?: {
      financial?: { minimum_dscr?: number | null; interest_reserve_required?: boolean | null };
      reporting?: { reporting_frequency?: string | null; financial_statements_required?: boolean | null };
    };
    collateral?: {
      secured?: boolean | null;
      property?: {
        city?: string | null; state?: string | null; address?: string | null;
        postal_code?: string | null; property_id?: string | null; property_type?: string | null;
      };
      security_instruments?: {
        ucc_fixtures_filed?: boolean | null; assignment_of_rents?: boolean | null;
        mortgage_or_deed_of_trust?: boolean | null;
      };
    };
    guaranties?: {
      guarantor_count?: number | null; payment_guaranty_required?: boolean | null;
      completion_guaranty_required?: boolean | null;
    };
    loan_terms?: {
      interest?: {
        rate_type?: string | null; index_name?: string | null;
        spread_bps?: number | null; floor_rate_percent?: number | null; default_rate_margin_bps?: number | null;
      };
      loan_type?: string | null; closing_date?: string | null; maturity_date?: string | null;
      commitment_amount?: { amount?: number | null; currency?: string | null };
      extension_options?: { available?: boolean | null; max_extension_period_months?: number | null };
    };
    disbursement?: {
      advance_method?: string | null; draw_frequency?: string | null;
      inspection_required?: boolean | null; title_update_required?: boolean | null;
      initial_conditions_precedent?: { required?: boolean | null };
    };
    construction_terms?: {
      project_type?: string | null;
      approved_budget?: { amount?: number | null; currency?: string | null };
      retainage_percent?: number | null; loan_to_cost_ratio_percent?: number | null;
      loan_to_value_ratio_percent?: number | null; completion_guaranty_required?: boolean | null;
    };
    defaults_and_remedies?: {
      cross_default?: boolean | null; events_of_default_defined?: boolean | null;
      remedies_include_foreclosure?: boolean | null;
    };
    schema_name?: string | null;
    agreement_type_code?: string | null;
  } | null;
  max_structure: {
    feature_name: string;
    category: string;
    description: string;
    impact_level: string;
    supporting_text: string;
  }[] | null;
}

type ImportantInfoData = Record<string, unknown>;

interface AiDeadlinesData {
  effective_date: string | null;
  maturity_date: string | null;
  construction_completion_deadline: string | null;
}

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

function ClockIcon() {
  return (
    <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function ChevronUpIcon() {
  return (
    <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <polyline points="6 15 12 9 18 15" />
    </svg>
  );
}

function SortIcon() {
  return (
    <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <polyline points="6 9 12 4 18 9" />
      <polyline points="6 15 12 20 18 15" />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg className="h-4 w-4 text-[#6556d2]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
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

// ── Deadlines Dropdown (Portal-based to escape overflow clipping) ────────────

function DeadlinesDropdown({
  onAiDeadlines,
  onVectorDeadlines,
}: {
  onAiDeadlines: () => void;
  onVectorDeadlines: () => void;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; direction: "down" | "up" }>({ top: 0, left: 0, direction: "down" });

  // Compute menu position relative to viewport whenever it opens
  useEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const menuHeight = 80; // approx height of 2 items + padding
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < menuHeight + 8;

    setPos({
      top: openUp ? rect.top - menuHeight - 4 : rect.bottom + 4,
      left: Math.max(8, rect.right - 160), // 160 = w-40
      direction: openUp ? "up" : "down",
    });
  }, [open]);

  // Close on outside click (check both button and portal menu)
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        btnRef.current && !btnRef.current.contains(target) &&
        menuRef.current && !menuRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on scroll so the menu doesn't float away
  useEffect(() => {
    if (!open) return;
    const handleScroll = () => setOpen(false);
    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-white bg-[#6556d2] rounded-md hover:bg-[#5445b5] transition-colors cursor-pointer"
      >
        <ClockIcon />
        Deadlines
        <ChevronDownIcon />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed w-40 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-[9999] animate-[fadeIn_100ms_ease-out]"
            style={{ top: pos.top, left: pos.left }}
          >
            <button
              onClick={() => { onAiDeadlines(); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-[#6556d2]/10 hover:text-[#6556d2] transition-colors cursor-pointer"
            >
              AI analyzed
            </button>
            <button
              onClick={() => { onVectorDeadlines(); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-[#6556d2]/10 hover:text-[#6556d2] transition-colors cursor-pointer"
            >
              Vectorized
            </button>
          </div>,
          document.body
        )}
    </>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────
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

function formatDateDDMMYYYY(raw: string | null): string | null {
  if (!raw) return null;
  const d = new Date(raw.includes("T") ? raw : raw + "T00:00:00");
  if (isNaN(d.getTime())) return raw; // return as-is if unparseable
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function formatCurrency(amount: number | null | undefined, currency?: string | null): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD", maximumFractionDigits: 0 }).format(amount);
}

function boolLabel(v: boolean | null | undefined): string {
  if (v == null) return "—";
  return v ? "Yes" : "No";
}

function capitalize(s: string | null | undefined): string {
  if (!s) return "—";
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getImpactBadge(level: string): string {
  const l = level.toLowerCase();
  if (l === "critical") return "bg-red-100 text-red-700 border border-red-200";
  if (l === "high") return "bg-[#6556d2]/10 text-[#6556d2] border border-[#6556d2]/20";
  if (l === "medium") return "bg-amber-100 text-amber-700 border border-amber-200";
  return "bg-blue-100 text-blue-700 border border-blue-200";
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-3"><div className="h-4 w-32 bg-gray-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-24 bg-gray-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-24 bg-gray-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-24 bg-gray-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-24 bg-gray-200 rounded ml-auto" /></td>
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

// ── Detail Modal (Structure Analysis) ─────────────────────────────────────────

type DetailTab = "overview" | "features" | "technical";

function FieldValue({ value }: { value: string | number | null | undefined }) {
  const display = value == null || value === "" ? null : String(value);
  return display ? (
    <p className="mt-1 text-sm text-gray-700 leading-relaxed">{display}</p>
  ) : (
    <p className="mt-1 text-sm text-gray-400">—</p>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-white">
      <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50/60">
        <h4 className="text-xs font-semibold text-[#6556d2] uppercase tracking-wider">{title}</h4>
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

function FeatureCard({ feature, defaultOpen }: {
  feature: { feature_name: string; category: string; description: string; impact_level: string; supporting_text: string };
  defaultOpen?: boolean;
}) {
  const [showSource, setShowSource] = useState(defaultOpen ?? false);
  return (
    <div className="rounded-lg border border-gray-100 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-800 leading-snug">{feature.feature_name}</p>
          <span className="text-[10px] text-gray-400 uppercase tracking-wider">{feature.category}</span>
        </div>
        <span className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded-full whitespace-nowrap ${getImpactBadge(feature.impact_level)}`}>
          {feature.impact_level}
        </span>
      </div>
      <p className="mt-2 text-xs text-gray-600 leading-relaxed">{feature.description}</p>
      {feature.supporting_text && (
        <div className="mt-2">
          <button
            onClick={() => setShowSource((v) => !v)}
            className="text-[11px] font-medium text-[#6556d2] hover:text-[#5445b5] cursor-pointer"
          >
            {showSource ? "Hide Source Text ▲" : "Show Source Text ▼"}
          </button>
          {showSource && (
            <div className="mt-1.5 rounded-md bg-[#6556d2]/5 border border-[#6556d2]/10 px-3 py-2">
              <p className="text-[11px] text-gray-600 leading-relaxed italic">{feature.supporting_text}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StructureDetailModal({
  milestone,
  data,
  isLoading,
  error,
  onClose,
}: {
  milestone: Milestone;
  data: StructureData | null;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const min = data?.min_structure;
  const features = data?.max_structure ?? [];

  const tabs: { id: DetailTab; label: string; count?: number }[] = [
    { id: "overview", label: "Basic Terms" },
    { id: "features", label: "Key Features", count: features.length },
    { id: "technical", label: "Covenants & Risk" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-[#6556d2] flex items-center justify-between flex-shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white truncate">{milestone.file_name}</h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold text-white/90 bg-white/20 rounded-full whitespace-nowrap flex-shrink-0">
                <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                Verified Analysis
              </span>
            </div>
            <p className="text-[11px] text-white/60 mt-0.5 font-mono truncate">{milestone.document_id || milestone.id}</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white cursor-pointer text-lg leading-none ml-4 flex-shrink-0">&times;</button>
        </div>

        {/* Tab bar */}
        <div className="px-6 border-b border-gray-200 flex gap-0 flex-shrink-0 bg-gray-50/50">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-[#6556d2] text-[#6556d2]"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab.label}
              {tab.count != null && tab.count > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-[16px] px-1 text-[10px] font-semibold rounded-full bg-[#6556d2]/10 text-[#6556d2]">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content area */}
        <div className="overflow-auto flex-1 px-6 py-5">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <svg className="h-8 w-8 animate-spin text-[#6556d2]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm text-gray-400">Loading structural analysis...</span>
            </div>
          )}

          {error && !isLoading && (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <svg className="h-8 w-8 text-red-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-500 font-medium">Failed to load structural data</p>
              <p className="text-xs text-gray-400">{error}</p>
            </div>
          )}

          {data && !isLoading && !min && features.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <p className="text-sm text-gray-400">No structural data available for this document.</p>
            </div>
          )}

          {/* ── TAB: Basic Terms ── */}
          {data && !isLoading && activeTab === "overview" && (
            <div className="space-y-5">
              {/* Parties */}
              <SectionCard title="Parties">
                <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                  <div>
                    <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Lender</span>
                    <FieldValue value={min?.parties?.lender?.legal_name} />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Borrower</span>
                    <FieldValue value={min?.parties?.borrower?.legal_name} />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Borrower Entity Type</span>
                    <FieldValue value={capitalize(min?.parties?.borrower?.entity_type)} />
                  </div>
                </div>
              </SectionCard>

              {/* Loan Terms */}
              <SectionCard title="Loan Terms">
                <div className="grid grid-cols-3 gap-x-6 gap-y-3">
                  <div>
                    <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Commitment Amount</span>
                    <FieldValue value={formatCurrency(min?.loan_terms?.commitment_amount?.amount, min?.loan_terms?.commitment_amount?.currency)} />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Loan Type</span>
                    <FieldValue value={capitalize(min?.loan_terms?.loan_type)} />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Maturity Date</span>
                    <FieldValue value={formatDateDDMMYYYY(min?.loan_terms?.maturity_date ?? null) ?? "—"} />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Interest Rate Type</span>
                    <FieldValue value={capitalize(min?.loan_terms?.interest?.rate_type)} />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Index</span>
                    <FieldValue value={min?.loan_terms?.interest?.index_name} />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Spread (bps)</span>
                    <FieldValue value={min?.loan_terms?.interest?.spread_bps != null ? `${min.loan_terms.interest.spread_bps} bps` : null} />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Extension Available</span>
                    <FieldValue value={boolLabel(min?.loan_terms?.extension_options?.available)} />
                  </div>
                </div>
              </SectionCard>

              {/* Legal */}
              <SectionCard title="Legal">
                <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                  <div>
                    <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Governing Law</span>
                    <FieldValue value={min?.legal?.governing_law_state} />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Venue State</span>
                    <FieldValue value={min?.legal?.venue_state} />
                  </div>
                </div>
              </SectionCard>

              {/* Construction Terms */}
              {min?.construction_terms && (
                <SectionCard title="Construction Terms">
                  <div className="grid grid-cols-3 gap-x-6 gap-y-3">
                    <div className="col-span-3">
                      <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Project Type</span>
                      <FieldValue value={capitalize(min.construction_terms.project_type)} />
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Approved Budget</span>
                      <FieldValue value={formatCurrency(min.construction_terms.approved_budget?.amount, min.construction_terms.approved_budget?.currency)} />
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">LTC Ratio</span>
                      <FieldValue value={min.construction_terms.loan_to_cost_ratio_percent != null ? `${min.construction_terms.loan_to_cost_ratio_percent}%` : null} />
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">LTV Ratio</span>
                      <FieldValue value={min.construction_terms.loan_to_value_ratio_percent != null ? `${min.construction_terms.loan_to_value_ratio_percent}%` : null} />
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Retainage</span>
                      <FieldValue value={min.construction_terms.retainage_percent != null ? `${min.construction_terms.retainage_percent}%` : null} />
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Completion Guaranty</span>
                      <FieldValue value={boolLabel(min.construction_terms.completion_guaranty_required)} />
                    </div>
                  </div>
                </SectionCard>
              )}
            </div>
          )}

          {/* ── TAB: Key Features ── */}
          {data && !isLoading && activeTab === "features" && (
            <div className="space-y-3">
              {features.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">No key features extracted for this document.</p>
              ) : (
                features.map((f, i) => <FeatureCard key={i} feature={f} />)
              )}
            </div>
          )}

          {/* ── TAB: Covenants & Risk ── */}
          {data && !isLoading && activeTab === "technical" && (
            <div className="space-y-5">
              {/* Financial Covenants */}
              <SectionCard title="Financial Covenants">
                <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                  <div>
                    <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Minimum DSCR</span>
                    <FieldValue value={min?.covenants?.financial?.minimum_dscr != null ? `${min.covenants.financial.minimum_dscr}x` : null} />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Interest Reserve Required</span>
                    <FieldValue value={boolLabel(min?.covenants?.financial?.interest_reserve_required)} />
                  </div>
                </div>
              </SectionCard>

              {/* Reporting Covenants */}
              <SectionCard title="Reporting Covenants">
                <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                  <div>
                    <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Reporting Frequency</span>
                    <FieldValue value={capitalize(min?.covenants?.reporting?.reporting_frequency)} />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Financial Statements Required</span>
                    <FieldValue value={boolLabel(min?.covenants?.reporting?.financial_statements_required)} />
                  </div>
                </div>
              </SectionCard>

              {/* Collateral */}
              <SectionCard title="Collateral">
                <div className="grid grid-cols-3 gap-x-6 gap-y-3">
                  <div>
                    <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Secured</span>
                    <FieldValue value={boolLabel(min?.collateral?.secured)} />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Property Type</span>
                    <FieldValue value={capitalize(min?.collateral?.property?.property_type)} />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Location</span>
                    <FieldValue value={[min?.collateral?.property?.city, min?.collateral?.property?.state].filter(Boolean).join(", ") || null} />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Deed of Trust / Mortgage</span>
                    <FieldValue value={boolLabel(min?.collateral?.security_instruments?.mortgage_or_deed_of_trust)} />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Assignment of Rents</span>
                    <FieldValue value={boolLabel(min?.collateral?.security_instruments?.assignment_of_rents)} />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">UCC Fixtures Filed</span>
                    <FieldValue value={boolLabel(min?.collateral?.security_instruments?.ucc_fixtures_filed)} />
                  </div>
                </div>
              </SectionCard>

              {/* Disbursement */}
              <SectionCard title="Disbursement Rules">
                <div className="grid grid-cols-3 gap-x-6 gap-y-3">
                  <div>
                    <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Advance Method</span>
                    <FieldValue value={capitalize(min?.disbursement?.advance_method)} />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Draw Frequency</span>
                    <FieldValue value={capitalize(min?.disbursement?.draw_frequency)} />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Inspection Required</span>
                    <FieldValue value={boolLabel(min?.disbursement?.inspection_required)} />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Title Update Required</span>
                    <FieldValue value={boolLabel(min?.disbursement?.title_update_required)} />
                  </div>
                </div>
              </SectionCard>

              {/* Guaranties */}
              <SectionCard title="Guaranties">
                <div className="grid grid-cols-3 gap-x-6 gap-y-3">
                  <div>
                    <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Guarantor Count</span>
                    <FieldValue value={min?.guaranties?.guarantor_count} />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Payment Guaranty</span>
                    <FieldValue value={boolLabel(min?.guaranties?.payment_guaranty_required)} />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Completion Guaranty</span>
                    <FieldValue value={boolLabel(min?.guaranties?.completion_guaranty_required)} />
                  </div>
                </div>
              </SectionCard>

              {/* Defaults & Remedies */}
              <SectionCard title="Defaults & Remedies">
                <div className="grid grid-cols-3 gap-x-6 gap-y-3">
                  <div>
                    <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Events of Default Defined</span>
                    <FieldValue value={boolLabel(min?.defaults_and_remedies?.events_of_default_defined)} />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Cross Default</span>
                    <FieldValue value={boolLabel(min?.defaults_and_remedies?.cross_default)} />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Remedies Include Foreclosure</span>
                    <FieldValue value={boolLabel(min?.defaults_and_remedies?.remedies_include_foreclosure)} />
                  </div>
                </div>
              </SectionCard>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 flex justify-end flex-shrink-0 bg-gray-50/50">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-white bg-[#6556d2] rounded-md hover:bg-[#5445b5] transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Vectorized Deadlines – urgency helpers (self-contained) ──────────────────

type VDUrgency = "critical" | "standard" | "future" | "past";

function vdGetUrgency(dateRaw: string): VDUrgency {
  if (!dateRaw || dateRaw === "—" || dateRaw === "-") return "future";
  // Attempt to parse the date using common formats
  let parsed: Date | null = null;
  if (dateRaw.includes("T")) {
    const d = new Date(dateRaw);
    if (!isNaN(d.getTime())) parsed = d;
  }
  if (!parsed && /^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) {
    const d = new Date(dateRaw + "T00:00:00");
    if (!isNaN(d.getTime())) parsed = d;
  }
  if (!parsed) {
    const dotParts = dateRaw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (dotParts) {
      const d = new Date(+dotParts[3], +dotParts[2] - 1, +dotParts[1]);
      if (!isNaN(d.getTime())) parsed = d;
    }
  }
  if (!parsed) {
    const d = new Date(dateRaw);
    if (!isNaN(d.getTime())) parsed = d;
  }
  if (!parsed) return "future";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(parsed);
  target.setHours(0, 0, 0, 0);
  const daysRemaining = Math.floor((target.getTime() - today.getTime()) / 86400000);
  if (daysRemaining < 0) return "past";
  if (daysRemaining < 2) return "critical";
  if (daysRemaining <= 10) return "standard";
  return "future";
}

function vdBadgeClasses(u: VDUrgency): string {
  switch (u) {
    case "critical": return "bg-red-100 text-red-700 border-red-200";
    case "standard": return "bg-amber-100 text-amber-700 border-amber-200";
    case "future":   return "bg-blue-100 text-blue-700 border-blue-200";
    case "past":     return "bg-gray-100 text-gray-500 border-gray-200";
  }
}

function vdBadgeLabel(u: VDUrgency): string {
  switch (u) {
    case "critical": return "Critical";
    case "standard": return "Standard";
    case "future":   return "Future";
    case "past":     return "Past";
  }
}

// ── Vectorized Deadlines Table Modal ──────────────────────────────────────────

function VectorDeadlinesPanel({ milestone, onClose }: { milestone: Milestone; onClose: () => void }) {
  const deadlines: DeadlineEntry[] = milestone.deadlines ?? [];
  const ds = milestone.deadline_summary;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 overflow-hidden max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-[#6556d2] flex items-center justify-between flex-shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold text-white">Vectorized Deadlines</h3>
              {ds && ds.total > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-white/20 text-white">
                    {ds.total} total
                  </span>
                  {ds.overdue > 0 && (
                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-red-400/30 text-white">
                      {ds.overdue} overdue
                    </span>
                  )}
                  {ds.needs_resolution > 0 && (
                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-amber-400/30 text-white">
                      {ds.needs_resolution} needs review
                    </span>
                  )}
                </div>
              )}
            </div>
            <p className="text-[11px] text-white/70 mt-0.5 truncate" title={milestone.file_name}>
              {milestone.file_name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white cursor-pointer text-lg leading-none ml-4 flex-shrink-0"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        {deadlines.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-gray-400">No vectorized deadlines found for this document.</p>
          </div>
        ) : (
          <div className="overflow-auto flex-1">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#6556d2]/5 border-b border-[#6556d2]/20">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-[#6556d2] uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-[#6556d2] uppercase tracking-wider whitespace-nowrap">
                    Deadline
                  </th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold text-[#6556d2] uppercase tracking-wider whitespace-nowrap">
                    Urgency
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-[#6556d2] uppercase tracking-wider whitespace-nowrap">
                    Section
                  </th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold text-[#6556d2] uppercase tracking-wider whitespace-nowrap">
                    Page
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {deadlines.map((dl, idx) => {
                  const urgency = vdGetUrgency(dl.date_raw);
                  return (
                    <tr key={idx} className="hover:bg-gray-50/60 transition-colors">
                      {/* Description + inline urgency dot — flex row for alignment */}
                      <td className="px-4 py-3">
                        <div className="flex flex-row items-center gap-2">
                          <span
                            className={`inline-block h-2 w-2 rounded-full flex-shrink-0 ${
                              urgency === "critical" ? "bg-red-500"
                              : urgency === "standard" ? "bg-amber-400"
                              : urgency === "future" ? "bg-blue-500"
                              : "bg-gray-400"
                            }`}
                          />
                          <span className="text-gray-700 text-xs leading-relaxed">
                            {dl.description || "—"}
                          </span>
                        </div>
                      </td>
                      {/* Deadline date */}
                      <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                        {dl.date_raw || "—"}
                      </td>
                      {/* Urgency badge — centred, perfectly inline */}
                      <td className="px-4 py-3">
                        <div className="flex flex-row items-center justify-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full border ${vdBadgeClasses(urgency)}`}
                          >
                            {vdBadgeLabel(urgency)}
                          </span>
                        </div>
                      </td>
                      {/* Section */}
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {dl.section_title || "—"}
                      </td>
                      {/* Page */}
                      <td className="px-4 py-3 text-gray-600 text-xs text-center">
                        {dl.section_index != null ? String(dl.section_index) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between flex-shrink-0 bg-gray-50/50">
          <span className="text-[11px] text-gray-400">
            {deadlines.length} deadline{deadlines.length !== 1 ? "s" : ""} found
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-white bg-[#6556d2] rounded-md hover:bg-[#5445b5] transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
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

// ── AI Analyzed Deadlines Modal ──────────────────────────────────────────────

function AiAnalyzedModal({
  milestone,
  data,
  isLoading,
  error,
  onClose,
}: {
  milestone: Milestone;
  data: AiDeadlinesData | null;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const dateRows: { label: string; value: string | null }[] = data
    ? [
        { label: "Effective Date", value: formatDateDDMMYYYY(data.effective_date) },
        { label: "Maturity Date", value: formatDateDDMMYYYY(data.maturity_date) },
        { label: "Construction Completion Deadline", value: formatDateDDMMYYYY(data.construction_completion_deadline) },
      ]
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-[#6556d2] flex items-center justify-between flex-shrink-0">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white">AI Analyzed Deadlines</h3>
            <p className="text-[11px] text-white/70 mt-0.5 truncate" title={milestone.file_name}>
              {milestone.file_name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white cursor-pointer text-lg leading-none ml-4 flex-shrink-0"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <svg className="h-8 w-8 animate-spin text-[#6556d2]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm text-gray-400">Analyzing deadlines...</span>
            </div>
          )}

          {error && !isLoading && (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <svg className="h-8 w-8 text-red-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-500 font-medium">Failed to load deadlines</p>
              <p className="text-xs text-gray-400">{error}</p>
            </div>
          )}

          {data && !isLoading && (
            <div className="space-y-4">
              {dateRows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50/50 px-4 py-3"
                >
                  <CalendarIcon />
                  <div className="min-w-0 flex-1">
                    <span className="text-[11px] font-semibold text-[#6556d2] uppercase tracking-wider">
                      {row.label}
                    </span>
                    {row.value ? (
                      <p className="mt-0.5 text-sm font-medium text-gray-700">{row.value}</p>
                    ) : (
                      <p className="mt-0.5 text-sm text-gray-400 italic">Not detected</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 flex justify-end flex-shrink-0 bg-gray-50/50">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-white bg-[#6556d2] rounded-md hover:bg-[#5445b5] transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Important Info Modal ──────────────────────────────────────────────────────

/** IDs / technical keys hidden from the data grid */
const HIDDEN_KEYS = new Set(["id", "created_at", "updated_at", "document_id"]);

/** Convert snake_case key to a readable label  */
function snakeCaseToLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Heuristic: values longer than this threshold span both columns */
const LONG_VALUE_THRESHOLD = 80;

function ImportantInfoModal({
  milestone,
  data,
  isLoading,
  error,
  onClose,
}: {
  milestone: Milestone;
  data: ImportantInfoData | null;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Build entries dynamically, filtering out hidden technical keys
  const entries = data
    ? Object.entries(data).filter(([key]) => !HIDDEN_KEYS.has(key))
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-[#6556d2] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {/* Sparkle icon */}
            <svg className="h-5 w-5 text-white/90 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
            </svg>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-white">Document Important Information</h3>
              <p className="text-[11px] text-white/70 mt-0.5 truncate" title={milestone.file_name}>
                {milestone.file_name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white cursor-pointer text-lg leading-none ml-4 flex-shrink-0"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="overflow-auto flex-1 px-6 py-5">
          {/* Loading skeleton */}
          {isLoading && (
            <div className="border border-gray-200 rounded-lg bg-gray-50/60 p-5">
              <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className={i === 6 ? "col-span-2" : ""}>
                    <div className="h-3 w-24 bg-gray-200 rounded animate-pulse mb-2" />
                    <div className={`h-4 ${i === 6 ? "w-full" : "w-40"} bg-gray-200 rounded animate-pulse`} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error state */}
          {error && !isLoading && (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <svg className="h-8 w-8 text-red-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-500 font-medium">Failed to load document info</p>
              <p className="text-xs text-gray-400">{error}</p>
            </div>
          )}

          {/* Dynamic data grid */}
          {data && !isLoading && (
            <div className="border border-[#6556d2]/15 rounded-lg bg-gray-50/60 p-5">
              {entries.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No information available for this document.</p>
              ) : (
                <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                  {entries.map(([key, value]) => {
                    const stringVal = value == null ? "" : String(value);
                    const isBool = typeof value === "boolean";
                    const isLong = stringVal.length > LONG_VALUE_THRESHOLD;

                    return (
                      <div key={key} className={isLong ? "col-span-2" : ""}>
                        <span className="text-[11px] font-semibold text-[#6556d2] uppercase tracking-wider">
                          {snakeCaseToLabel(key)}
                        </span>

                        {isBool ? (
                          <div className="mt-1">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                value
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-red-100 text-red-600"
                              }`}
                            >
                              {value ? "Yes" : "No"}
                            </span>
                          </div>
                        ) : stringVal ? (
                          <p className="mt-1 text-sm text-gray-700 leading-relaxed">{stringVal}</p>
                        ) : (
                          <p className="mt-1 text-sm text-gray-400">&mdash;</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 flex justify-end flex-shrink-0 bg-gray-50/50">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-white bg-[#6556d2] rounded-md hover:bg-[#5445b5] transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete Confirmation Modal ────────────────────────────────────────────────

function DeleteConfirmModal({
  fileName,
  isDeleting,
  onConfirm,
  onCancel,
}: {
  fileName: string;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !isDeleting) onCancel();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onCancel, isDeleting]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={isDeleting ? undefined : onCancel}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-shrink-0 h-9 w-9 rounded-full bg-red-50 flex items-center justify-center">
              <svg className="h-5 w-5 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Delete file</h3>
              <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[250px]" title={fileName}>{fileName}</p>
            </div>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">
            Are you sure you want to delete this file and all its analyzed data? This action cannot be undone.
          </p>
        </div>
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-3 py-1.5 text-xs font-medium text-white bg-red-500 rounded-md hover:bg-red-600 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
          >
            {isDeleting && (
              <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {isDeleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Toast notification ──────────────────────────────────────────────────────

function Toast({ message, type, onDismiss }: { message: string; type: "success" | "error"; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return createPortal(
    <div className="fixed top-4 right-4 z-[9999] animate-[fadeIn_200ms_ease-out]">
      <div
        className={`flex items-start gap-2 px-4 py-3 rounded-lg shadow-lg border max-w-sm ${
          type === "success"
            ? "bg-white border-emerald-200 text-gray-700"
            : "bg-white border-red-200 text-gray-700"
        }`}
      >
        {type === "success" ? (
          <svg className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ) : (
          <svg className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm leading-relaxed">{message}</p>
        </div>
        <button onClick={onDismiss} className="text-gray-400 hover:text-gray-600 text-sm leading-none cursor-pointer flex-shrink-0">&times;</button>
      </div>
    </div>,
    document.body
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
  onDelete: (id: string) => Promise<DeleteFileResult>;
  isUploading?: boolean;
  uploadingFileName?: string;
  /** External modal trigger from the Deadline Calendar */
  calendarAction?: { type: CalendarActionType; milestone: Milestone } | null;
  /** Callback to acknowledge that the external action has been handled */
  onCalendarActionHandled?: () => void;
}

export default function StructuralDataLookup({
  data,
  isLoading,
  isRefreshing,
  lastRefreshed,
  fetchError,
  onDelete,
  isUploading = false,
  uploadingFileName = "",
  calendarAction = null,
  onCalendarActionHandled,
}: StructuralDataLookupProps) {
  const [filterText, setFilterText] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [vectorMilestone, setVectorMilestone] = useState<Milestone | null>(null);
  const [aiMilestone, setAiMilestone] = useState<Milestone | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: "upload_time", direction: "desc" });

  // Delete flow state
  const [deleteTarget, setDeleteTarget] = useState<Milestone | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    const docId = deleteTarget.document_id || deleteTarget.id;
    setIsDeleting(true);
    setDeletingId(docId);
    try {
      const result = await onDelete(docId);
      if (result.success) {
        setToast({ message: result.message, type: "success" });
      } else {
        setToast({ message: `Failed to delete the file. ${result.message}`, type: "error" });
      }
    } catch {
      setToast({ message: "Failed to delete the file. Please try again.", type: "error" });
    } finally {
      setIsDeleting(false);
      setDeletingId(null);
      setDeleteTarget(null);
    }
  }, [deleteTarget, onDelete]);

  // Structure Detail modal state
  const [structDetailMilestone, setStructDetailMilestone] = useState<Milestone | null>(null);
  const [structDetailData, setStructDetailData] = useState<StructureData | null>(null);
  const [structDetailLoading, setStructDetailLoading] = useState(false);
  const [structDetailError, setStructDetailError] = useState<string | null>(null);

  const handleDetail = useCallback(async (entry: Milestone) => {
    const docId = entry.document_id || entry.id;
    setStructDetailMilestone(entry);
    setStructDetailData(null);
    setStructDetailError(null);
    setStructDetailLoading(true);
    try {
      const res = await fetch(
        `https://20.110.72.120.nip.io/webhook/getStructureByID?document_id=${encodeURIComponent(docId)}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (!text) {
        // Empty response — show modal with empty state
        setStructDetailData({ min_structure: null, max_structure: null });
      } else {
        const json = JSON.parse(text);
        const payload = Array.isArray(json) ? json[0] ?? {} : json;
        setStructDetailData(payload as StructureData);
      }
    } catch (err: unknown) {
      setStructDetailError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setStructDetailLoading(false);
    }
  }, []);

  // AI Analyzed modal state
  const [aiAnalyzedMilestone, setAiAnalyzedMilestone] = useState<Milestone | null>(null);
  const [aiAnalyzedData, setAiAnalyzedData] = useState<AiDeadlinesData | null>(null);
  const [aiAnalyzedLoading, setAiAnalyzedLoading] = useState(false);
  const [aiAnalyzedError, setAiAnalyzedError] = useState<string | null>(null);

  const handleAiAnalyzed = useCallback(async (entry: Milestone) => {
    const docId = entry.document_id || entry.id;
    setAiAnalyzedMilestone(entry);
    setAiAnalyzedData(null);
    setAiAnalyzedError(null);
    setAiAnalyzedLoading(true);
    try {
      const res = await fetch(
        `https://20.110.72.120.nip.io/webhook/get-deadlines/AIdeadlines/${encodeURIComponent(docId)}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const payload = Array.isArray(json) ? json[0] ?? {} : json;
      setAiAnalyzedData(payload as AiDeadlinesData);
    } catch (err: unknown) {
      setAiAnalyzedError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setAiAnalyzedLoading(false);
    }
  }, []);

  // Important Info modal state
  const [importantInfoMilestone, setImportantInfoMilestone] = useState<Milestone | null>(null);
  const [importantInfoData, setImportantInfoData] = useState<ImportantInfoData | null>(null);
  const [importantInfoLoading, setImportantInfoLoading] = useState(false);
  const [importantInfoError, setImportantInfoError] = useState<string | null>(null);

  const handleImportantInfo = useCallback(async (entry: Milestone) => {
    const docId = entry.document_id || entry.id;
    setImportantInfoMilestone(entry);
    setImportantInfoData(null);
    setImportantInfoError(null);
    setImportantInfoLoading(true);
    try {
      const res = await fetch(
        `https://20.110.72.120.nip.io/webhook/get-deadlines/importantInfo/${encodeURIComponent(docId)}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      // Accept either the root object or first array element
      const payload = Array.isArray(json) ? json[0] ?? {} : json;
      setImportantInfoData(payload as ImportantInfoData);
    } catch (err: unknown) {
      setImportantInfoError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setImportantInfoLoading(false);
    }
  }, []);

  // ── External calendar action bridge ───────────────────────────────────────
  useEffect(() => {
    if (!calendarAction) return;
    const { type, milestone } = calendarAction;
    switch (type) {
      case "detail":
        handleDetail(milestone);
        break;
      case "importantInfo":
        handleImportantInfo(milestone);
        break;
      case "aiDeadlines":
        handleAiAnalyzed(milestone);
        break;
      case "vectorDeadlines":
        setVectorMilestone(milestone);
        break;
    }
    onCalendarActionHandled?.();
  }, [calendarAction, handleDetail, handleImportantInfo, handleAiAnalyzed, onCalendarActionHandled]);

  const handleSort = useCallback((key: SortKey) => {
    setSortConfig((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" }
    );
  }, []);

  const filtered = useMemo(() => {
    // 1. Filter
    let result = data;

    if (filterText.trim()) {
      const q = filterText.toLowerCase();
      result = data.filter(
        (m) =>
          m.file_name.toLowerCase().includes(q) ||
          (m.lender && m.lender.toLowerCase().includes(q)) ||
          (m.borrower && m.borrower.toLowerCase().includes(q)) ||
          formatUploadDate(m.upload_time).includes(q)
      );
    }

    // 2. Sort
    const { key, direction } = sortConfig;
    const mult = direction === "asc" ? 1 : -1;

    return [...result].sort((a, b) => {
      if (key === "upload_time") {
        return mult * (new Date(a.upload_time).getTime() - new Date(b.upload_time).getTime());
      }
      const valA = (a[key] ?? "").toLowerCase();
      const valB = (b[key] ?? "").toLowerCase();
      return mult * valA.localeCompare(valB);
    });
  }, [data, filterText, sortConfig]);

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
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-md bg-gray-50 text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#6556d2]/40 focus:border-[#6556d2] transition-colors"
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
            <svg className="h-8 w-8 animate-spin text-[#6556d2]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm text-gray-400">Loading documents...</span>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto" style={{ display: isLoading && data.length === 0 ? "none" : undefined }}>
          <table className="w-full text-sm table-fixed" style={{ minWidth: "900px" }}>
            <thead>
              <tr className="border-b border-gray-100">
                {([
                  { key: "file_name" as SortKey, label: "Name", width: "w-[24%]" },
                  { key: "upload_time" as SortKey, label: "Upload Date", width: "w-[12%]" },
                  { key: "lender" as SortKey, label: "StakeHolder 1", width: "w-[24%]" },
                  { key: "borrower" as SortKey, label: "StakeHolder 2", width: "w-[24%]" },
                ] as const).map((col) => {
                  const isActive = sortConfig.key === col.key;
                  return (
                    <th
                      key={col.key}
                      className={`${col.width} px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider select-none cursor-pointer group ${
                        isActive ? "text-[#6556d2]" : "text-gray-500"
                      }`}
                      onClick={() => handleSort(col.key)}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        <span className={isActive ? "text-[#6556d2]" : "text-gray-300 group-hover:text-gray-400 transition-colors"}>
                          {isActive
                            ? sortConfig.direction === "asc"
                              ? <ChevronUpIcon />
                              : <ChevronDownIcon />
                            : <SortIcon />}
                        </span>
                      </span>
                    </th>
                  );
                })}
                <th className="w-[16%] px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {/* Ghost row while uploading */}
              {isUploading && uploadingFileName && !isLoading && (
                <tr className="animate-pulse bg-[#6556d2]/[0.03]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[#6556d2] font-medium truncate" title={uploadingFileName}>
                        {uploadingFileName}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-[#6556d2] bg-[#6556d2]/10 rounded-full whitespace-nowrap flex-shrink-0">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#6556d2]" />
                        Batch Processing...
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#6556d2]/70 text-xs italic">Just now</td>
                  <td className="px-4 py-3"><div className="h-4 w-24 bg-[#6556d2]/10 rounded animate-pulse" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-24 bg-[#6556d2]/10 rounded animate-pulse" /></td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-2 opacity-30 pointer-events-none">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 font-medium text-white bg-[#6556d2] rounded-md"><InfoIcon /></span>
                    </div>
                  </td>
                </tr>
              )}
              {isLoading ? (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              ) : filtered.length === 0 && !isUploading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-gray-400">
                    No matching records found.
                  </td>
                </tr>
              ) : (
                paginatedData.map((entry) => (
                  <Fragment key={entry.id}>
                    <tr className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-gray-700 font-medium truncate" title={entry.file_name}>
                            {entry.file_name}
                          </span>
                          {entry.raw_status.toLowerCase() !== "vectorized" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-[#6556d2] bg-[#6556d2]/10 rounded-full whitespace-nowrap flex-shrink-0 animate-pulse">
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#6556d2]" />
                              Batch Processing
                            </span>
                          )}
                        </div>
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
                      <td className="px-4 py-2">
                        <div className="flex items-center justify-end gap-2">
                          {/* 1. Detail Icon */}
                          <button
                            onClick={() => handleDetail(entry)}
                            title="Detail"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 font-medium text-white bg-[#6556d2] rounded-md hover:bg-[#5445b5] transition-colors cursor-pointer whitespace-nowrap"
                          >
                            <InfoIcon />
                          </button>
                          {/* 2. Deadlines Dropdown */}
                          <DeadlinesDropdown
                            onAiDeadlines={() => handleAiAnalyzed(entry)}
                            onVectorDeadlines={() => setVectorMilestone(entry)}
                          />
                          {/* 3. Important Info Button */}
                          <button
                            onClick={() => handleImportantInfo(entry)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-white bg-[#6556d2] rounded-md hover:bg-[#5445b5] transition-colors cursor-pointer whitespace-nowrap"
                          >
                            <SparklesIcon />
                            Important info
                          </button>
                          {/* 4. Delete Icon */}
                          <button
                            onClick={() => setDeleteTarget(entry)}
                            disabled={deletingId === (entry.document_id || entry.id)}
                            title="Delete"
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {deletingId === (entry.document_id || entry.id) ? (
                              <svg className="h-4 w-4 animate-spin text-[#6556d2]" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                            ) : (
                              <Trash2Icon />
                            )}
                          </button>
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
                      ? "bg-[#6556d2] text-white"
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
      {structDetailMilestone && (
        <StructureDetailModal
          milestone={structDetailMilestone}
          data={structDetailData}
          isLoading={structDetailLoading}
          error={structDetailError}
          onClose={() => setStructDetailMilestone(null)}
        />
      )}
      {vectorMilestone && (
        <VectorDeadlinesPanel milestone={vectorMilestone} onClose={() => setVectorMilestone(null)} />
      )}
      {aiMilestone && (
        <AiDeadlinesPanel milestone={aiMilestone} onClose={() => setAiMilestone(null)} />
      )}
      {aiAnalyzedMilestone && (
        <AiAnalyzedModal
          milestone={aiAnalyzedMilestone}
          data={aiAnalyzedData}
          isLoading={aiAnalyzedLoading}
          error={aiAnalyzedError}
          onClose={() => setAiAnalyzedMilestone(null)}
        />
      )}
      {importantInfoMilestone && (
        <ImportantInfoModal
          milestone={importantInfoMilestone}
          data={importantInfoData}
          isLoading={importantInfoLoading}
          error={importantInfoError}
          onClose={() => setImportantInfoMilestone(null)}
        />
      )}
      {deleteTarget && (
        <DeleteConfirmModal
          fileName={deleteTarget.file_name}
          isDeleting={isDeleting}
          onConfirm={handleDeleteConfirm}
          onCancel={() => { if (!isDeleting) setDeleteTarget(null); }}
        />
      )}
      {toast && (
        <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
      )}
    </>
  );
}
