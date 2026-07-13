"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useTranslations } from "@/hooks/use-translations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
import { toast } from "sonner";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

function SettingsContent() {
  const { t } = useTranslations();
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState(user?.profile.displayName || "");
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName }),
      });

      if (response.ok) {
        toast.success(t("profile.updateSuccess"));
        await refreshUser();
      } else {
        const data = await response.json();
        toast.error(data.error || t("profile.updateError"));
      }
    } catch (error) {
      toast.error(t("profile.updateError"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async (e: React.MouseEvent) => {
    // Keep the dialog open ourselves so we can show a password prompt on failure.
    e.preventDefault();
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch("/api/users/me", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(needsPassword ? { password: deletePassword } : {}),
      });

      if (response.ok) {
        toast.success(t("profile.deleteSuccess"));
        router.push("/");
        router.refresh();
        return;
      }

      const data = await response.json().catch(() => ({}));
      if (data.code === "SESSION_EXPIRED") {
        setNeedsPassword(true);
      } else if (data.code === "INVALID_PASSWORD") {
        setNeedsPassword(true);
        setDeleteError(t("profile.deleteAccountIncorrectPassword"));
      } else if (data.code === "CREDENTIAL_ACCOUNT_NOT_FOUND") {
        setDeleteError(t("profile.deleteAccountReauthRequired"));
      } else {
        toast.error(t("profile.deleteError"));
      }
    } catch (error) {
      toast.error(t("profile.deleteError"));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{t("profile.settings")}</h1>
          <p className="text-muted-foreground">{t("profile.settingsDescription")}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("profile.profileInfo")}</CardTitle>
          <CardDescription>{t("profile.profileInfoDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("profile.email")}</Label>
              <Input
                id="email"
                type="email"
                value={user?.email || ""}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                {t("profile.emailCannotChange")}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayName">{t("profile.displayName")}</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={isLoading}
                minLength={2}
                maxLength={30}
              />
              <p className="text-xs text-muted-foreground">
                {t("profile.displayNameDescription")}
              </p>
            </div>

            <Button type="submit" disabled={isLoading}>
              {isLoading ? t("profile.saving") : t("profile.save")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("profile.devices")}</CardTitle>
          <CardDescription>{t("profile.devicesDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <Link href="/settings/devices">{t("profile.manageDevices")}</Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">{t("profile.dangerZone")}</CardTitle>
          <CardDescription>{t("profile.dangerZoneDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">{t("profile.deleteAccount")}</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("profile.deleteAccountConfirm")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("profile.deleteAccountWarning")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              {needsPassword && (
                <div className="space-y-2">
                  <Label htmlFor="delete-password">
                    {t("profile.deleteAccountPasswordLabel")}
                  </Label>
                  <Input
                    id="delete-password"
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    autoFocus
                  />
                </div>
              )}
              {deleteError && (
                <p className="text-sm text-destructive">{deleteError}</p>
              )}
              <AlertDialogFooter>
                <AlertDialogCancel>{t("profile.cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={isDeleting || (needsPassword && !deletePassword)}
                >
                  {isDeleting ? t("profile.deleting") : t("profile.confirmDelete")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <ProtectedRoute>
      <SettingsContent />
    </ProtectedRoute>
  );
}
