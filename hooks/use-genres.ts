"use client";

import { useState, useEffect, useRef } from "react";

interface Genre {
  id: string;
  name: string;
}

export function useGenres() {
  const [genres, setGenres] = useState<Genre[]>([]);
  const [loading, setLoading] = useState(false);
  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;

    async function fetchAllGenres() {
      setLoading(true);
      try {
        const response = await fetch("/api/genres?all=true");
        if (response.ok) {
          const result = await response.json();
          if (isMounted.current) {
            setGenres(result.genres);
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
