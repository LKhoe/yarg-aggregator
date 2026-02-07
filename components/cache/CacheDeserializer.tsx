"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  FileText,
  Music,
  AlertCircle,
  CheckCircle,
  Database,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { SongEntry } from "@/services/cache-reader/Song/Entries/SongEntry";
import deserializeCache from "@/services/cache-reader/deserializer";
import {
  serializeSongEntry,
  type SerializedSongEntry,
} from "@/services/songs/serialization";
import { useInstallation } from "@/components/installations/InstallationSelector";
import { useTranslations } from "@/hooks/use-translations";

interface ImportInstalledSongsResponse {
  success: boolean;
  stats?: {
    added: number;
    updated: number;
    linked: number;
  };
  error?: string;
}

interface ImportStats {
  added: number;
  updated: number;
  linked: number;
}

export default function CacheDeserializer() {
  const { t } = useTranslations();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [songs, setSongs] = useState<SongEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [importStats, setImportStats] = useState<ImportStats | null>(null);

  // Installation state from context
  const { installations, refreshInstallations } = useInstallation();

  const [selectedInstallationId, setSelectedInstallationId] =
    useState<string>("");
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newInstallationName, setNewInstallationName] = useState("");
  const [newInstallationPath, setNewInstallationPath] = useState("");

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
      setSongs([]);
      setImportStats(null);
      // Automatically start deserialization after file selection
      handleDeserialize(file);
    }
  };

  const handleDeserialize = async (file?: File) => {
    const fileToProcess = file || selectedFile;
    if (!fileToProcess) {
      toast.error(t("cacheDeserializer.noFileSelected"));
      return;
    }

    setIsLoading(true);
    setError(null);
    setSongs([]);
    setImportStats(null);

    try {
      const songEntries = await deserializeCache(fileToProcess);
      setSongs(songEntries);
      toast.success(
        t("cacheDeserializer.successLoaded", { count: songEntries.length }),
      );
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : t("cacheDeserializer.failedToDeserialize");
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveToDatabase = async () => {
    if (songs.length === 0) {
      toast.error(t("cacheDeserializer.noSongsToSave"));
      return;
    }

    // Validate installation selection
    if (!isCreatingNew && !selectedInstallationId) {
      toast.error(t("cacheDeserializer.selectInstallationError"));
      return;
    }

    if (isCreatingNew && !newInstallationName.trim()) {
      toast.error(t("cacheDeserializer.enterInstallationNameError"));
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Serialize songs for API transport
      const serializedSongs: SerializedSongEntry[] =
        songs.map(serializeSongEntry);

      // Prepare installation info
      const installation = isCreatingNew
        ? {
          name: newInstallationName.trim(),
          path: newInstallationPath.trim() || undefined,
        }
        : {
          id: selectedInstallationId,
          name:
            installations.find((i) => i.id === selectedInstallationId)
              ?.name || "",
        };

      const response = await fetch("/api/installed-songs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          installation,
          songs: serializedSongs,
        }),
      });

      const result: ImportInstalledSongsResponse = await response.json();

      if (result.success && result.stats) {
        setImportStats(result.stats);
        toast.success(
          t("cacheDeserializer.successImported", {
            added: result.stats.added,
            updated: result.stats.updated,
            linked: result.stats.linked,
          }),
        );

        // Refresh installations list if we created a new one
        if (isCreatingNew) {
          await refreshInstallations();
          setIsCreatingNew(false);
          setNewInstallationName("");
          setNewInstallationPath("");
        }
      } else {
        throw new Error(result.error || t("cacheDeserializer.failedToSave"));
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : t("cacheDeserializer.failedToSave");
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          {t("cacheDeserializer.title")}
        </CardTitle>
        <CardDescription>
          {t("cacheDeserializer.description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* File Input */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Button
              onClick={handleImportClick}
              disabled={isLoading || isSaving}
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  {t("cacheDeserializer.processing")}
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  {t("cacheDeserializer.deserialize")}
                </>
              )}
            </Button>
          </div>
          {selectedFile && (
            <p className="text-sm text-muted-foreground">
              {t("cacheDeserializer.selectedWithSize", {
                name: selectedFile.name,
                size: (selectedFile.size / 1024 / 1024).toFixed(2),
              })}
            </p>
          )}
          <input
            ref={fileInputRef}
            id="cache-file"
            type="file"
            accept=".bin,.cache"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {/* Loading Progress */}
        {isLoading && (
          <div className="space-y-2">
            <Progress value={undefined} className="w-full" />
            <p className="text-sm text-muted-foreground">
              {t("cacheDeserializer.deserializing")}
            </p>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Success Display */}
        {songs.length > 0 && !error && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              {t("cacheDeserializer.successLoaded", { count: songs.length })}
            </AlertDescription>
          </Alert>
        )}

        {/* Installation Selection & Save Section */}
        {songs.length > 0 && !error && (
          <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Database className="h-5 w-5" />
              {t("cacheDeserializer.saveToDatabase")}
            </h3>

            {/* Installation Selector */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Label htmlFor="installation">
                    {t("cacheDeserializer.installation")}
                  </Label>
                  <Select
                    value={isCreatingNew ? "new" : selectedInstallationId}
                    onValueChange={(value) => {
                      if (value === "new") {
                        setIsCreatingNew(true);
                        setSelectedInstallationId("");
                      } else {
                        setIsCreatingNew(false);
                        setSelectedInstallationId(value);
                      }
                    }}
                    disabled={isSaving}
                  >
                    <SelectTrigger id="installation">
                      <SelectValue
                        placeholder={t("cacheDeserializer.selectInstallation")}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {installations.map((installation) => (
                        <SelectItem
                          key={installation.id}
                          value={installation.id}
                        >
                          {installation.name}
                          {installation.path && (
                            <span className="text-muted-foreground ml-2 text-xs">
                              ({installation.path})
                            </span>
                          )}
                        </SelectItem>
                      ))}
                      <SelectItem value="new">
                        <span className="flex items-center gap-1">
                          <Plus className="h-3 w-3" />
                          {t("cacheDeserializer.createInstallation")}
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* New Installation Fields */}
              {isCreatingNew && (
                <div className="space-y-3 pl-4 border-l-2 border-primary/30">
                  <div>
                    <Label htmlFor="new-name">
                      {t("cacheDeserializer.installationName")}
                    </Label>
                    <Input
                      id="new-name"
                      placeholder={t(
                        "cacheDeserializer.installationNamePlaceholder",
                      )}
                      value={newInstallationName}
                      onChange={(e) => setNewInstallationName(e.target.value)}
                      disabled={isSaving}
                    />
                  </div>
                  <div>
                    <Label htmlFor="new-path">
                      {t("cacheDeserializer.installationPath")}
                    </Label>
                    <Input
                      id="new-path"
                      placeholder={t(
                        "cacheDeserializer.installationPathPlaceholder",
                      )}
                      value={newInstallationPath}
                      onChange={(e) => setNewInstallationPath(e.target.value)}
                      disabled={isSaving}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Save Button */}
            <Button
              onClick={handleSaveToDatabase}
              disabled={isSaving || (!isCreatingNew && !selectedInstallationId)}
              className="w-full"
              variant="default"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  {t("cacheDeserializer.savingButton", { count: songs.length })}
                </>
              ) : (
                <>
                  <Database className="h-4 w-4 mr-2" />
                  {t("cacheDeserializer.saveButton", { count: songs.length })}
                </>
              )}
            </Button>

            {/* Import Stats */}
            {importStats && (
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-green-500/10 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {importStats.added}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {t("cacheDeserializer.stats.added")}
                  </div>
                </div>
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {importStats.updated}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {t("cacheDeserializer.stats.updated")}
                  </div>
                </div>
                <div className="p-3 bg-purple-500/10 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {importStats.linked}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {t("cacheDeserializer.stats.linked")}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Songs List */}
        {songs.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Music className="h-5 w-5" />
              {t("cacheDeserializer.songsList", { count: songs.length })}
            </h3>
            <div className="border rounded-lg max-h-96 overflow-y-auto">
              <div className="grid grid-cols-1 gap-1 p-2">
                {songs.map((song, index) => (
                  <div
                    key={index}
                    className="p-3 bg-muted/50 rounded-md hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {song._metadata.Name || `Song ${index + 1}`}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {song._metadata.Artist ||
                            t("cacheDeserializer.unknownArtist")}
                        </p>
                      </div>
                      <div className="text-right text-xs text-muted-foreground ml-2">
                        {song._metadata.Album && (
                          <p className="truncate max-w-32">
                            {song._metadata.Album}
                          </p>
                        )}
                        {song._metadata.Genre && (
                          <p className="truncate max-w-32">
                            {song._metadata.Genre}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

