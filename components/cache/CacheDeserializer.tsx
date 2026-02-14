"use client";

import React, { useState, useMemo } from "react";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Upload,
  FileText,
  Music,
  AlertCircle,
  CheckCircle,
  ChevronRight,
  Copy,
  Database,
  Plus,
  Trash2,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";
import { SongEntry } from "@/services/cache-reader/Song/Entries/SongEntry";
import { UnpackedIniEntry } from "@/services/cache-reader/Song/Entries/UnpackedIniEntry";
import { AvailableParts } from "@/services/cache-reader/Song/Entries/AvailableParts";
import deserializeCache from "@/services/cache-reader/deserializer";
import {
  serializeSongEntry,
  type SerializedSongEntry,
} from "@/services/songs/serialization";
import { useTranslations } from "@/hooks/use-translations";

interface SongDetail {
  title: string;
  artist: string;
}

interface ImportStats {
  added: number;
  updated: number;
  linked: number;
  details: {
    added: SongDetail[];
    updated: SongDetail[];
    linked: SongDetail[];
  };
}

interface ImportInstalledSongsResponse {
  success: boolean;
  stats?: ImportStats;
  error?: string;
}

interface Installation {
  id: string;
  name: string;
  path: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface DuplicateEntry {
  song: SongEntry;
  index: number;
  directory: string;
  instrumentCount: number;
  isBest: boolean;
}

interface DuplicateGroup {
  name: string;
  artist: string;
  entries: DuplicateEntry[];
}

function normalizeText(text: string): string {
  return text
    .replace(/\(.*?\)|\[.*?\]/g, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getSongDirectory(entry: SongEntry): string {
  if (entry instanceof UnpackedIniEntry) {
    return entry.Directory;
  }
  return entry._metadata.Location || "";
}

function countInstruments(parts: AvailableParts): number {
  let count = 0;
  if (
    parts.FiveFretGuitar.Intensity >= 0 ||
    parts.SixFretGuitar.Intensity >= 0
  )
    count++;
  if (parts.FiveFretBass.Intensity >= 0 || parts.SixFretBass.Intensity >= 0)
    count++;
  if (
    parts.FourLaneDrums.Intensity >= 0 ||
    parts.FiveLaneDrums.Intensity >= 0 ||
    parts.ProDrums.Intensity >= 0
  )
    count++;
  if (parts.Keys.Intensity >= 0 || parts.ProKeys.Intensity >= 0) count++;
  if (parts.LeadVocals.Intensity >= 0 || parts.HarmonyVocals.Intensity >= 0)
    count++;
  return count;
}

function findDuplicates(songs: SongEntry[]): DuplicateGroup[] {
  const groups = new Map<string, { name: string; artist: string; entries: { song: SongEntry; index: number }[] }>();

  for (let i = 0; i < songs.length; i++) {
    const song = songs[i];
    const key = `${normalizeText(song._metadata.Name)}|${normalizeText(song._metadata.Artist)}`;

    if (!groups.has(key)) {
      groups.set(key, {
        name: song._metadata.Name,
        artist: song._metadata.Artist,
        entries: [],
      });
    }
    groups.get(key)!.entries.push({ song, index: i });
  }

  const duplicates: DuplicateGroup[] = [];

  for (const group of groups.values()) {
    if (group.entries.length <= 1) continue;

    const entries: DuplicateEntry[] = group.entries.map((e) => ({
      song: e.song,
      index: e.index,
      directory: getSongDirectory(e.song),
      instrumentCount: countInstruments(e.song._parts),
      isBest: false,
    }));

    // Find the best entry (most instruments, then most metadata)
    let bestIdx = 0;
    for (let i = 1; i < entries.length; i++) {
      if (entries[i].instrumentCount > entries[bestIdx].instrumentCount) {
        bestIdx = i;
      } else if (entries[i].instrumentCount === entries[bestIdx].instrumentCount) {
        // Tiebreak: more metadata fields filled
        const metaCount = (s: SongEntry) => {
          let c = 0;
          if (s._metadata.Album) c++;
          if (s._metadata.Genre) c++;
          if (s._metadata.Year) c++;
          if (s._metadata.Charter) c++;
          return c;
        };
        if (metaCount(entries[i].song) > metaCount(entries[bestIdx].song)) {
          bestIdx = i;
        }
      }
    }
    entries[bestIdx].isBest = true;

    duplicates.push({
      name: group.name,
      artist: group.artist,
      entries,
    });
  }

  return duplicates;
}

export default function CacheDeserializer() {
  const { t } = useTranslations();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [songs, setSongs] = useState<SongEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [importStats, setImportStats] = useState<ImportStats | null>(null);
  const [detailType, setDetailType] = useState<
    "added" | "updated" | "linked" | null
  >(null);

  const duplicates = useMemo(() => findDuplicates(songs), [songs]);

  const pathsToDelete = useMemo(() => {
    return duplicates.flatMap((group) =>
      group.entries
        .filter((e) => !e.isBest && e.directory)
        .map((e) => e.directory),
    );
  }, [duplicates]);

  const lowInstrumentSongs = useMemo(() => {
    return songs
      .map((song, index) => ({
        song,
        index,
        directory: getSongDirectory(song),
        instrumentCount: countInstruments(song._parts),
      }))
      .filter((s) => s.instrumentCount < 4);
  }, [songs]);

  // Local installations state — fetched lazily when songs are loaded
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [installationsLoaded, setInstallationsLoaded] = useState(false);

  const fetchInstallations = React.useCallback(async () => {
    try {
      const response = await fetch("/api/installations");
      if (response.ok) {
        const data = await response.json();
        setInstallations(data.installations || []);
      }
    } catch (err) {
      console.error("Failed to fetch installations:", err);
    } finally {
      setInstallationsLoaded(true);
    }
  }, []);

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
      // Fetch installations lazily now that songs are loaded
      if (!installationsLoaded) {
        fetchInstallations();
      }
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
          await fetchInstallations();
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

        {/* Duplicates Section */}
        {duplicates.length > 0 && (
          <div className="space-y-3 p-4 border rounded-lg bg-amber-500/5 border-amber-500/20">
            <h3 className="text-lg font-semibold flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <Copy className="h-5 w-5" />
              {t("cacheDeserializer.duplicates.title", {
                count: duplicates.length,
              })}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t("cacheDeserializer.duplicates.description")}
            </p>

            <div className="space-y-1">
              {duplicates.map((group, groupIdx) => (
                <Collapsible key={groupIdx}>
                  <CollapsibleTrigger className="w-full flex items-center gap-2 font-medium text-sm bg-muted/50 p-2 rounded cursor-pointer hover:bg-muted/70 group text-left transition-colors">
                    <ChevronRight className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-90 text-muted-foreground shrink-0" />
                    <span className="truncate flex-1">
                      {group.name} - {group.artist}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {group.entries.length}x
                    </span>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="space-y-1 pl-6 pt-1 pb-2">
                      {group.entries.map((entry, entryIdx) => (
                        <div
                          key={entryIdx}
                          className={`flex items-start gap-2 text-xs p-2 rounded ${
                            entry.isBest
                              ? "bg-green-500/10 border border-green-500/20"
                              : "bg-red-500/5 border border-red-500/10"
                          }`}
                        >
                          {entry.isBest ? (
                            <Trophy className="h-3.5 w-3.5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5 text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className={`font-medium ${entry.isBest ? "text-green-700 dark:text-green-300" : "text-red-600 dark:text-red-400"}`}
                              >
                                {entry.isBest
                                  ? t("cacheDeserializer.duplicates.keep")
                                  : t("cacheDeserializer.duplicates.delete")}
                              </span>
                              <span className="text-muted-foreground">
                                {t(
                                  "cacheDeserializer.duplicates.instrumentCount",
                                  { count: entry.instrumentCount },
                                )}
                              </span>
                            </div>
                            {entry.directory && (
                              <p
                                className="text-muted-foreground truncate mt-0.5"
                                title={entry.directory}
                              >
                                {entry.directory}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>

            {/* Copy all paths to delete */}
            {pathsToDelete.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="w-full text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/10"
                onClick={() => {
                  navigator.clipboard.writeText(pathsToDelete.join("\n"));
                  toast.success(
                    t("cacheDeserializer.duplicates.copiedPaths", {
                      count: pathsToDelete.length,
                    }),
                  );
                }}
              >
                <Copy className="h-4 w-4 mr-2" />
                {t("cacheDeserializer.duplicates.copyPaths", {
                  count: pathsToDelete.length,
                })}
              </Button>
            )}
          </div>
        )}

        {/* Low Instrument Songs Section */}
        {lowInstrumentSongs.length > 0 && (
          <div className="space-y-3 p-4 border rounded-lg bg-orange-500/5 border-orange-500/20">
            <h3 className="text-lg font-semibold flex items-center gap-2 text-orange-600 dark:text-orange-400">
              <AlertCircle className="h-5 w-5" />
              {t("cacheDeserializer.lowInstruments.title", {
                count: lowInstrumentSongs.length,
              })}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t("cacheDeserializer.lowInstruments.description")}
            </p>

            <div className="border rounded-lg max-h-64 overflow-y-auto">
              <div className="space-y-1 p-2">
                {lowInstrumentSongs.map((entry) => (
                  <div
                    key={entry.index}
                    className="flex items-start gap-2 text-xs p-2 rounded bg-muted/50"
                  >
                    <span className="shrink-0 font-mono text-orange-600 dark:text-orange-400 mt-0.5">
                      {entry.instrumentCount}/5
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {entry.song._metadata.Name} -{" "}
                        {entry.song._metadata.Artist}
                      </p>
                      {entry.directory && (
                        <p
                          className="text-muted-foreground truncate"
                          title={entry.directory}
                        >
                          {entry.directory}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Copy paths */}
            {lowInstrumentSongs.some((e) => e.directory) && (
              <Button
                variant="outline"
                size="sm"
                className="w-full text-orange-700 dark:text-orange-300 border-orange-500/30 hover:bg-orange-500/10"
                onClick={() => {
                  const paths = lowInstrumentSongs
                    .filter((e) => e.directory)
                    .map((e) => e.directory);
                  navigator.clipboard.writeText(paths.join("\n"));
                  toast.success(
                    t("cacheDeserializer.lowInstruments.copiedPaths", {
                      count: paths.length,
                    }),
                  );
                }}
              >
                <Copy className="h-4 w-4 mr-2" />
                {t("cacheDeserializer.lowInstruments.copyPaths", {
                  count: lowInstrumentSongs.filter((e) => e.directory).length,
                })}
              </Button>
            )}
          </div>
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
                <div
                  onClick={() =>
                    importStats.details.added.length > 0 &&
                    setDetailType("added")
                  }
                  className={`p-3 bg-green-500/10 rounded-lg ${importStats.details.added.length > 0 ? "cursor-pointer hover:opacity-80" : ""}`}
                >
                  <div className="text-2xl font-bold text-green-600">
                    {importStats.added}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {t("cacheDeserializer.stats.added")}
                  </div>
                </div>
                <div
                  onClick={() =>
                    importStats.details.updated.length > 0 &&
                    setDetailType("updated")
                  }
                  className={`p-3 bg-blue-500/10 rounded-lg ${importStats.details.updated.length > 0 ? "cursor-pointer hover:opacity-80" : ""}`}
                >
                  <div className="text-2xl font-bold text-blue-600">
                    {importStats.updated}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {t("cacheDeserializer.stats.updated")}
                  </div>
                </div>
                <div
                  onClick={() =>
                    importStats.details.linked.length > 0 &&
                    setDetailType("linked")
                  }
                  className={`p-3 bg-purple-500/10 rounded-lg ${importStats.details.linked.length > 0 ? "cursor-pointer hover:opacity-80" : ""}`}
                >
                  <div className="text-2xl font-bold text-purple-600">
                    {importStats.linked}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {t("cacheDeserializer.stats.linked")}
                  </div>
                </div>
              </div>
            )}

            {/* Details Dialog */}
            <Dialog
              open={!!detailType}
              onOpenChange={(open) => !open && setDetailType(null)}
            >
              <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
                <DialogHeader>
                  <DialogTitle className="capitalize">
                    {detailType &&
                      t(`cacheDeserializer.stats.${detailType}`)}
                  </DialogTitle>
                </DialogHeader>
                <div className="overflow-y-auto max-h-[60vh] pr-2">
                  {detailType && importStats?.details[detailType]?.length ? (
                    <div className="space-y-1">
                      {importStats.details[detailType].map((song, i) => (
                        <div
                          key={i}
                          className="text-[10px] text-muted-foreground truncate"
                          title={`${song.title} - ${song.artist}`}
                        >
                          {song.title} - {song.artist}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-sm text-muted-foreground p-4">
                      {t("provider.phases.noDetailsAvailable")}
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
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

