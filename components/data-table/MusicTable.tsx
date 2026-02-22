"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslations } from "@/hooks/use-translations";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Download,
  Music,
  CheckCircle,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox";
import { useGenres } from "@/hooks/use-genres";
import type { ProviderMusic, PaginatedResponse } from "@/types";
import { DifficultyMedal } from "@/components/ui/difficulty-medal";
import { InstrumentIcon } from "@/components/ui/instrument-icon";
import Image from "next/image";
import {
  MultiSelect,
  MultiSelectContent,
  MultiSelectGroup,
  MultiSelectItem,
  MultiSelectTrigger,
  MultiSelectValue,
} from "@/components/ui/multi-select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import InstallationSelector, {
  useInstallation,
} from "@/components/installations/InstallationSelector";
import { useSession } from "@/lib/auth-client";
import { useUserLists } from "@/hooks/use-user-lists";
import { SongActions } from "@/components/data-table/SongActions";

interface MusicTableProps {
  onTotalChange: (total: number) => void;
  onSongSelect?: (song: ProviderMusic) => void;
  externalFilter?: { artist?: string; genre?: string; album?: string; charter?: string } | null;
}

const INSTRUMENTS = ["guitar", "bass", "drums", "vocals", "keys"] as const;

// Hoist static JSX to prevent recreation on every render
const LoadingSkeleton = () =>
  Array.from({ length: 20 }).map((_, i) => (
    <TableRow key={i}>
      <TableCell className="hidden sm:table-cell">
        <Skeleton className="h-8 w-8 sm:h-12 sm:w-12 rounded" />
      </TableCell>
      <TableCell>
        <div className="flex items-start gap-2 sm:gap-3">
          <div className="h-8 w-8 rounded shrink-0 sm:hidden">
            <Skeleton className="h-full w-full rounded" />
          </div>
          <div className="min-w-0 flex-1">
            <Skeleton className="h-4 w-20 sm:w-32 mb-1" />
            <Skeleton className="h-3 w-16 sm:w-24 sm:hidden" />
          </div>
        </div>
      </TableCell>
      <TableCell className="hidden sm:table-cell">
        <Skeleton className="h-4 w-16 sm:w-24" />
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <Skeleton className="h-4 w-16 sm:w-24" />
      </TableCell>
      <TableCell className="hidden lg:table-cell">
        <Skeleton className="h-6 w-20 sm:w-32" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-8 w-16 sm:w-24" />
      </TableCell>
    </TableRow>
  ));

export default function MusicTable({
  onTotalChange,
  onSongSelect,
  externalFilter,
}: MusicTableProps) {
  const { t } = useTranslations();
  const [data, setData] = useState<ProviderMusic[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [limit] = useState(20);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [sortBy, setSortBy] = useState<string>("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [source, setSource] = useState<string>("");
  const [genre, setGenre] = useState<string>("");
  const [instruments, setInstruments] = useState<string[]>([]);
  const [artist, setArtist] = useState<string>("");
  const [albumFilter, setAlbumFilter] = useState<string>("");
  const [charter, setCharter] = useState<string>("");
  const [showOnlyInstalled, setShowOnlyInstalled] = useState<boolean>(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const isMounted = useRef(false);
  const requestIdRef = useRef(0);

  // Get selected installation from context
  const { selectedInstallationId } = useInstallation();

  // Auth and lists
  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;
  const { nonFavoriteLists, addSongToList } = useUserLists(isAuthenticated);

  // Genre combobox data
  const { genres: genreOptions } = useGenres();

  // Track the sort the user had before we auto-switched to relevance
  const sortBeforeQueryRef = useRef<{
    sortBy: string;
    sortOrder: "asc" | "desc";
  } | null>(null);

  // Ref to read current sort without adding to effect deps
  const sortRef = useRef({ sortBy, sortOrder });
  useEffect(() => { sortRef.current = { sortBy, sortOrder }; }, [sortBy, sortOrder]);

  // Simple debounce — only updates debouncedQuery
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // React to debouncedQuery changes: reset pagination + auto-switch sort
  const prevDebouncedQueryRef = useRef(debouncedQuery);
  useEffect(() => {
    const prev = prevDebouncedQueryRef.current;
    prevDebouncedQueryRef.current = debouncedQuery;
    if (prev === debouncedQuery) return;

    setData([]);
    setNextCursor(null);
    setHasMore(true);

    const hadQuery = !!prev;
    const hasQuery = !!debouncedQuery;

    if (!hadQuery && hasQuery) {
      sortBeforeQueryRef.current = { ...sortRef.current };
      setSortBy("relevance");
      setSortOrder("desc");
    } else if (hadQuery && !hasQuery) {
      if (sortBeforeQueryRef.current) {
        setSortBy(sortBeforeQueryRef.current.sortBy);
        setSortOrder(sortBeforeQueryRef.current.sortOrder as "asc" | "desc");
        sortBeforeQueryRef.current = null;
      } else {
        setSortBy("createdAt");
        setSortOrder("desc");
      }
    }
  }, [debouncedQuery]);

  const fetchData = useCallback(
    async (isLoadMore = false, cursor?: string | null) => {
      if (isLoadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const requestId = ++requestIdRef.current;

      try {
        const params = new URLSearchParams({
          limit: limit.toString(),
          sortBy,
          sortOrder,
        });

        if (debouncedQuery) params.set("query", debouncedQuery);
        if (genre) params.set("genre", genre);
        if (source) params.set("source", source);
        if (instruments.length > 0)
          params.set("instruments", instruments.join(","));
        if (selectedInstallationId)
          params.set("installationId", selectedInstallationId);
        if (showOnlyInstalled && selectedInstallationId)
          params.set("installed", "true");
        if (artist) params.set("artist", artist);
        if (albumFilter) params.set("album", albumFilter);
        if (charter) params.set("charter", charter);

        if (isLoadMore && cursor) {
          params.set("cursor", cursor);
        }

        const response = await fetch(`/api/music?${params}`);
        if (response.ok) {
          const result: PaginatedResponse<ProviderMusic> =
            await response.json();
          if (isMounted.current && requestId === requestIdRef.current) {
            if (isLoadMore) {
              // Append data for infinite scroll
              setData((prev) => [...prev, ...result.data]);
              setNextCursor(result.nextCursor);
              setHasMore(result.hasMore);
            } else {
              // Replace data for initial load
              setData(result.data);
              setNextCursor(result.nextCursor);
              setHasMore(result.hasMore);
            }
            setTotal(result.total);
          }
        } else {
          console.error(
            "API response not ok:",
            response.status,
            response.statusText,
          );
        }
      } catch (error: unknown) {
        console.error("Error fetching music:", error);
      } finally {
        if (isMounted.current && requestId === requestIdRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [
      limit,
      sortBy,
      sortOrder,
      debouncedQuery,
      genre,
      source,
      instruments,
      selectedInstallationId,
      showOnlyInstalled,
      artist,
      albumFilter,
      charter,
    ],
  );

  // Memoize the sort icon to prevent unnecessary re-renders
  const SortIcon = useMemo(() => {
    return function sortIcon({ column }: { column: string }) {
      if (sortBy !== column)
        return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />;
      return sortOrder === "asc" ? (
        <ArrowUp className="ml-2 h-4 w-4" />
      ) : (
        <ArrowDown className="ml-2 h-4 w-4" />
      );
    };
  }, [sortBy, sortOrder]);

  useEffect(() => {
    isMounted.current = true;
    fetchData();
    return () => {
      isMounted.current = false;
    };
  }, [fetchData]);

  // Notify parent when total changes
  useEffect(() => {
    onTotalChange(total);
  }, [total, onTotalChange]);

  // Optimistic favorite toggle - updates local data and calls API
  const toggleFavorite = useCallback(async (songId: string) => {
    // Optimistic update
    setData((prev) =>
      prev.map((m) =>
        m.id === songId ? { ...m, favorited: !m.favorited } : m,
      ),
    );

    try {
      const response = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songId }),
      });

      if (!response.ok) throw new Error("Failed to toggle favorite");

      const { isFavorited } = await response.json();
      // Sync with server response
      setData((prev) =>
        prev.map((m) =>
          m.id === songId ? { ...m, favorited: isFavorited } : m,
        ),
      );
      return isFavorited as boolean;
    } catch {
      // Revert optimistic update
      setData((prev) =>
        prev.map((m) =>
          m.id === songId ? { ...m, favorited: !m.favorited } : m,
        ),
      );
      throw new Error("Failed to toggle favorite");
    }
  }, []);

  const handleSort = (column: string) => {
    // User is explicitly choosing a sort, clear the auto-switch ref
    sortBeforeQueryRef.current = null;

    if (sortBy === column) {
      if (sortOrder === "asc") {
        setSortOrder("desc");
      } else {
        // Third click: reset to relevance if there's an active query, otherwise createdAt
        if (debouncedQuery) {
          setSortBy("relevance");
        } else {
          setSortBy("createdAt");
        }
        setSortOrder("desc");
      }
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
    // Reset data and cursor when sorting changes
    setData([]);
    setNextCursor(null);
    setHasMore(true);
  };

  const loadMore = useCallback(() => {
    if (hasMore && !loadingMore && !loading && nextCursor) {
      fetchData(true, nextCursor);
    }
  }, [hasMore, loadingMore, loading, fetchData, nextCursor]);

  // Reset data when filters change
  const handleFilterChange = useCallback(() => {
    setData([]);
    setNextCursor(null);
    setHasMore(true);
  }, []);

  // Apply external filters (e.g. from SongDetail click-to-filter)
  const prevExternalFilterRef = useRef<typeof externalFilter>(null);
  useEffect(() => {
    if (!externalFilter) return;
    const prev = prevExternalFilterRef.current;
    // Skip if identical filter values — avoids wiping data when clicking the same filter twice
    if (
      prev &&
      prev.artist === externalFilter.artist &&
      prev.album === externalFilter.album &&
      prev.genre === externalFilter.genre &&
      prev.charter === externalFilter.charter
    ) return;
    prevExternalFilterRef.current = externalFilter;
    setQuery("");
    setDebouncedQuery("");
    if (externalFilter.genre !== undefined) setGenre(externalFilter.genre);
    if (externalFilter.artist !== undefined) setArtist(externalFilter.artist);
    if (externalFilter.album !== undefined) setAlbumFilter(externalFilter.album);
    if (externalFilter.charter !== undefined) setCharter(externalFilter.charter);
    handleFilterChange();
  }, [externalFilter, handleFilterChange]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    // Only set up observer if we have data and more to load
    if (!data.length || !hasMore || loading || loadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMore && !loadingMore && !loading) {
          loadMore();
        }
      },
      {
        rootMargin: "1000px",
        threshold: 0.1,
      },
    );

    const loadMoreTrigger = document.getElementById("load-more-trigger");
    if (loadMoreTrigger) {
      observer.observe(loadMoreTrigger);
    }

    return () => {
      if (loadMoreTrigger) {
        observer.unobserve(loadMoreTrigger);
      }
      observer.disconnect();
    };
  }, [loadMore, hasMore, loadingMore, loading, data.length]);

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col gap-3">
        {/* Search input - exclusive row */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("table.searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={`pl-10 h-10 text-sm w-full ${query ? "active-filter" : ""}`}
          />
        </div>

        {/* Active exact-match filter badges */}
        {(artist || albumFilter || charter) && (
          <div className="flex flex-wrap gap-1.5">
            {artist && (
              <Badge variant="secondary" className="text-xs gap-1 pr-1 active-filter-badge">
                {artist}
                <button
                  onClick={() => { setArtist(""); handleFilterChange(); }}
                  className="ml-1 hover:opacity-70"
                  aria-label="Clear artist filter"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {albumFilter && (
              <Badge variant="secondary" className="text-xs gap-1 pr-1 active-filter-badge">
                {albumFilter}
                <button
                  onClick={() => { setAlbumFilter(""); handleFilterChange(); }}
                  className="ml-1 hover:opacity-70"
                  aria-label="Clear album filter"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {charter && (
              <Badge variant="secondary" className="text-xs gap-1 pr-1 active-filter-badge">
                {charter}
                <button
                  onClick={() => { setCharter(""); handleFilterChange(); }}
                  className="ml-1 hover:opacity-70"
                  aria-label="Clear charter filter"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
          </div>
        )}

        {/* Other filters - second row */}
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Instruments filter - full width on mobile, auto on desktop */}
          <div className="w-full sm:flex-1">
            <MultiSelect
              values={instruments}
              onValuesChange={(val) => {
                setInstruments(val);
                handleFilterChange();
              }}
            >
              <MultiSelectTrigger className={`h-9 w-full text-sm ${instruments.length > 0 ? "active-filter" : ""}`}>
                <MultiSelectValue placeholder={t("table.allInstruments")} />
              </MultiSelectTrigger>
              <MultiSelectContent>
                <MultiSelectGroup>
                  {INSTRUMENTS.map((inst: string) => (
                    <MultiSelectItem
                      key={inst}
                      value={inst}
                      className="capitalize"
                    >
                      <div className="flex items-center gap-2">
                        <InstrumentIcon
                          instrument={inst}
                          className="size-4 sm:size-5"
                        />
                        <span className="text-sm">
                          {t(`table.instrumentsObj.${inst}`)}
                        </span>
                      </div>
                    </MultiSelectItem>
                  ))}
                </MultiSelectGroup>
              </MultiSelectContent>
            </MultiSelect>
          </div>

          {/* Genre filter combobox */}
          <div className="w-full sm:w-auto">
            <Combobox
              value={genre || null}
              onValueChange={(val) => {
                setGenre(val ?? "");
                handleFilterChange();
              }}
              items={genreOptions.map((g) => g.name)}
            >
              <ComboboxInput
                placeholder={t("table.allGenres") || "All genres"}
                showClear={!!genre}
                className={`w-full sm:w-45 h-9 text-sm ${genre ? "active-filter" : ""}`}
              />
              <ComboboxContent>
                <ComboboxEmpty>{t("table.noGenresFound")}</ComboboxEmpty>
                <ComboboxList>
                  {(genre: string) => (
                    <ComboboxItem key={genre} value={genre}>
                      {genre}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </div>

          {/* Source filter - full width on mobile, auto on desktop */}
          <div className="w-full sm:w-auto">
            <Select
              value={source || "all"}
              onValueChange={(v) => {
                setSource(v === "all" ? "" : v);
                handleFilterChange();
              }}
            >
              <SelectTrigger className={`flex-1 sm:w-37.5 h-9 ${source ? "active-filter" : ""}`}>
                <SelectValue placeholder={t("table.allSources")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("table.allSources")}</SelectItem>
                <SelectItem value="enchor">Enchor.us</SelectItem>
                <SelectItem value="rhythmverse">Rhythmverse</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Installation Selector */}
      <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border">
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {t("table.showInstalled")}
        </span>
        <InstallationSelector compact />
        {selectedInstallationId && (
          <>
            <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              {t("table.installedHighlighted")}
            </span>
            <div className="flex items-center gap-2 ml-auto">
              <Checkbox
                id="show-only-installed"
                checked={showOnlyInstalled}
                onCheckedChange={(checked) => {
                  setShowOnlyInstalled(checked === true);
                  handleFilterChange();
                }}
              />
              <label
                htmlFor="show-only-installed"
                className="text-sm font-medium leading-none cursor-pointer"
              >
                {t("table.showOnlyInstalled")}
              </label>
            </div>
          </>
        )}
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="hidden sm:table-cell w-12 sm:w-16">
                {t("table.cover")}
              </TableHead>
              <TableHead className="min-w-25">
                <Button
                  variant="ghost"
                  onClick={() => handleSort("name")}
                  className="p-0 hover:bg-transparent text-xs sm:text-sm"
                >
                  {t("table.song")} <SortIcon column="name" />
                </Button>
              </TableHead>
              <TableHead className="hidden sm:table-cell min-w-20">
                <Button
                  variant="ghost"
                  onClick={() => handleSort("artist")}
                  className="p-0 hover:bg-transparent text-xs sm:text-sm"
                >
                  {t("table.artist")} <SortIcon column="artist" />
                </Button>
              </TableHead>
              <TableHead className="hidden md:table-cell min-w-20">
                <Button
                  variant="ghost"
                  onClick={() => handleSort("album")}
                  className="p-0 hover:bg-transparent text-xs sm:text-sm"
                >
                  {t("table.album")} <SortIcon column="album" />
                </Button>
              </TableHead>
              <TableHead className="hidden lg:table-cell min-w-25">
                {t("table.instruments")}
              </TableHead>

              <TableHead className="w-20 sm:w-32">
                {t("table.actions")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <LoadingSkeleton />
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Music className="h-8 w-8" />
                    <p className="text-sm">{t("table.noSongsFound")}</p>
                    <p className="text-xs">{t("table.tryDifferentSearch")}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              data.map((music) => (
                <TableRow
                  key={music.id}
                  className={`cursor-pointer ${
                    music.installed
                      ? "bg-green-500/5 hover:bg-green-500/10"
                      : ""
                  }`}
                  onClick={() => onSongSelect?.(music)}
                >
                  <TableCell className="hidden sm:table-cell">
                    <div className="relative h-8 w-8 sm:h-12 sm:w-12 rounded">
                      {music.coverUrl ? (
                        <>
                          <Image
                            src={music.coverUrl}
                            alt={music.name}
                            className="h-8 w-8 sm:h-12 sm:w-12 rounded object-cover bg-muted opacity-0 transition-opacity duration-300"
                            width={48}
                            height={48}
                            sizes="(max-width: 640px) 32px, 48px"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              const parent = target.parentElement;
                              if (parent) {
                                const skeleton =
                                  parent.querySelector(".loading-skeleton");
                                const fallback =
                                  parent.querySelector(".error-fallback");
                                if (skeleton) {
                                  (skeleton as HTMLElement).style.display =
                                    "none";
                                }
                                if (fallback) {
                                  (fallback as HTMLElement).style.display =
                                    "flex";
                                }
                              }
                            }}
                            onLoad={(e) => {
                              const target = e.target as HTMLImageElement;
                              const parent = target.parentElement;
                              if (parent) {
                                const skeleton =
                                  parent.querySelector(".loading-skeleton");
                                const fallback =
                                  parent.querySelector(".error-fallback");
                                if (skeleton) {
                                  (skeleton as HTMLElement).style.display =
                                    "none";
                                }
                                if (fallback) {
                                  (fallback as HTMLElement).style.display =
                                    "none";
                                }
                              }
                              target.style.opacity = "1";
                            }}
                          />
                          {/* Loading skeleton - shown while image is loading */}
                          <div className="loading-skeleton absolute inset-0 h-8 w-8 sm:h-12 sm:w-12 rounded">
                            <Skeleton className="h-full w-full rounded" />
                          </div>
                          {/* Error fallback - shown only on error */}
                          <div
                            className="error-fallback absolute inset-0 h-8 w-8 sm:h-12 sm:w-12 rounded bg-muted flex items-center justify-center"
                            style={{ display: "none" }}
                          >
                            <div className="h-4 w-4 sm:h-6 sm:w-6 rounded bg-muted flex items-center justify-center text-muted-foreground font-bold text-xs sm:text-sm">
                              <Music className="h-4 w-4 sm:h-6 sm:w-6 text-muted-foreground" />
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="h-8 w-8 sm:h-12 sm:w-12 rounded bg-muted flex items-center justify-center">
                          <Music className="h-4 w-4 sm:h-6 sm:w-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-start gap-2 sm:gap-3">
                      {/* Album image - shown on all screen sizes in this cell for mobile layout */}
                      <div className="relative h-8 w-8 sm:h-12 sm:w-12 rounded shrink-0 sm:hidden">
                        {music.coverUrl ? (
                          <>
                            <Image
                              src={music.coverUrl}
                              alt={music.name}
                              className="h-8 w-8 rounded object-cover bg-muted opacity-0 transition-opacity duration-300"
                              width={32}
                              height={32}
                              sizes="32px"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                const parent = target.parentElement;
                                if (parent) {
                                  const skeleton =
                                    parent.querySelector(".loading-skeleton");
                                  const fallback =
                                    parent.querySelector(".error-fallback");
                                  if (skeleton) {
                                    (skeleton as HTMLElement).style.display =
                                      "none";
                                  }
                                  if (fallback) {
                                    (fallback as HTMLElement).style.display =
                                      "flex";
                                  }
                                }
                              }}
                              onLoad={(e) => {
                                const target = e.target as HTMLImageElement;
                                const parent = target.parentElement;
                                if (parent) {
                                  const skeleton =
                                    parent.querySelector(".loading-skeleton");
                                  const fallback =
                                    parent.querySelector(".error-fallback");
                                  if (skeleton) {
                                    (skeleton as HTMLElement).style.display =
                                      "none";
                                  }
                                  if (fallback) {
                                    (fallback as HTMLElement).style.display =
                                      "none";
                                  }
                                }
                                target.style.opacity = "1";
                              }}
                            />
                            {/* Loading skeleton - shown while image is loading */}
                            <div className="loading-skeleton absolute inset-0 h-8 w-8 rounded">
                              <Skeleton className="h-full w-full rounded" />
                            </div>
                            {/* Error fallback - shown only on error */}
                            <div
                              className="error-fallback absolute inset-0 h-8 w-8 rounded bg-muted flex items-center justify-center"
                              style={{ display: "none" }}
                            >
                              <div className="h-4 w-4 rounded bg-muted-foreground/20 flex items-center justify-center text-muted-foreground font-bold text-xs">
                                ?
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                            <Music className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                      </div>

                      {/* Song and artist info */}
                      <div className="min-w-0 flex-1">
                        <div
                          className={`max-w-25 sm:max-w-50 truncate text-xs sm:text-sm flex items-center gap-1 ${music.installed ? "text-green-600 dark:text-green-400 font-medium" : ""}`}
                        >
                          {music.installed && (
                            <CheckCircle className="h-3 w-3 shrink-0" />
                          )}
                          {music.name}
                        </div>
                        <div
                          className={`max-w-25 sm:max-w-50 truncate text-xs sm:text-sm sm:hidden ${music.installed ? "text-green-600/80 dark:text-green-400/80" : "text-muted-foreground"}`}
                        >
                          {music.artist}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell
                    className={`max-w-15 sm:max-w-37.5 truncate text-xs sm:text-sm hidden sm:table-cell ${music.installed ? "text-green-600 dark:text-green-400" : ""}`}
                  >
                    {music.artist}
                  </TableCell>
                  <TableCell
                    className={`hidden md:table-cell max-w-15 sm:max-w-37.5 truncate text-xs sm:text-sm ${music.installed ? "text-green-600/80 dark:text-green-400/80" : ""}`}
                  >
                    {music.album}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="flex gap-1 sm:gap-2">
                      {INSTRUMENTS.map((inst: string) => {
                        const diff = music.instruments[inst as keyof typeof music.instruments];
                        if (diff === null) return null;
                        return (
                          <div
                            key={inst}
                            className="flex items-center gap-1"
                            title={inst}
                          >
                            <Tooltip>
                              <TooltipTrigger>
                                <DifficultyMedal
                                  level={diff}
                                  size="sm"
                                  icon={<InstrumentIcon instrument={inst} />}
                                />
                              </TooltipTrigger>
                              <TooltipContent>
                                {inst.charAt(0).toUpperCase() + inst.slice(1)} (
                                {diff} / 7)
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        );
                      })}
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-0.5">
                      {isAuthenticated && music.id && (
                        <SongActions
                          songId={music.id}
                          isFavorited={!!music.favorited}
                          onToggleFavorite={toggleFavorite}
                          lists={nonFavoriteLists}
                          onAddToList={addSongToList}
                        />
                      )}
                      {music.downloadUrls?.length ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                          className="h-8 w-8 sm:h-10 sm:w-10"
                        >
                          <a
                            href={music.downloadUrls[0].url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Download className="h-3 w-3 sm:h-4 sm:w-4" />
                          </a>
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled
                          className="h-8 w-8 sm:h-10 sm:w-10"
                        >
                          <Download className="h-3 w-3 sm:h-4 sm:w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Load More */}
      <div className="flex flex-col items-center gap-3">
        {/* Intersection Observer trigger element */}
        <div id="load-more-trigger" className="h-1" />

        {hasMore && (
          <Button
            variant="outline"
            onClick={loadMore}
            disabled={loadingMore || loading}
            className="w-full sm:w-auto"
          >
            {loadingMore ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                {t("table.loading") || "Loading..."}
              </>
            ) : (
              <>{t("table.loadMore") || "Load More"}</>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
