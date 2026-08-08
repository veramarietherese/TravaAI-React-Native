import { useCallback, useEffect, useMemo, useState } from "react";

import {
  createTravelRoute,
  deleteTravelRoute,
  fetchTravelRoutes,
} from "../api/travel-globe.api";
import type {
  HomeTravelRoute,
  HomeTravelRouteInput,
  HomeTravelRouteStats,
} from "../types/home.types";

interface RouteState {
  userId: string | null;
  routes: HomeTravelRoute[];
  loading: boolean;
  refreshing: boolean;
  saving: boolean;
  error: string | null;
}

const EMPTY_STATE: RouteState = {
  userId: null,
  routes: [],
  loading: false,
  refreshing: false,
  saving: false,
  error: null,
};

export function useTravelRoutes(userId: string | undefined) {
  const [state, setState] = useState<RouteState>(EMPTY_STATE);

  useEffect(() => {
    if (!userId) return;
    let active = true;

    void (async () => {
      try {
        const routes = await fetchTravelRoutes();
        if (!active) return;
        setState({
          userId,
          routes,
          loading: false,
          refreshing: false,
          saving: false,
          error: null,
        });
      } catch (error) {
        if (!active) return;
        setState({
          userId,
          routes: [],
          loading: false,
          refreshing: false,
          saving: false,
          error: error instanceof Error ? error.message : "Unable to load your travel routes.",
        });
      }
    })();

    return () => {
      active = false;
    };
  }, [userId]);

  const visible = useMemo<RouteState>(() => {
    if (!userId) return EMPTY_STATE;
    if (state.userId === userId) return state;
    return { ...EMPTY_STATE, userId, loading: true };
  }, [state, userId]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setState((current) => ({
      ...current,
      userId,
      refreshing: true,
      error: null,
    }));
    try {
      const routes = await fetchTravelRoutes();
      setState({
        userId,
        routes,
        loading: false,
        refreshing: false,
        saving: false,
        error: null,
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        userId,
        refreshing: false,
        error: error instanceof Error ? error.message : "Unable to refresh your routes.",
      }));
    }
  }, [userId]);

  const addRoute = useCallback(
    async (input: HomeTravelRouteInput) => {
      if (!userId) throw new Error("Please sign in again.");
      setState((current) => ({ ...current, userId, saving: true, error: null }));
      try {
        const route = await createTravelRoute(input);
        setState((current) => ({
          ...current,
          userId,
          routes: [
            ...(current.userId === userId
              ? current.routes.filter((item) => item.id !== route.id)
              : []),
            route,
          ].sort(
            (first, second) =>
              first.traveledAt.localeCompare(second.traveledAt) ||
              first.createdAt.localeCompare(second.createdAt),
          ),
          saving: false,
          error: null,
        }));
        return route;
      } catch (error) {
        setState((current) => ({
          ...current,
          userId,
          saving: false,
          error: error instanceof Error ? error.message : "Unable to save this route.",
        }));
        throw error;
      }
    },
    [userId],
  );

  const removeRoute = useCallback(
    async (routeId: string) => {
      if (!userId) return;
      setState((current) => ({ ...current, userId, saving: true, error: null }));
      try {
        await deleteTravelRoute(routeId);
        setState((current) => ({
          ...current,
          userId,
          routes:
            current.userId === userId
              ? current.routes.filter((route) => route.id !== routeId)
              : [],
          saving: false,
          error: null,
        }));
      } catch (error) {
        setState((current) => ({
          ...current,
          userId,
          saving: false,
          error: error instanceof Error ? error.message : "Unable to remove this route.",
        }));
        throw error;
      }
    },
    [userId],
  );

  const stats = useMemo<HomeTravelRouteStats>(() => {
    const countries = new Set<string>();
    visible.routes.forEach((route) => {
      countries.add(route.originCode);
      countries.add(route.destinationCode);
    });
    const totalDistanceKm = visible.routes.reduce(
      (sum, route) => sum + route.distanceKm,
      0,
    );
    const travelDays = new Set(
      visible.routes.map((route) => route.traveledAt).filter(Boolean),
    ).size;
    return {
      totalDistanceKm,
      totalDistanceMiles: totalDistanceKm * 0.621371,
      flights: visible.routes.length,
      countries: countries.size,
      travelDays,
    };
  }, [visible.routes]);

  return {
    routes: visible.routes,
    stats,
    isLoading: visible.loading,
    isRefreshing: visible.refreshing,
    isSaving: visible.saving,
    error: visible.error,
    refresh,
    addRoute,
    removeRoute,
  };
}
