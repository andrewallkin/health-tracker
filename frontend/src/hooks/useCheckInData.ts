import { useCallback, useEffect, useState } from "react";

import { deleteCheckIn, fetchCheckInForDate, upsertCheckIn } from "../lib/api";
import type { CheckIn } from "../types/health";

export function useCheckInData(selectedDate: string, enabled: boolean) {
  const [checkIn, setCheckIn] = useState<CheckIn | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [deleteCheckInError, setDeleteCheckInError] = useState<string | null>(null);
  const [checkInLoadError, setCheckInLoadError] = useState<string | null>(null);
  const [isDeletingCheckIn, setIsDeletingCheckIn] = useState(false);

  const fetchKey = enabled ? `${selectedDate}:${reloadKey}` : null;
  const loadingCheckIn = fetchKey !== null && loadedKey !== fetchKey;

  const reloadCheckIn = useCallback(() => {
    setReloadKey((key) => key + 1);
  }, []);

  useEffect(() => {
    if (!fetchKey) return;

    let cancelled = false;

    fetchCheckInForDate(selectedDate)
      .then((loaded) => {
        if (!cancelled) {
          setCheckIn(loaded);
          setCheckInLoadError(null);
          setLoadedKey(fetchKey);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setCheckInLoadError(
            err instanceof Error ? err.message : "Could not load check-in.",
          );
          setLoadedKey(fetchKey);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fetchKey, selectedDate]);

  const handleSaveCheckIn = async (payload: {
    weightKg: number | null;
    photoPaths: string[];
  }) => {
    const saved = await upsertCheckIn({
      checkInDate: selectedDate,
      weightKg: payload.weightKg,
      photoPaths: payload.photoPaths,
    });
    setCheckIn(saved);
    reloadCheckIn();
    return saved;
  };

  const handleDeleteCheckIn = async () => {
    if (!checkIn) return;
    setDeleteCheckInError(null);
    setIsDeletingCheckIn(true);
    try {
      await deleteCheckIn(checkIn.id);
      setCheckIn(null);
      reloadCheckIn();
    } catch (err) {
      setDeleteCheckInError(err instanceof Error ? err.message : "Could not delete check-in.");
    } finally {
      setIsDeletingCheckIn(false);
    }
  };

  return {
    checkIn,
    loadingCheckIn,
    checkInLoadError,
    deleteCheckInError,
    isDeletingCheckIn,
    handleSaveCheckIn,
    handleDeleteCheckIn,
    dismissDeleteCheckInError: () => setDeleteCheckInError(null),
  };
}
