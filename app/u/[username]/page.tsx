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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Music, Calendar, Globe } from "lucide-react";
import Link from "next/link";

interface PublicProfile {
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
  lists: {
    id: string;
    name: string;
    slug: string;
    songCount: number;
  }[];
}

export default function PublicProfilePage() {
  const { t } = useTranslations();
  const params = useParams();
  const username = params.username as string;

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const response = await fetch(`/api/users/${username}`);
        if (!response.ok) {
          if (response.status === 404) {
            setError("notFound");
          } else {
            setError("generic");
          }
          return;
        }
        const data = await response.json();
        console.log(data);
        setProfile(data);
      } catch {
        setError("generic");
      } finally {
        setIsLoading(false);
      }
    }

    fetchProfile();
  }, [username]);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader className="flex flex-row items-center gap-4">
            <Skeleton className="h-20 w-20 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            <CardTitle>{t("profile.notFound")}</CardTitle>
            <CardDescription>
              {t("profile.notFoundDescription")}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <Avatar className="h-20 w-20">
            <AvatarImage
              src={profile.avatarUrl || undefined}
              alt={profile.displayName}
            />
            <AvatarFallback className="text-2xl">
              {profile.displayName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <CardTitle className="text-2xl">{profile.displayName}</CardTitle>
            <CardDescription className="flex items-center gap-2 mt-1">
              <Calendar className="h-4 w-4" />
              {t("profile.memberSince")}{" "}
              {new Date(profile.createdAt).toLocaleDateString()}
            </CardDescription>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            {t("profile.publicLists")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {profile.lists.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              {t("profile.noPublicLists")}
            </p>
          ) : (
            <div className="grid gap-3">
              {profile.lists.map((list) => (
                <Link
                  key={list.id}
                  href={`/u/${username}/lists/${list.slug}`}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Music className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">{list.name}</span>
                  </div>
                  <Badge variant="secondary">
                    {list.songCount}{" "}
                    {list.songCount === 1 ? t("lists.song") : t("lists.songs")}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
