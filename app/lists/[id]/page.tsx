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
  CardDescription,
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
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ArrowLeft, Heart, Trash2, Globe, Lock, Download } from "lucide-react";
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

  const allSongsHaveDownloads = list
    ? list.items.length > 0 && list.items.every((item) => item.song.downloadUrls.length > 0)
    : false;

  const downloadUrls = list
    ? list.items
        .filter((item) => item.song.downloadUrls.length > 0)
        .map((item) => item.song.downloadUrls[0].url)
    : [];

  const handleDownloadAll = async () => {
    setIsDownloading(true);

    // Test popup blocker with first URL
    const firstWindow = window.open(downloadUrls[0], "_blank");
    if (!firstWindow) {
      toast.error(t("lists.downloadAllBlocked"));
      setIsDownloading(false);
      return;
    }

    // Open remaining URLs with staggered delay
    for (let i = 1; i < downloadUrls.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      window.open(downloadUrls[i], "_blank");
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
          <CardDescription>
            {t("lists.listSettingsDescription")}
          </CardDescription>
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
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            {t("lists.songs")} ({list.items.length})
          </CardTitle>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                disabled={!allSongsHaveDownloads || isDownloading}
                title={!allSongsHaveDownloads ? t("lists.downloadAllNoLinks") : undefined}
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
                  {t("lists.downloadAllDescription").replace("{count}", String(downloadUrls.length))}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("lists.cancel")}</AlertDialogCancel>
                <AlertDialogAction onClick={handleDownloadAll}>
                  {t("lists.confirm")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardHeader>
        <CardContent>
          {list.items.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {t("lists.noSongs")}
            </p>
          ) : (
            <div className="space-y-2">
              {list.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {item.song.albumImageUrl && (
                      <Image
                        src={item.song.albumImageUrl}
                        alt={item.song.title}
                        className="h-10 w-10 rounded object-cover"
                        width={40}
                        height={40}
                      />
                    )}
                    <div>
                      <p className="font-medium">{item.song.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.song.artist}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveSong(item.song.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
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
