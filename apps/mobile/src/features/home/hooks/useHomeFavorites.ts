import { useCallback, useEffect, useMemo, useState } from "react";

import type { HomeListing } from "../types/home.types";
import {
  getListingFavoriteKey,
  readHomeFavorites,
  writeHomeFavorites,
} from "../utils/home-storage";

interface FavoritesState {
  userId: string | null;
  values: string[];
}

const EMPTY_FAVORITES: FavoritesState = { userId: null, values: [] };

export function useHomeFavorites(userId: string | undefined) {
  const [state, setState] = useState<FavoritesState>(EMPTY_FAVORITES);

  useEffect(() => {
    if (!userId) return;

    let active = true;

    void readHomeFavorites(userId).then((stored) => {
      if (!active) return;
      setState({ userId, values: stored });
    });

    return () => {
      active = false;
    };
  }, [userId]);

  const favorites = useMemo(
    () => (state.userId === userId ? state.values : []),
    [state, userId],
  );

  const isFavorite = useCallback(
    (listing: HomeListing) => favorites.includes(getListingFavoriteKey(listing)),
    [favorites],
  );

  const toggleFavorite = useCallback(
    (listing: HomeListing) => {
      if (!userId) return;

      const key = getListingFavoriteKey(listing);
      setState((current) => {
        const currentValues = current.userId === userId ? current.values : [];
        const nextValues = currentValues.includes(key)
          ? currentValues.filter((item) => item !== key)
          : [...currentValues, key];

        void writeHomeFavorites(userId, nextValues);
        return { userId, values: nextValues };
      });
    },
    [userId],
  );

  return { favorites, isFavorite, toggleFavorite };
}
