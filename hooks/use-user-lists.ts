"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

interface UserList {
  id: string;
  name: string;
  slug: string;
  isFavorites: boolean;
  isPublic: boolean;
  itemCount: number;
}

export function useUserLists(isAuthenticated: boolean) {
  const [lists, setLists] = useState<UserList[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setLists([]);
      setLoaded(false);
      return;
    }

    let cancelled = false;

    async function fetchLists() {
      try {
        const response = await fetch("/api/lists");
        if (!response.ok) return;
        const data: UserList[] = await response.json();
        if (!cancelled) {
          setLists(data);
          setLoaded(true);
        }
      } catch {
        // silently fail
      }
    }

    fetchLists();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const nonFavoriteLists = useMemo(
    () => lists.filter((l) => !l.isFavorites),
    [lists],
  );

  const addSongToList = useCallback(async (listId: string, songId: string) => {
    const response = await fetch(`/api/lists/${listId}/songs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ songId }),
    });

      if (!response.ok) {
        throw new Error("Failed to add song to list");
      }

      return response.json();
    },
    [],
  );

  return { lists, nonFavoriteLists, addSongToList, loaded };
}
