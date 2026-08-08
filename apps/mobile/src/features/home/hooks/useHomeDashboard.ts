import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchHomeDashboard } from "../api/home.api";
import type { HomeDashboardData } from "../types/home.types";
import { readHomeCache, writeHomeCache } from "../utils/home-storage";

interface UseHomeDashboardResult {
  data: HomeDashboardData | null;
  isLoading: boolean;
  isRefreshing: boolean;
  isUsingCachedData: boolean;
  error: string | null;
  refresh(): Promise<void>;
}

interface DashboardState {
  userId: string | null;
  data: HomeDashboardData | null;
  isLoading: boolean;
  isRefreshing: boolean;
  isUsingCachedData: boolean;
  error: string | null;
}

const EMPTY_STATE: DashboardState = {
  userId: null,
  data: null,
  isLoading: false,
  isRefreshing: false,
  isUsingCachedData: false,
  error: null,
};

export function useHomeDashboard(userId: string | undefined): UseHomeDashboardResult {
  const [state, setState] = useState<DashboardState>(EMPTY_STATE);

  useEffect(() => {
    if (!userId) return;

    let active = true;

    void (async () => {
      const cached = await readHomeCache(userId);
      if (!active) return;

      setState({
        userId,
        data: cached,
        isLoading: !cached,
        isRefreshing: false,
        isUsingCachedData: Boolean(cached),
        error: null,
      });

      try {
        const nextData = await fetchHomeDashboard();
        if (!active) return;

        setState({
          userId,
          data: nextData,
          isLoading: false,
          isRefreshing: false,
          isUsingCachedData: false,
          error: null,
        });
        await writeHomeCache(userId, nextData);
      } catch (loadError) {
        if (!active) return;

        setState((current) => ({
          userId,
          data: current.userId === userId ? current.data : cached,
          isLoading: false,
          isRefreshing: false,
          isUsingCachedData: Boolean(
            current.userId === userId ? current.data : cached,
          ),
          error:
            loadError instanceof Error
              ? loadError.message
              : "Unable to refresh your dashboard.",
        }));
      }
    })();

    return () => {
      active = false;
    };
  }, [userId]);

  const refresh = useCallback(async () => {
    if (!userId) return;

    setState((current) => ({
      userId,
      data: current.userId === userId ? current.data : null,
      isLoading: current.userId !== userId || !current.data,
      isRefreshing: current.userId === userId && Boolean(current.data),
      isUsingCachedData:
        current.userId === userId && current.isUsingCachedData,
      error: null,
    }));

    try {
      const nextData = await fetchHomeDashboard();
      setState({
        userId,
        data: nextData,
        isLoading: false,
        isRefreshing: false,
        isUsingCachedData: false,
        error: null,
      });
      await writeHomeCache(userId, nextData);
    } catch (refreshError) {
      setState((current) => ({
        userId,
        data: current.userId === userId ? current.data : null,
        isLoading: false,
        isRefreshing: false,
        isUsingCachedData:
          current.userId === userId && Boolean(current.data),
        error:
          refreshError instanceof Error
            ? refreshError.message
            : "Unable to refresh your dashboard.",
      }));
    }
  }, [userId]);

  const visibleState = useMemo<DashboardState>(() => {
    if (!userId) return EMPTY_STATE;
    if (state.userId === userId) return state;

    return {
      userId,
      data: null,
      isLoading: true,
      isRefreshing: false,
      isUsingCachedData: false,
      error: null,
    };
  }, [state, userId]);

  return {
    data: visibleState.data,
    isLoading: visibleState.isLoading,
    isRefreshing: visibleState.isRefreshing,
    isUsingCachedData: visibleState.isUsingCachedData,
    error: visibleState.error,
    refresh,
  };
}
