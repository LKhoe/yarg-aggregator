"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useTranslations } from "@/hooks/use-translations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft,
  Heart,
  Trash2,
  Globe,
  Lock,
  Download,
  Music,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import Link from "next/link";
import Image from "next/image";

interface ListItem {
  id: string;
  addedAt: string;
  song: {
    id: string;
    title: string;
    artist: string;
    album: string | null;
    albumImageUrl: string | null;
    downloadUrls: { url: string; source: string }[];
  };
}

interface SongList {
  id: string;
  name: string;
  slug: string;
  isFavorites: boolean;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  items: ListItem[];
}

interface Installation {
  id: string;
  name: string;
}

function ListDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useTranslations();
  const router = useRouter();
  const [list, setList] = useState<SongList | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPublic, setEditPublic] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);

  // Installation state
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [selectedInstallationId, setSelectedInstallationId] = useState("");
  const [installedSongIds, setInstalledSongIds] = useState<Set<string>>(new Set());
  const [checkingInstalled, setCheckingInstalled] = useState(false);

  const fetchList = useCallback(async () => {
    try {
      const response = await fetch(`/api/lists/${id}`);
      if (response.ok) {
        const data = await response.json();
        setList(data);
        setEditName(data.name);
        setEditPublic(data.isPublic);
      } else if (response.status === 404) {
        toast.error(t("lists.notFound"));
        router.push("/lists");
      }
    } catch {
      toast.error(t("lists.fetchError"));
    } finally {
      setIsLoading(false);
    }
  }, [id, t, router]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // Fetch installations on mount
  useEffect(() => {
    fetch("/api/installations")
      .then((r) => r.json())
      .then((data) => setInstallations(data.installations ?? []))
      .catch(() => {});
  }, []);

  const handleInstallationChange = async (value: string) => {
    const instId = value === "none" ? "" : value;
    setSelectedInstallationId(instId);

    if (!instId) {
      setInstalledSongIds(new Set());
      return;
    }

    setCheckingInstalled(true);
    try {
      const res = await fetch(
        `/api/lists/${id}/installed?installationId=${instId}`,
      );
      if (res.ok) {
        const data = await res.json();
        setInstalledSongIds(new Set(data.installedSongIds));
      }
    } catch {
      // silently fail
    } finally {
      setCheckingInstalled(false);
    }
  };

  const handleSave = async () => {
    if (!list) return;
    setIsSaving(true);

    try {
      const response = await fetch(`/api/lists/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          isPublic: editPublic,
        }),
      });

      if (response.ok) {
        const updated = await response.json();
        setList({ ...list, ...updated });
        toast.success(t("lists.updateSuccess"));
      } else {
        toast.error(t("lists.updateError"));
      }
    } catch {
      toast.error(t("lists.updateError"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/lists/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success(t("lists.deleteSuccess"));
        router.push("/lists");
      } else {
        toast.error(t("lists.deleteError"));
      }
    } catch {
      toast.error(t("lists.deleteError"));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRemoveSong = async (songId: string) => {
    if (!list) return;

    try {
      const response = await fetch(`/api/lists/${id}/songs/${songId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setList({
          ...list,
          items: list.items.filter((item) => item.song.id !== songId),
        });
        toast.success(t("lists.songRemoved"));
      } else {
        toast.error(t("lists.songRemoveError"));
      }
    } catch {
      toast.error(t("lists.songRemoveError"));
    }
  };

  // Songs that have at least one download link
  const downloadableItems = list
    ? list.items.filter((item) => item.song.downloadUrls.length > 0)
    : [];

  // Songs with a download link that are not installed (or no installation selected)
  const uninstalledDownloadableItems = downloadableItems.filter(
    (item) => !installedSongIds.has(item.song.id),
  );

  const hasInstallation = !!selectedInstallationId;
  const hasInstalledWithDownload = downloadableItems.some((item) =>
    installedSongIds.has(item.song.id),
  );

  const openDownloads = async (items: typeof downloadableItems) => {
    if (items.length === 0) return;
    setIsDownloading(true);

    const urls = items.map((item) => item.song.downloadUrls[0].url);
    const firstWindow = window.open(urls[0], "_blank");
    if (!firstWindow) {
      toast.error(t("lists.downloadAllBlocked"));
      setIsDownloading(false);
      return;
    }

    for (let i = 1; i < urls.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      window.open(urls[i], "_blank");
    }

    setIsDownloading(false);
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!list) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/lists">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          {list.isFavorites && (
            <Heart className="h-5 w-5 text-red-500 fill-red-500" />
          )}
          <h1 className="text-2xl font-bold">{list.name}</h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("lists.listSettings")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="listName">{t("lists.listName")}</Label>
            <Input
              id="listName"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              disabled={list.isFavorites || isSaving}
              minLength={1}
              maxLength={50}
            />
            {list.isFavorites && (
              <p className="text-xs text-muted-foreground">
                {t("lists.favoritesCannotRename")}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t("lists.visibility")}</Label>
              <p className="text-sm text-muted-foreground">
                {editPublic
                  ? t("lists.publicDescription")
                  : t("lists.privateDescription")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {editPublic ? (
                <Globe className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Lock className="h-4 w-4 text-muted-foreground" />
              )}
              <Switch
                checked={editPublic}
                onCheckedChange={setEditPublic}
                disabled={isSaving}
              />
            </div>
          </div>

          <div className="flex justify-between pt-4">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? t("lists.saving") : t("lists.save")}
            </Button>

            {!list.isFavorites && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t("lists.delete")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {t("lists.deleteConfirm")}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("lists.deleteWarning")}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("lists.cancel")}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={isDeleting}
                    >
                      {isDeleting
                        ? t("lists.deleting")
                        : t("lists.confirmDelete")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>
              {t("lists.songs")} ({list.items.length})
            </CardTitle>

            <div className="flex flex-wrap items-center gap-2">
              {/* Installation selector */}
              <div className="flex items-center gap-2">
                <Select
                  value={selectedInstallationId || "none"}
                  onValueChange={handleInstallationChange}
                >
                  <SelectTrigger className="w-48 h-8 text-sm">
                    <SelectValue placeholder={t("lists.selectInstallation")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      {t("lists.selectInstallation")}
                    </SelectItem>
                    {installations.map((inst) => (
                      <SelectItem key={inst.id} value={inst.id}>
                        {inst.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {checkingInstalled && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>

              {/* Download uninstalled only (shown when installation selected and some songs are installed) */}
              {hasInstallation && hasInstalledWithDownload && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isDownloading || uninstalledDownloadableItems.length === 0}
                  onClick={() => openDownloads(uninstalledDownloadableItems)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  {t("lists.downloadUninstalled")}
                </Button>
              )}

              {/* Download All */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    disabled={downloadableItems.length === 0 || isDownloading}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {isDownloading ? t("lists.downloading") : t("lists.downloadAll")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {t("lists.downloadAllConfirm")}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("lists.downloadAllDescription").replace(
                        "{count}",
                        String(downloadableItems.length),
                      )}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("lists.cancel")}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => openDownloads(downloadableItems)}
                    >
                      {t("lists.confirm")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {list.items.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {t("lists.noSongs")}
            </p>
          ) : (
            <div className="space-y-2">
              {list.items.map((item) => {
                const hasDownload = item.song.downloadUrls.length > 0;
                const isInstalled = installedSongIds.has(item.song.id);

                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative h-10 w-10 shrink-0">
                        {item.song.albumImageUrl ? (
                          <>
                            <Image
                              src={item.song.albumImageUrl}
                              alt={item.song.title}
                              className="h-10 w-10 rounded object-cover bg-muted opacity-0 transition-opacity duration-300"
                              width={40}
                              height={40}
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                const parent = target.parentElement;
                                if (parent) {
                                  const skeleton = parent.querySelector(".loading-skeleton");
                                  const fallback = parent.querySelector(".error-fallback");
                                  if (skeleton) (skeleton as HTMLElement).style.display = "none";
                                  if (fallback) (fallback as HTMLElement).style.display = "flex";
                                }
                              }}
                              onLoad={(e) => {
                                const target = e.target as HTMLImageElement;
                                const parent = target.parentElement;
                                if (parent) {
                                  const skeleton = parent.querySelector(".loading-skeleton");
                                  const fallback = parent.querySelector(".error-fallback");
                                  if (skeleton) (skeleton as HTMLElement).style.display = "none";
                                  if (fallback) (fallback as HTMLElement).style.display = "none";
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
                      <div className="min-w-0">
                        <p className="font-medium truncate">{item.song.title}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {item.song.artist}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {hasInstallation && isInstalled && (
                        <span title={t("lists.installed")}>
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        </span>
                      )}
                      {!hasDownload && (
                        <Badge
                          variant="outline"
                          className="text-xs text-muted-foreground gap-1"
                        >
                          <AlertCircle className="h-3 w-3" />
                          {t("lists.noDownloadLink")}
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveSong(item.song.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <ProtectedRoute>
      <ListDetailContent params={params} />
    </ProtectedRoute>
  );
}
