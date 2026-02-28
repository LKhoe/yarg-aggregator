"use client";

import { useState, useEffect, useRef } from "react";

export interface Genre {
  id: string;
  name: string;
}

// Module-level cache — genres change only when a provider sync runs
let cachedGenres: Genre[] | null = null;

export function useGenres() {
  const [genres, setGenres] = useState<Genre[]>(cachedGenres ?? []);
  const [loading, setLoading] = useState(cachedGenres === null);
  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;

    if (cachedGenres !== null) {
      return () => { isMounted.current = false; };
    }

    async function fetchAllGenres() {
      setLoading(true);
      try {
        const response = await fetch("/api/genres?all=true");
        if (response.ok) {
          const result = await response.json();
          cachedGenres = result.genres as Genre[];
          if (isMounted.current) {
            setGenres(cachedGenres);
          }
        }
      } catch (error) {
        console.error("Error fetching genres:", error);
      } finally {
        if (isMounted.current) {
          setLoading(false);
        }
      }
    }

    fetchAllGenres();
    return () => {
      isMounted.current = false;
    };
  }, []);

  return { genres, loading };
}
