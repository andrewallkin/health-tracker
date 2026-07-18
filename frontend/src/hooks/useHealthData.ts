import { useEffect, useState } from "react";

import {
  fetchHealthDay,
  fetchHealthMonth,
  fetchHealthWeek,
  type HealthDayError,
} from "../lib/api";
import { ApiError } from "../lib/client";
import { getWeekRange, monthFromDateKey } from "../lib/dates";
import type { DailyHealth } from "../types/health";

function parseFetchError(err: unknown): { loadError: string; garminDisconnected: boolean } {
  if (err instanceof ApiError && err.status === 503) {
    return { loadError: err.message, garminDisconnected: true };
  }
  return {
    loadError: err instanceof Error ? err.message : "Could not load health data.",
    garminDisconnected: false,
  };
}

export function useHealthDay(dateKey: string, enabled: boolean) {
  const [day, setDay] = useState<DailyHealth | null>(null);
  const [errors, setErrors] = useState<HealthDayError[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [garminDisconnected, setGarminDisconnected] = useState(false);

  const fetchKey = enabled ? dateKey : null;
  const loading = fetchKey !== null && loadedKey !== fetchKey;

  useEffect(() => {
    if (!fetchKey) return;

    let cancelled = false;

    fetchHealthDay(dateKey)
      .then((response) => {
        if (!cancelled) {
          setDay(response.day);
          setErrors(response.errors);
          setLoadError(null);
          setGarminDisconnected(false);
          setLoadedKey(fetchKey);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const { loadError: message, garminDisconnected: disconnected } = parseFetchError(err);
          setDay(null);
          setErrors([]);
          setLoadError(message);
          setGarminDisconnected(disconnected);
          setLoadedKey(fetchKey);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fetchKey, dateKey]);

  return { day, errors, loading, loadError, garminDisconnected };
}

export function useHealthWeek(anchorDate: string, enabled: boolean) {
  const weekStart = getWeekRange(anchorDate).start;
  const [days, setDays] = useState<DailyHealth[]>([]);
  const [errors, setErrors] = useState<HealthDayError[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [garminDisconnected, setGarminDisconnected] = useState(false);

  const fetchKey = enabled ? weekStart : null;
  const loading = fetchKey !== null && loadedKey !== fetchKey;

  useEffect(() => {
    if (!fetchKey) return;

    let cancelled = false;

    fetchHealthWeek(weekStart)
      .then((response) => {
        if (!cancelled) {
          setDays(response.days);
          setErrors(response.errors);
          setLoadError(null);
          setGarminDisconnected(false);
          setLoadedKey(fetchKey);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const { loadError: message, garminDisconnected: disconnected } = parseFetchError(err);
          setDays([]);
          setErrors([]);
          setLoadError(message);
          setGarminDisconnected(disconnected);
          setLoadedKey(fetchKey);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fetchKey, weekStart]);

  return { days, errors, loading, loadError, garminDisconnected };
}

export function useHealthMonth(anchorDate: string, enabled: boolean) {
  const { year, month } = monthFromDateKey(anchorDate);
  const [days, setDays] = useState<DailyHealth[]>([]);
  const [errors, setErrors] = useState<HealthDayError[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [garminDisconnected, setGarminDisconnected] = useState(false);

  const fetchKey = enabled ? `${year}-${month}` : null;
  const loading = fetchKey !== null && loadedKey !== fetchKey;

  useEffect(() => {
    if (!fetchKey) return;

    let cancelled = false;

    fetchHealthMonth(year, month + 1)
      .then((response) => {
        if (!cancelled) {
          setDays(response.days);
          setErrors(response.errors);
          setLoadError(null);
          setGarminDisconnected(false);
          setLoadedKey(fetchKey);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const { loadError: message, garminDisconnected: disconnected } = parseFetchError(err);
          setDays([]);
          setErrors([]);
          setLoadError(message);
          setGarminDisconnected(disconnected);
          setLoadedKey(fetchKey);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fetchKey, year, month]);

  return { days, errors, loading, loadError, garminDisconnected };
}
