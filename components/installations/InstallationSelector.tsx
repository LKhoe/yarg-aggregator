"use client";

import React, {
  useState,
  useEffect,
  createContext,
  useContext,
  useCallback,
} from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HardDrive } from "lucide-react";
import { useTranslations } from "@/hooks/use-translations";

// Type definition for Installation (client-safe)
interface Installation {
  id: string;
  name: string;
  path: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Context for sharing selected installation across components
interface InstallationContextValue {
  selectedInstallationId: string | null;
  setSelectedInstallationId: (id: string | null) => void;
  installations: Installation[];
  refreshInstallations: () => Promise<void>;
  loading: boolean;
}

const InstallationContext = createContext<InstallationContextValue | null>(
  null,
);

export function useInstallation() {
  const context = useContext(InstallationContext);
  if (!context) {
    throw new Error(
      "useInstallation must be used within an InstallationProvider",
    );
  }
  return context;
}

interface InstallationProviderProps {
  children: React.ReactNode;
}

export function InstallationProvider({ children }: InstallationProviderProps) {
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [selectedInstallationId, setSelectedInstallationId] = useState<
    string | null
  >(null);
  const [loading, setLoading] = useState(false);

  const refreshInstallations = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/installations");
      if (response.ok) {
        const data = await response.json();
        setInstallations(data.installations || []);
      }
    } catch (error) {
      console.error("Failed to fetch installations:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch installations on mount
  useEffect(() => {
    refreshInstallations();
  }, [refreshInstallations]);

  return (
    <InstallationContext.Provider
      value={{
        selectedInstallationId,
        setSelectedInstallationId,
        installations,
        refreshInstallations,
        loading,
      }}
    >
      {children}
    </InstallationContext.Provider>
  );
}

interface InstallationSelectorProps {
  className?: string;
  compact?: boolean;
}

export default function InstallationSelector({
  className = "",
  compact = false,
}: InstallationSelectorProps) {
  const { t } = useTranslations();
  const {
    selectedInstallationId,
    setSelectedInstallationId,
    installations,
    loading,
  } = useInstallation();

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {!compact && (
        <HardDrive className="h-4 w-4 text-muted-foreground shrink-0" />
      )}
      <Select
        value={selectedInstallationId || "none"}
        onValueChange={(v) =>
          setSelectedInstallationId(v === "none" ? null : v)
        }
        disabled={loading}
      >
        <SelectTrigger
          className={compact ? "h-9 w-45" : "flex-1 min-w-37.5 h-9"}
        >
          <SelectValue
            placeholder={
              loading
                ? t("installationSelector.loading")
                : t("installationSelector.selectPlaceholder")
            }
          />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">
            <span className="text-muted-foreground">
              {t("installationSelector.noInstallation")}
            </span>
          </SelectItem>
          {installations.map((installation) => (
            <SelectItem key={installation.id} value={installation.id}>
              <div className="flex items-center gap-2">
                <HardDrive className="h-3 w-3 text-primary" />
                <span>{installation.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
