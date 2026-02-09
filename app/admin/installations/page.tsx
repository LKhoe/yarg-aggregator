"use client";

import { useState, useEffect, useCallback } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useTranslations } from "@/hooks/use-translations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { ArrowLeft, Trash2, HardDrive, Music } from "lucide-react";
import Link from "next/link";

interface InstallationData {
  id: string;
  name: string;
  path: string | null;
  createdAt: string;
  songCount: number;
}

function InstallationsContent() {
  const { t } = useTranslations();
  const [installations, setInstallations] = useState<InstallationData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchInstallations = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/installations");
      if (response.ok) {
        const data = await response.json();
        setInstallations(data.installations);
      } else {
        toast.error(t("admin.installations.fetchError"));
      }
    } catch {
      toast.error(t("admin.installations.fetchError"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchInstallations();
  }, [fetchInstallations]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const response = await fetch(`/api/admin/installations/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setInstallations(installations.filter((i) => i.id !== id));
        toast.success(t("admin.installations.deleted"));
      } else {
        toast.error(t("admin.installations.deleteError"));
      }
    } catch {
      toast.error(t("admin.installations.deleteError"));
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">
            {t("admin.installations.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("admin.installations.totalInstallations", {
              count: installations.length,
            })}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader />
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : installations.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {t("admin.installations.noInstallations")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.installations.name")}</TableHead>
                  <TableHead>{t("admin.installations.songs")}</TableHead>
                  <TableHead>{t("admin.installations.created")}</TableHead>
                  <TableHead className="text-right">
                    {t("admin.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {installations.map((inst) => (
                  <TableRow key={inst.id}>
                    <TableCell>
                      <Link
                        href={`/admin/installations/${inst.id}`}
                        className="flex items-center gap-3 hover:underline"
                      >
                        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10">
                          <HardDrive className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{inst.name}</p>
                          {inst.path && (
                            <p className="text-sm text-muted-foreground truncate max-w-xs">
                              {inst.path}
                            </p>
                          )}
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                        <Music className="h-3 w-3" />
                        {inst.songCount}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(inst.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={deletingId === inst.id}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
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
                            <AlertDialogCancel>
                              {t("admin.cancel")}
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(inst.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {t("admin.confirmDelete")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminInstallationsPage() {
  return (
    <ProtectedRoute requiredRole="admin">
      <InstallationsContent />
    </ProtectedRoute>
  );
}
