"use client";

import { useState, useEffect, useCallback } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslations } from "@/hooks/use-translations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Search, ArrowLeft, Trash2, Shield, User, UserCog } from "lucide-react";
import type { Role } from "@/lib/db/schema";
import Link from "next/link";

interface UserData {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
  createdAt: string;
  profile: {
    displayName: string;
    avatarUrl: string | null;
    role: Role;
  };
}

const ROLE_ICONS: Record<Role, typeof User> = {
  user: User,
  moderator: UserCog,
  admin: Shield,
};

const ROLE_COLORS: Record<Role, "default" | "secondary" | "outline"> = {
  user: "secondary",
  moderator: "outline",
  admin: "default",
};

function AdminUsersContent() {
  const { t } = useTranslations();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const limit = 20;

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(page * limit),
      });
      if (searchQuery) {
        params.set("q", searchQuery);
      }

      const response = await fetch(`/api/admin/users?${params}`);
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users);
        setTotal(data.total);
      } else {
        toast.error(t("admin.fetchUsersError"));
      }
    } catch {
      toast.error(t("admin.fetchUsersError"));
    } finally {
      setIsLoading(false);
    }
  }, [page, searchQuery, limit, t]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    fetchUsers();
  };

  const handleRoleChange = async (userId: string, newRole: Role) => {
    setUpdatingId(userId);
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      if (response.ok) {
        setUsers(
          users.map((u) =>
            u.id === userId
              ? { ...u, profile: { ...u.profile, role: newRole } }
              : u,
          ),
        );
        toast.success(t("admin.roleUpdated"));
      } else {
        const data = await response.json();
        toast.error(data.error || t("admin.roleUpdateError"));
      }
    } catch {
      toast.error(t("admin.roleUpdateError"));
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    setDeletingId(userId);
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setUsers(users.filter((u) => u.id !== userId));
        setTotal(prev => prev - 1);
        toast.success(t("admin.userDeleted"));
      } else {
        const data = await response.json();
        toast.error(data.error || t("admin.userDeleteError"));
      }
    } catch {
      toast.error(t("admin.userDeleteError"));
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

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{t("admin.userManagement")}</h1>
          <p className="text-muted-foreground">
            {t("admin.totalUsers", { count: total })}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("admin.searchUsers")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button type="submit">{t("admin.search")}</Button>
          </form>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={`skeleton-${i}`} className="h-16 w-full" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {t("admin.noUsersFound")}
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.user")}</TableHead>
                    <TableHead>{t("admin.email")}</TableHead>
                    <TableHead>{t("admin.role")}</TableHead>
                    <TableHead>{t("admin.joined")}</TableHead>
                    <TableHead className="text-right">
                      {t("admin.actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => {
                    const RoleIcon = ROLE_ICONS[user.profile.role];
                    const RoleColor = ROLE_COLORS[user.profile.role];
                    const isCurrentUser = user.id === currentUser?.id;

                    return (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage
                                src={user.profile.avatarUrl || undefined}
                                alt={user.profile.displayName}
                              />
                              <AvatarFallback className="text-2xl">
                                {user.profile.displayName
                                  .charAt(0)
                                  .toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">
                                {user.profile.displayName}
                              </p>
                              {user.name && (
                                <p className="text-sm text-muted-foreground">
                                  {user.name}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {user.email}
                            {user.emailVerified && (
                              <Badge variant="outline" className="text-xs">
                                {t("admin.verified")}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant={RoleColor} className="flex items-center gap-1">
                              <RoleIcon className="h-3 w-3" />
                              {user.profile.role}
                            </Badge>
                            <Select
                              value={user.profile.role}
                              onValueChange={(value: Role) =>
                                handleRoleChange(user.id, value)
                              }
                              disabled={isCurrentUser || updatingId === user.id}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue>
                                  <div className="flex items-center gap-2">
                                    <RoleIcon className="h-4 w-4" />
                                    {user.profile.role}
                                  </div>
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="user">
                                  <div className="flex items-center gap-2">
                                    <User className="h-4 w-4" />
                                    user
                                  </div>
                                </SelectItem>
                                <SelectItem value="moderator">
                                  <div className="flex items-center gap-2">
                                    <UserCog className="h-4 w-4" />
                                    moderator
                                  </div>
                                </SelectItem>
                                <SelectItem value="admin">
                                  <div className="flex items-center gap-2">
                                    <Shield className="h-4 w-4" />
                                    admin
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(user.createdAt)}</TableCell>
                        <TableCell className="text-right">
                          {!isCurrentUser && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  disabled={deletingId === user.id}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    {t("admin.deleteUserConfirm")}
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {t("admin.deleteUserWarning", {
                                      name: user.profile.displayName,
                                    })}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>
                                    {t("admin.cancel")}
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteUser(user.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    {t("admin.confirmDelete")}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-sm text-muted-foreground">
                    {t("admin.showing", {
                      from: page * limit + 1,
                      to: Math.min((page + 1) * limit, total),
                      total,
                    })}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(prev => prev - 1)}
                      disabled={page === 0}
                    >
                      {t("admin.previous")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(prev => prev + 1)}
                      disabled={page >= totalPages - 1}
                    >
                      {t("admin.next")}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <ProtectedRoute requiredRole="admin">
      <AdminUsersContent />
    </ProtectedRoute>
  );
}
