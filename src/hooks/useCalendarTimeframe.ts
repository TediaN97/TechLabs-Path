import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  getCalendarTimeframeRange,
  buildTimeframeUrl,
  timeframesEqual,
  normalizeCalendarResponse,
  type MonthTimeframe,
  type ViewMonth,
  type CalendarDeadlineMap,
  type ApiTimeframeResponse,
} from "../services/calendarTimeframe";
import { CALENDAR_TIMEFRAME_URL } from "./useAgent";

/** Debounce delay for rapid month navigation (ms). */
const NAVIGATION_DEBOUNCE_MS = 300;

// ── API fetch service ──────────────────────────────────────────────────────────

/**
 * Fetch calendar deadline data for the given month timeframe.
 * Returns the parsed & normalized response, or null if aborted.
 */
async function fetchCalendarTimeframe(
  timeframe: MonthTimeframe,
  signal: AbortSignal
): Promise<{ deadlineMap: CalendarDeadlineMap; today: string; totalInWindow: number } | null> {
  const url = buildTimeframeUrl(CALENDAR_TIMEFRAME_URL, timeframe);

  try {
    const res = await fetch(url, { method: "GET", signal });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const text = await res.text();
    if (!text || text.trim().length === 0) {
      return { deadlineMap: {}, today: new Date().toISOString().slice(0, 10), totalInWindow: 0 };
    }

    const json = JSON.parse(text) as ApiTimeframeResponse;

    // Use the server-provided `today` for consistent severity calculation
    const todayISO = json.today || new Date().toISOString().slice(0, 10);
    const calendarEntries = json.calendar ?? [];
    const deadlineMap = normalizeCalendarResponse(calendarEntries, todayISO);

    return {
      deadlineMap,
      today: todayISO,
      totalInWindow: json.total_in_window ?? Object.keys(deadlineMap).length,
    };
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return null; // navigation changed — not an error
    }
    throw err;
  }
}

// ── Hook ────────────────────────────────────────────────────────────────────────

export interface UseCalendarTimeframeResult {
  /** Date-keyed deadline lookup map for the current month */
  deadlineMap: CalendarDeadlineMap;
  /** The server's "today" value (used for severity calculation) */
  serverToday: string;
  /** Total deadlines in the current window */
  totalInWindow: number;
  /** Whether the initial fetch is in progress */
  isLoading: boolean;
  /** Whether a subsequent fetch is in progress */
  isFetching: boolean;
  /** Error message, if the last fetch failed */
  error: string | null;
  /** The current computed month timeframe (1st → last day) */
  timeframe: MonthTimeframe;
  /** Force a re-fetch of the current timeframe */
  refetch: () => void;
}

export function useCalendarTimeframe(
  viewMonth: ViewMonth
): UseCalendarTimeframeResult {
  const [deadlineMap, setDeadlineMap] = useState<CalendarDeadlineMap>({});
  const [serverToday, setServerToday] = useState(() => new Date().toISOString().slice(0, 10));
  const [totalInWindow, setTotalInWindow] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastFetchedRef = useRef<MonthTimeframe | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasFetchedOnce = useRef(false);

  // Use expanded range: start_date = 1st of previous month, end_date = last of current month.
  // This ensures we fetch deadlines whose warning/future reminders may fall in the visible month.
  const timeframe = useMemo(
    () => getCalendarTimeframeRange({
      year: viewMonth.year,
      month: viewMonth.month,
    }),
    [viewMonth.year, viewMonth.month]
  );

  const applyResult = useCallback(
    (result: { deadlineMap: CalendarDeadlineMap; today: string; totalInWindow: number }, tf: MonthTimeframe) => {
      setDeadlineMap(result.deadlineMap);
      setServerToday(result.today);
      setTotalInWindow(result.totalInWindow);
      setError(null);
      lastFetchedRef.current = tf;
      hasFetchedOnce.current = true;
    },
    []
  );

  // Main effect: debounce navigation → fetch
  useEffect(() => {
    if (timeframesEqual(timeframe, lastFetchedRef.current) && hasFetchedOnce.current) {
      return;
    }

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (abortControllerRef.current) abortControllerRef.current.abort();

    const isFirst = !hasFetchedOnce.current;
    const delay = isFirst ? 0 : NAVIGATION_DEBOUNCE_MS;

    debounceTimerRef.current = setTimeout(() => {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      if (isFirst) setIsLoading(true);
      else setIsFetching(true);

      fetchCalendarTimeframe(timeframe, controller.signal)
        .then((result) => {
          if (result === null) return; // aborted
          applyResult(result, timeframe);
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : "Failed to fetch calendar data";
          setError(message);
          console.error("[CalendarTimeframe] Fetch failed:", err);
        })
        .finally(() => {
          setIsLoading(false);
          setIsFetching(false);
        });
    }, delay);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [timeframe, applyResult]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const refetch = useCallback(() => {
    lastFetchedRef.current = null;
    if (abortControllerRef.current) abortControllerRef.current.abort();

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsFetching(true);

    fetchCalendarTimeframe(timeframe, controller.signal)
      .then((result) => {
        if (result === null) return;
        applyResult(result, timeframe);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Failed to fetch calendar data";
        setError(message);
      })
      .finally(() => {
        setIsFetching(false);
      });
  }, [timeframe, applyResult]);

  return {
    deadlineMap,
    serverToday,
    totalInWindow,
    isLoading,
    isFetching,
    error,
    timeframe,
    refetch,
  };
}
