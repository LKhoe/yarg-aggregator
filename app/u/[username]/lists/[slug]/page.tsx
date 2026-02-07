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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Music, ArrowLeft, User } from "lucide-react";
import Link from "next/link";

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
    addedAt: string;
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

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
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
      <div className="max-w-4xl mx-auto">
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
            <Badge variant="secondary" className="text-lg px-3 py-1">
              {list.songs.length}{" "}
              {list.songs.length === 1 ? t("lists.song") : t("lists.songs")}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {list.songs.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              {t("lists.noSongs")}
            </p>
          ) : (
            <div className="divide-y">
              {list.songs.map((song) => (
                <div key={song.id} className="flex items-center gap-4 py-3">
                  <Music className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{song.name}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {song.artist}
                      {song.album && ` • ${song.album}`}
                    </p>
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
