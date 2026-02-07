"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useTranslations } from "@/hooks/use-translations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Monitor, Smartphone, Trash2, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface Device {
  id: string;
  fingerprint: string;
  browser: string | null;
  os: string | null;
  lastUsedAt: string;
  createdAt: string;
}

function DevicesContent() {
  const { t } = useTranslations();
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const fetchDevices = async () => {
    try {
      const response = await fetch("/api/users/me/devices");
      if (response.ok) {
        const data = await response.json();
        setDevices(data);
      }
    } catch (error) {
      toast.error(t("profile.devicesError"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const handleRevokeDevice = async (deviceId: string) => {
    setRevokingId(deviceId);

    try {
      const response = await fetch(`/api/users/me/devices/${deviceId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success(t("profile.deviceRevoked"));
        setDevices(devices.filter((d) => d.id !== deviceId));
      } else {
        toast.error(t("profile.deviceRevokeError"));
      }
    } catch (error) {
      toast.error(t("profile.deviceRevokeError"));
    } finally {
      setRevokingId(null);
    }
  };

  const getDeviceIcon = (os: string | null) => {
    if (os?.toLowerCase().includes("mobile") || os?.toLowerCase().includes("android") || os?.toLowerCase().includes("ios")) {
      return <Smartphone className="h-5 w-5" />;
    }
    return <Monitor className="h-5 w-5" />;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/settings">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{t("profile.trustedDevices")}</h1>
          <p className="text-muted-foreground">{t("profile.trustedDevicesDescription")}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("profile.yourDevices")}</CardTitle>
          <CardDescription>{t("profile.yourDevicesDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <Skeleton className="h-8 w-8" />
                </div>
              ))}
            </div>
          ) : devices.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {t("profile.noDevices")}
            </p>
          ) : (
            <div className="space-y-4">
              {devices.map((device) => (
                <div
                  key={device.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center h-10 w-10 rounded-full bg-muted">
                      {getDeviceIcon(device.os)}
                    </div>
                    <div>
                      <p className="font-medium">
                        {device.browser || t("profile.unknownBrowser")}
                        {device.os && ` on ${device.os}`}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t("profile.lastUsed")}: {formatDate(device.lastUsedAt)}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRevokeDevice(device.id)}
                    disabled={revokingId === device.id}
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

export default function DevicesPage() {
  return (
    <ProtectedRoute>
      <DevicesContent />
    </ProtectedRoute>
  );
}
