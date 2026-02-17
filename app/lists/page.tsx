"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useTranslations } from "@/hooks/use-translations";
import { PlaylistImportDialog } from "@/components/import/PlaylistImportDialog";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Heart, List, Lock, Globe, Download } from "lucide-react";
import Link from "next/link";

interface SongList {
  id: string;
  name: string;
  slug: string;
  isFavorites: boolean;
  isPublic: boolean;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

function ListsContent() {
  const { t } = useTranslations();
  const searchParams = useSearchParams();
  const [lists, setLists] = useState<SongList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importProvider, setImportProvider] = useState<string | null>(null);

  // Handle OAuth callback redirect with ?import=provider
  useEffect(() => {
    const provider = searchParams.get("import");
    if (provider === "spotify" || provider === "google") {
      setImportProvider(provider);
      setIsImportOpen(true);
      // Clean up URL
      window.history.replaceState({}, "", "/lists");
    }
  }, [searchParams]);

  const fetchLists = useCallback(async () => {
    try {
      const response = await fetch("/api/lists");
      if (response.ok) {
        const data = await response.json();
        setLists(data);
      }
    } catch {
      toast.error(t("lists.fetchError"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      const response = await fetch("/api/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newListName }),
      });

      if (response.ok) {
        const newList = await response.json();
        setLists([...lists, { ...newList, itemCount: 0 }]);
        setNewListName("");
        setIsDialogOpen(false);
        toast.success(t("lists.createSuccess"));
      } else {
        const data = await response.json();
        toast.error(data.error || t("lists.createError"));
      }
    } catch {
      toast.error(t("lists.createError"));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("lists.myLists")}</h1>
          <p className="text-muted-foreground">
            {t("lists.myListsDescription")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsImportOpen(true)}>
            <Download className="h-4 w-4 mr-2" />
            {t("import.button")}
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                {t("lists.createList")}
              </Button>
            </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreateList}>
              <DialogHeader>
                <DialogTitle>{t("lists.createNewList")}</DialogTitle>
                <DialogDescription>
                  {t("lists.createNewListDescription")}
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-2 py-4">
                <Label htmlFor="listName">{t("lists.listName")}</Label>
                <Input
                  id="listName"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder={t("lists.listNamePlaceholder")}
                  disabled={isCreating}
                  minLength={1}
                  maxLength={50}
                  required
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  {t("lists.cancel")}
                </Button>
                <Button type="submit" disabled={isCreating}>
                  {isCreating ? t("lists.creating") : t("lists.create")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </div>
        <PlaylistImportDialog
          open={isImportOpen}
          onOpenChange={setIsImportOpen}
          initialProvider={importProvider}
        />
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : lists.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <List className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{t("lists.noLists")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {lists.map((list) => (
            <Link key={list.id} href={`/lists/${list.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {list.isFavorites ? (
                        <Heart className="h-5 w-5 text-red-500 fill-red-500" />
                      ) : (
                        <List className="h-5 w-5" />
                      )}
                      <CardTitle className="text-lg">{list.name}</CardTitle>
                    </div>
                    <Badge variant="outline">
                      {list.isPublic ? (
                        <Globe className="h-3 w-3 mr-1" />
                      ) : (
                        <Lock className="h-3 w-3 mr-1" />
                      )}
                      {list.isPublic ? t("lists.public") : t("lists.private")}
                    </Badge>
                  </div>
                  <CardDescription>
                    {list.itemCount}{" "}
                    {list.itemCount === 1 ? t("lists.song") : t("lists.songs")}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ListsPage() {
  return (
    <ProtectedRoute>
      <ListsContent />
    </ProtectedRoute>
  );
}
