"use client";

import { useState, useEffect, useCallback, useRef, use } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useTranslations } from "@/hooks/use-translations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  ArrowLeft,
  Trash2,
  Plus,
  Search,
  Save,
  Import,
  X,
  Music,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { ProviderMusic, PaginatedResponse } from "@/types";
import Link from "next/link";
import Image from "next/image";

interface InstallationSongData {
  id: string;
  songId: string;
  title: string;
  artistName: string;
  installedAt: string;
}

interface InstallationDetail {
  id: string;
  name: string;
  path: string | null;
  createdAt: string;
  updatedAt: string;
}

type SearchResult = ProviderMusic;

interface ListData {
  id: string;
  name: string;
  ownerDisplayName: string;
  itemCount: number;
  isFavorites: boolean;
}

function InstallationDetailContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t } = useTranslations();
  const router = useRouter();
  const [inst, setInst] = useState<InstallationDetail | null>(null);
  const [songs, setSongs] = useState<InstallationSongData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editName, setEditName] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  const [songFilter, setSongFilter] = useState("");

  // Add song dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMoreSearch, setIsLoadingMoreSearch] = useState(false);
  const [searchNextCursor, setSearchNextCursor] = useState<string | null>(null);
  const [searchHasMore, setSearchHasMore] = useState(false);
  const [addingSongId, setAddingSongId] = useState<string | null>(null);
  const searchScrollRef = useRef<HTMLDivElement>(null);
  const searchLoadMoreRef = useRef<HTMLDivElement>(null);

  // Import from list dialog state
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [lists, setLists] = useState<ListData[]>([]);
  const [isLoadingLists, setIsLoadingLists] = useState(false);
  const [importingListId, setImportingListId] = useState<string | null>(null);

  const fetchInstallation = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/installations/${id}`);
      if (response.ok) {
        const data = await response.json();
        setInst(data.installation);
        setSongs(data.songs);
        setEditName(data.installation.name);
      } else {
        toast.error(t("admin.installations.fetchError"));
      }
    } catch {
      toast.error(t("admin.installations.fetchError"));
    } finally {
      setIsLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    fetchInstallation();
  }, [fetchInstallation]);

  const handleSaveName = async () => {
    if (!editName.trim() || editName.trim() === inst?.name) return;
    setIsSavingName(true);
    try {
      const response = await fetch(`/api/admin/installations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim() }),
      });

      if (response.ok) {
        const data = await response.json();
        setInst(data.installation);
        toast.success(t("admin.installations.nameUpdated"));
      } else {
        toast.error(t("admin.installations.nameUpdateError"));
      }
    } catch {
      toast.error(t("admin.installations.nameUpdateError"));
    } finally {
      setIsSavingName(false);
    }
  };

  const handleRemoveSong = async (songId: string) => {
    try {
      const response = await fetch(`/api/admin/installations/${id}/songs`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songId }),
      });

      if (response.ok) {
        setSongs(songs.filter((s) => s.songId !== songId));
        toast.success(t("admin.installations.songRemoved"));
      } else {
        toast.error(t("admin.installations.songRemoveError"));
      }
    } catch {
      toast.error(t("admin.installations.songRemoveError"));
    }
  };

  // Debounce search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setDebouncedSearchQuery("");
      setSearchResults([]);
      setSearchNextCursor(null);
      setSearchHasMore(false);
      return;
    }
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch search results when debounced query changes
  const fetchSearchResults = useCallback(
    async (cursor?: string | null) => {
      if (!debouncedSearchQuery) return;
      const isLoadMore = !!cursor;
      if (isLoadMore) {
        setIsLoadingMoreSearch(true);
      } else {
        setIsSearching(true);
      }
      try {
        const params = new URLSearchParams({
          query: debouncedSearchQuery,
          limit: "20",
          sortBy: "relevance",
          sortOrder: "desc",
        });
        if (cursor) params.set("cursor", cursor);

        const response = await fetch(`/api/music?${params}`);
        if (response.ok) {
          const data: PaginatedResponse<ProviderMusic> = await response.json();
          if (isLoadMore) {
            setSearchResults((prev) => [...prev, ...data.data]);
          } else {
            setSearchResults(data.data);
          }
          setSearchNextCursor(data.nextCursor);
          setSearchHasMore(data.hasMore);
        }
      } catch {
        toast.error(t("admin.installations.searchError"));
      } finally {
        setIsSearching(false);
        setIsLoadingMoreSearch(false);
      }
    },
    [debouncedSearchQuery, t],
  );

  useEffect(() => {
    if (debouncedSearchQuery) {
      fetchSearchResults();
    }
  }, [debouncedSearchQuery, fetchSearchResults]);

  // Intersection observer for infinite scroll in search results
  useEffect(() => {
    if (!searchHasMore || isSearching || isLoadingMoreSearch) return;
    const el = searchLoadMoreRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          searchHasMore &&
          !isLoadingMoreSearch
        ) {
          fetchSearchResults(searchNextCursor);
        }
      },
      { root: searchScrollRef.current, rootMargin: "200px", threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [
    searchHasMore,
    isSearching,
    isLoadingMoreSearch,
    searchNextCursor,
    fetchSearchResults,
  ]);

  const handleAddSong = async (songId: string) => {
    setAddingSongId(songId);
    try {
      const response = await fetch(`/api/admin/installations/${id}/songs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songId }),
      });

      if (response.ok) {
        toast.success(t("admin.installations.songAdded"));
        // Refresh to get full song data
        await fetchInstallation();
      } else {
        toast.error(t("admin.installations.songAddError"));
      }
    } catch {
      toast.error(t("admin.installations.songAddError"));
    } finally {
      setAddingSongId(null);
    }
  };

  const handleOpenImportDialog = async () => {
    setImportDialogOpen(true);
    setIsLoadingLists(true);
    try {
      const response = await fetch("/api/admin/lists");
      if (response.ok) {
        const data = await response.json();
        setLists(data.lists);
      }
    } catch {
      toast.error(t("admin.installations.fetchListsError"));
    } finally {
      setIsLoadingLists(false);
    }
  };

  const handleImportFromList = async (listId: string) => {
    setImportingListId(listId);
    try {
      // Fetch list song IDs via admin endpoint
      const listResponse = await fetch(`/api/admin/lists/${listId}/songs`);
      if (!listResponse.ok) {
        toast.error(t("admin.installations.importError"));
        return;
      }
      const listData = await listResponse.json();
      const songIds: string[] = listData.songIds;

      if (songIds.length === 0) {
        toast.error(t("admin.installations.listEmpty"));
        return;
      }

      const response = await fetch(`/api/admin/installations/${id}/songs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songIds }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(
          t("admin.installations.importSuccess", {
            added: data.added,
            skipped: data.skipped,
          }),
        );
        await fetchInstallation();
        setImportDialogOpen(false);
      } else {
        toast.error(t("admin.installations.importError"));
      }
    } catch {
      toast.error(t("admin.installations.importError"));
    } finally {
      setImportingListId(null);
    }
  };

  const handleDeleteInstallation = async () => {
    try {
      const response = await fetch(`/api/admin/installations/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success(t("admin.installations.deleted"));
        router.push("/admin/installations");
      } else {
        toast.error(t("admin.installations.deleteError"));
      }
    } catch {
      toast.error(t("admin.installations.deleteError"));
    }
  };

  const filteredSongs = songs.filter(
    (s) =>
      !songFilter ||
      s.title.toLowerCase().includes(songFilter.toLowerCase()) ||
      s.artistName.toLowerCase().includes(songFilter.toLowerCase()),
  );

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!inst) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <p className="text-center text-muted-foreground py-8">
          {t("admin.installations.notFound")}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/installations">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">{inst.name}</h1>
      </div>

      {/* Name Edit */}
      <Card>
        <CardHeader>
          <CardTitle>{t("admin.installations.editName")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder={t("admin.installations.namePlaceholder")}
            />
            <Button
              onClick={handleSaveName}
              disabled={
                isSavingName ||
                !editName.trim() ||
                editName.trim() === inst.name
              }
            >
              <Save className="h-4 w-4 mr-2" />
              {t("admin.installations.save")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Songs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              {t("admin.installations.songs")} ({songs.length})
            </CardTitle>
            <div className="flex gap-2">
              {/* Add Song Dialog */}
              <Dialog
                open={addDialogOpen}
                onOpenChange={(open) => {
                  setAddDialogOpen(open);
                  if (!open) {
                    setSearchQuery("");
                    setDebouncedSearchQuery("");
                    setSearchResults([]);
                    setSearchNextCursor(null);
                    setSearchHasMore(false);
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    {t("admin.installations.addSong")}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>
                      {t("admin.installations.addSong")}
                    </DialogTitle>
                    <DialogDescription>
                      {t("admin.installations.addSongDescription")}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder={t("admin.installations.searchSongs")}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <div
                    ref={searchScrollRef}
                    className="max-h-80 overflow-y-auto space-y-1"
                  >
                    {isSearching ? (
                      <div className="space-y-2">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <div key={`skeleton-${i}`} className="flex items-center gap-3 p-2">
                            <Skeleton className="h-10 w-10 rounded shrink-0" />
                            <div className="flex-1 min-w-0">
                              <Skeleton className="h-4 w-32 mb-1" />
                              <Skeleton className="h-3 w-24" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : searchResults.length > 0 ? (
                      <>
                        {searchResults.map((result) => {
                          const alreadyAdded = songs.some(
                            (s) => s.songId === result.id,
                          );
                          return (
                            <button
                              key={result.id}
                              onClick={() =>
                                result.id && handleAddSong(result.id)
                              }
                              disabled={
                                !result.id ||
                                addingSongId === result.id ||
                                alreadyAdded
                              }
                              className="flex items-center gap-3 w-full p-2 rounded hover:bg-muted text-left disabled:opacity-50"
                            >
                              <div className="relative h-10 w-10 rounded shrink-0">
                                {result.coverUrl ? (
                                  <>
                                    <Image
                                      src={result.coverUrl}
                                      alt={result.name}
                                      className="h-10 w-10 rounded object-cover bg-muted opacity-0 transition-opacity duration-300"
                                      width={40}
                                      height={40}
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        const parent = target.parentElement;
                                        if (parent) {
                                          const skeleton =
                                            parent.querySelector(
                                              ".loading-skeleton",
                                            );
                                          const fallback =
                                            parent.querySelector(
                                              ".error-fallback",
                                            );
                                          if (skeleton)
                                            (
                                              skeleton as HTMLElement
                                            ).style.display = "none";
                                          if (fallback)
                                            (
                                              fallback as HTMLElement
                                            ).style.display = "flex";
                                        }
                                      }}
                                      onLoad={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        const parent = target.parentElement;
                                        if (parent) {
                                          const skeleton =
                                            parent.querySelector(
                                              ".loading-skeleton",
                                            );
                                          const fallback =
                                            parent.querySelector(
                                              ".error-fallback",
                                            );
                                          if (skeleton)
                                            (
                                              skeleton as HTMLElement
                                            ).style.display = "none";
                                          if (fallback)
                                            (
                                              fallback as HTMLElement
                                            ).style.display = "none";
                                        }
                                        target.style.opacity = "1";
                                      }}
                                    />
                                    <div className="loading-skeleton absolute inset-0 h-10 w-10 rounded">
                                      <Skeleton className="h-full w-full rounded" />
                                    </div>
                                    <div
                                      className="error-fallback absolute inset-0 h-10 w-10 rounded bg-muted flex items-center justify-center"
                                      style={{ display: "none" }}
                                    >
                                      <Music className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                  </>
                                ) : (
                                  <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                                    <Music className="h-5 w-5 text-muted-foreground" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">
                                  {result.name}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {result.artist}
                                </p>
                              </div>
                              {alreadyAdded ? (
                                <Badge
                                  variant="secondary"
                                  className="text-xs shrink-0"
                                >
                                  {t("admin.installations.alreadyAdded")}
                                </Badge>
                              ) : (
                                <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
                              )}
                            </button>
                          );
                        })}
                        {/* Infinite scroll trigger */}
                        <div ref={searchLoadMoreRef} className="h-1" />
                        {isLoadingMoreSearch && (
                          <div className="flex justify-center py-2">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current" />
                          </div>
                        )}
                      </>
                    ) : debouncedSearchQuery && !isSearching ? (
                      <p className="text-center text-muted-foreground text-sm py-4">
                        {t("admin.installations.noSearchResults")}
                      </p>
                    ) : null}
                  </div>
                </DialogContent>
              </Dialog>

              {/* Import from List Dialog */}
              <Dialog
                open={importDialogOpen}
                onOpenChange={setImportDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleOpenImportDialog}
                  >
                    <Import className="h-4 w-4 mr-2" />
                    {t("admin.installations.importFromList")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {t("admin.installations.importFromList")}
                    </DialogTitle>
                    <DialogDescription>
                      {t("admin.installations.importFromListDescription")}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="max-h-80 overflow-y-auto space-y-1">
                    {isLoadingLists ? (
                      <div className="space-y-2">
                        {[1, 2, 3].map((i) => (
                          <Skeleton key={`skeleton-${i}`} className="h-12 w-full" />
                        ))}
                      </div>
                    ) : lists.length === 0 ? (
                      <p className="text-center text-muted-foreground text-sm py-4">
                        {t("admin.installations.noLists")}
                      </p>
                    ) : (
                      lists.map((list) => (
                        <button
                          key={list.id}
                          onClick={() => handleImportFromList(list.id)}
                          disabled={importingListId === list.id}
                          className="flex items-center justify-between w-full p-3 rounded hover:bg-muted text-left disabled:opacity-50"
                        >
                          <div>
                            <p className="font-medium text-sm">
                              {list.name}
                              {list.isFavorites && (
                                <Badge
                                  variant="outline"
                                  className="ml-2 text-xs"
                                >
                                  Favorites
                                </Badge>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {list.ownerDisplayName}
                            </p>
                          </div>
                          <Badge
                            variant="secondary"
                            className="flex items-center gap-1"
                          >
                            <Music className="h-3 w-3" />
                            {list.itemCount}
                          </Badge>
                        </button>
                      ))
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {songs.length > 0 && (
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t("admin.installations.filterSongs")}
                  value={songFilter}
                  onChange={(e) => setSongFilter(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          )}

          {songs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {t("admin.installations.noSongs")}
            </p>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.installations.songTitle")}</TableHead>
                    <TableHead>{t("admin.installations.artist")}</TableHead>
                    <TableHead className="text-right">
                      {t("admin.actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSongs.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.title}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {s.artistName}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveSong(s.songId)}
                        >
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Installation */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">
            {t("admin.installations.dangerZone")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                {t("admin.installations.deleteInstallation")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {t("admin.installations.deleteConfirm")}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {t("admin.installations.deleteWarning", {
                    name: inst.name,
                  })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("admin.cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteInstallation}
                  className="bg-destructive hover:bg-destructive/90"
                >
                  {t("admin.installations.deleteInstallation")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminInstallationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <ProtectedRoute requiredRole="admin">
      <InstallationDetailContent params={params} />
    </ProtectedRoute>
  );
}
