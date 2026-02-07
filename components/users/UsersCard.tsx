"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/components/ui/avatar";
import { Users, Search } from "lucide-react";
import { useTranslations } from "@/hooks/use-translations";
import Link from "next/link";

interface PublicUser {
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
}

export default function UsersCard() {
  const { t, locale } = useTranslations();
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const isMounted = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const fetchUsers = useCallback(async (searchQuery: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "20" });
      if (searchQuery) params.set("q", searchQuery);

      const response = await fetch(`/api/users?${params}`);
      if (response.ok && isMounted.current) {
        const result = await response.json();
        setUsers(result.users);
        setTotal(result.total);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    fetchUsers(debouncedQuery);
    return () => {
      isMounted.current = false;
    };
  }, [debouncedQuery, fetchUsers]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Users className="h-4 w-4" />
          {t("community.title")}
          {total > 0 && (
            <span className="text-xs font-normal text-muted-foreground">
              ({total})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder={t("community.searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>

        <div className="max-h-[300px] overflow-y-auto space-y-1">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2 p-2">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-2.5 w-16" />
                </div>
              </div>
            ))
          ) : users.length === 0 ? (
            <div className="py-4 text-center text-xs text-muted-foreground">
              {t("community.noUsersFound")}
            </div>
          ) : (
            users.map((user) => (
              <Link
                key={user.displayName}
                href={`/u/${user.displayName}`}
                className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors"
              >
                <Avatar size="default">
                  {user.avatarUrl ? (
                    <AvatarImage src={user.avatarUrl} alt={user.displayName} />
                  ) : null}
                  <AvatarFallback>
                    {user.displayName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {user.displayName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("community.joined", {
                      date: new Date(user.createdAt).toLocaleDateString(
                        locale,
                        {
                          month: "short",
                          year: "numeric",
                        },
                      ),
                    })}
                  </p>
                </div>
              </Link>
            ))
          )}
        </div>

      </CardContent>
    </Card>
  );
}
