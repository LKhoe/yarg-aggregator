"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "@/hooks/use-translations";
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Music, ArrowLeft, User, Download } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

interface PublicList {
  id: string;
  name: string;
  slug: string;
  owner: {
    displayName: string;
    avatarUrl: string | null;
  };
  songs: {
    id: string;
    name: string;
    artist: string;
    album: string | null;
    albumImageUrl: string | null;
    addedAt: string;
    downloadUrls: { url: string; source: string }[];
  }[];
}

export default function PublicListPage() {
  const { t } = useTranslations();
  const params = useParams();
  const username = params.username as string;
  const slug = params.slug as string;

  const [list, setList] = useState<PublicList | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    async function fetchList() {
      try {
        const response = await fetch(
          `/api/users/${username}/lists?slug=${slug}`,
        );
        if (!response.ok) {
          if (response.status === 404) {
            setError("notFound");
          } else {
            setError("generic");
          }
          return;
        }
        const data = await response.json();
        setList(data);
      } catch {
        setError("generic");
      } finally {
        setIsLoading(false);
      }
    }

    fetchList();
  }, [username, slug]);

  const allSongsHaveDownloads = list
    ? list.songs.length > 0 && list.songs.every((song) => song.downloadUrls.length > 0)
    : false;

  const downloadUrls = list
    ? list.songs
      .filter((song) => song.downloadUrls.length > 0)
      .map((song) => song.downloadUrls[0].url)
    : [];

  const handleDownloadAll = async () => {
    setIsDownloading(true);

    const firstWindow = window.open(downloadUrls[0], "_blank");
    if (!firstWindow) {
      toast.error(t("lists.downloadAllBlocked"));
      setIsDownloading(false);
      return;
    }

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
            <Skeleton className="h-4 w-32 mt-2" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !list) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardHeader className="text-center">
            <CardTitle>{t("lists.notFound")}</CardTitle>
            <CardDescription>{t("lists.notFoundDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button variant="outline" asChild>
              <Link href={`/u/${username}`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("profile.backToProfile")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/u/${username}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("profile.backToProfile")}
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">{list.name}</CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                <User className="h-4 w-4" />
                {t("lists.by")}{" "}
                <Link href={`/u/${username}`} className="hover:underline">
                  {list.owner.displayName}
                </Link>
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-lg px-3 py-1">
                {list.songs.length}{" "}
                {list.songs.length === 1 ? t("lists.song") : t("lists.songs")}
              </Badge>
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
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {list.songs.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              {t("lists.noSongs")}
            </p>
          ) : (
            <div className="space-y-2">
              {list.songs.map((song) => (
                <div
                  key={song.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative h-10 w-10 shrink-0">
                      {song.albumImageUrl ? (
                        <>
                          <Image
                            src={song.albumImageUrl}
                            alt={song.name}
                            className="h-10 w-10 rounded object-cover bg-muted opacity-0 transition-opacity duration-300"
                            width={40}
                            height={40}
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
                    <div>
                      <p className="font-medium">{song.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {song.artist}
                        {song.album && ` • ${song.album}`}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
