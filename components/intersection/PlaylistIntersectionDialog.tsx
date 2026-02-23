"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "@/hooks/use-translations";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Stepper,
  StepperContent,
  StepperItem,
  StepperNav,
  StepperPanel,
  StepperIndicator,
  StepperTitle,
  StepperTrigger,
} from "@/components/reui/stepper";
import {
  Music,
  Check,
  ArrowLeft,
  ArrowRight,
  Loader2,
  ExternalLink,
  Search,
  Download,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";

interface MyList {
  id: string;
  name: string;
  isFavorites: boolean;
  itemCount: number;
}

interface PublicList {
  id: string;
  name: string;
  ownerDisplayName: string;
  itemCount: number;
}

interface IntersectionSong {
  songId: string;
  title: string;
  artist: string;
  album: string | null;
  albumImageUrl: string | null;
  downloadUrls: { url: string; source: string }[];
  count: number;
  installed: boolean;
}

interface Installation {
  id: string;
  name: string;
}

interface PlaylistIntersectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PlaylistIntersectionDialog({
  open,
  onOpenChange,
}: PlaylistIntersectionDialogProps) {
  const { t } = useTranslations();
  const [step, setStep] = useState(1);

  // Step 1: My Lists
  const [myLists, setMyLists] = useState<MyList[]>([]);
  const [myListsLoading, setMyListsLoading] = useState(true);
  const [selectedMyListIds, setSelectedMyListIds] = useState<Set<string>>(
    new Set(),
  );

  // Step 2: Public Lists
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PublicList[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPublicListIds, setSelectedPublicListIds] = useState<
    Set<string>
  >(new Set());
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Step 3: Threshold
  const [minCount, setMinCount] = useState(1);
  const [isCalculating, setIsCalculating] = useState(false);

  // Step 4: Results
  const [results, setResults] = useState<IntersectionSong[]>([]);
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [selectedInstallationId, setSelectedInstallationId] =
    useState<string>("");
  const [installationsLoading, setInstallationsLoading] = useState(false);
  const [isRefetchingWithInstallation, setIsRefetchingWithInstallation] =
    useState(false);

  // Save as playlist state
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [saveListName, setSaveListName] = useState("");
  const [saveIsPublic, setSaveIsPublic] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedListId, setSavedListId] = useState<string | null>(null);

  // Downloading state
  const [isDownloading, setIsDownloading] = useState(false);

  const totalSelected = selectedMyListIds.size + selectedPublicListIds.size;

  // Fetch my lists on open
  useEffect(() => {
    if (!open) return;
    setMyListsLoading(true);
    fetch("/api/lists")
      .then((r) => r.json())
      .then((data) => setMyLists(data))
      .catch(() => toast.error(t("intersection.fetchError")))
      .finally(() => setMyListsLoading(false));
  }, [open, t]);

  // Fetch installations when reaching step 4
  useEffect(() => {
    if (step !== 4) return;
    setInstallationsLoading(true);
    fetch("/api/installations")
      .then((r) => r.json())
      .then((data) => setInstallations(data.installations ?? []))
      .catch(() => {})
      .finally(() => setInstallationsLoading(false));
  }, [step]);

  // Search public lists with debounce
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (value.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/lists/search?q=${encodeURIComponent(value)}`,
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
        }
      } catch {
        // silently fail
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, []);

  const toggleMyList = (id: string) => {
    setSelectedMyListIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const togglePublicList = (list: PublicList) => {
    setSelectedPublicListIds((prev) => {
      const next = new Set(prev);
      if (next.has(list.id)) {
        next.delete(list.id);
      } else {
        next.add(list.id);
      }
      return next;
    });
  };

  const handleCalculate = async () => {
    setIsCalculating(true);
    try {
      const res = await fetch("/api/intersection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          myListIds: Array.from(selectedMyListIds),
          publicListIds: Array.from(selectedPublicListIds),
          minCount,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setResults(data.songs);
        setStep(4);
      } else {
        toast.error(t("intersection.fetchError"));
      }
    } catch {
      toast.error(t("intersection.fetchError"));
    } finally {
      setIsCalculating(false);
    }
  };

  const handleInstallationChange = async (installationId: string) => {
    setSelectedInstallationId(installationId);
    if (!installationId) {
      // Clear installed status
      setResults((prev) => prev.map((s) => ({ ...s, installed: false })));
      return;
    }

    setIsRefetchingWithInstallation(true);
    try {
      const res = await fetch("/api/intersection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          myListIds: Array.from(selectedMyListIds),
          publicListIds: Array.from(selectedPublicListIds),
          minCount,
          installationId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setResults(data.songs);
      }
    } catch {
      // silently fail
    } finally {
      setIsRefetchingWithInstallation(false);
    }
  };

  const handleSavePlaylist = async () => {
    if (!saveListName.trim()) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/import/create-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          songIds: results.map((s) => s.songId),
          name: saveListName.trim(),
          isPublic: saveIsPublic,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSavedListId(data.listId);
        setShowSaveForm(false);
        toast.success(t("intersection.saveSuccess"));
      } else {
        toast.error(t("intersection.saveError"));
      }
    } catch {
      toast.error(t("intersection.saveError"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadAll = async (songsToDownload: IntersectionSong[]) => {
    const urls = songsToDownload
      .filter((s) => s.downloadUrls.length > 0)
      .map((s) => s.downloadUrls[0].url);

    if (urls.length === 0) return;

    setIsDownloading(true);
    const firstWindow = window.open(urls[0], "_blank");
    if (!firstWindow) {
      toast.error(t("lists.downloadAllBlocked"));
      setIsDownloading(false);
      return;
    }

    for (let i = 1; i < urls.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      window.open(urls[i], "_blank");
    }
    setIsDownloading(false);
  };

  const resetDialog = () => {
    setStep(1);
    setMyLists([]);
    setMyListsLoading(true);
    setSelectedMyListIds(new Set());
    setSearchQuery("");
    setSearchResults([]);
    setIsSearching(false);
    setSelectedPublicListIds(new Set());
    setMinCount(1);
    setIsCalculating(false);
    setResults([]);
    setInstallations([]);
    setSelectedInstallationId("");
    setInstallationsLoading(false);
    setIsRefetchingWithInstallation(false);
    setShowSaveForm(false);
    setSaveListName("");
    setSaveIsPublic(true);
    setIsSaving(false);
    setSavedListId(null);
    setIsDownloading(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) resetDialog();
    onOpenChange(newOpen);
  };

  const uninstalledSongs = results.filter((s) => !s.installed);
  const hasInstallation = !!selectedInstallationId;
  const hasInstalledSongs = results.some((s) => s.installed);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-150 max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("intersection.title")}</DialogTitle>
          <DialogDescription>
            {step === 1 && t("intersection.step1Description")}
            {step === 2 && t("intersection.step2Description")}
            {step === 3 && t("intersection.step3Description")}
            {step === 4 &&
              t("intersection.songsFound", { count: results.length })}
          </DialogDescription>
        </DialogHeader>

        <Stepper value={step} className="space-y-6">
          <StepperNav className="mb-2 gap-5">
            {[
              { title: t("intersection.step1Title") },
              { title: t("intersection.step2Title") },
              { title: t("intersection.step3Title") },
              { title: t("intersection.step4Title") },
            ].map((s, index) => (
              <StepperItem
                key={`step-${index + 1}`}
                step={index + 1}
                className="relative flex-1 items-start"
              >
                <StepperTrigger
                  asChild
                  className="flex grow flex-col items-start justify-center gap-3.5 cursor-default"
                >
                  <StepperIndicator className="bg-border data-[state=active]:bg-primary data-[state=completed]:bg-primary h-1 w-full rounded-full">
                    <span className="sr-only">{index + 1}</span>
                  </StepperIndicator>
                  <StepperTitle className="group-data-[state=inactive]/step:text-muted-foreground text-start text-xs font-semibold">
                    {s.title}
                  </StepperTitle>
                </StepperTrigger>
              </StepperItem>
            ))}
          </StepperNav>

          <StepperPanel>
            {/* Step 1: My Lists */}
            <StepperContent value={1}>
              <div className="space-y-3">
                {myListsLoading ? (
                  <>
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </>
                ) : myLists.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Music className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p>{t("lists.noLists")}</p>
                  </div>
                ) : (
                  <div className="max-h-100 overflow-y-auto space-y-1 border rounded-lg p-2">
                    {myLists.map((list) => (
                      <label
                        key={list.id}
                        className="flex items-center gap-3 py-2 px-2 rounded-md hover:bg-muted/50 cursor-pointer"
                        htmlFor={list.id}
                      >
                        <Checkbox
                          id={list.id}
                          checked={selectedMyListIds.has(list.id)}
                          onCheckedChange={() => toggleMyList(list.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {list.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {list.itemCount}{" "}
                            {list.itemCount === 1
                              ? t("lists.song")
                              : t("lists.songs")}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <Button
                    size="sm"
                    onClick={() => setStep(2)}
                    disabled={selectedMyListIds.size === 0}
                  >
                    {t("import.next")}
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </StepperContent>

            {/* Step 2: Public Lists */}
            <StepperContent value={2}>
              <div className="space-y-3">
                {/* Search input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder={t("intersection.searchPlaceholder")}
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    autoFocus
                  />
                </div>

                {/* Search results */}
                {isSearching ? (
                  <div className="flex items-center justify-center py-6 text-muted-foreground gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">
                      {t("intersection.searching")}
                    </span>
                  </div>
                ) : searchQuery.length >= 2 && searchResults.length === 0 ? (
                  <div className="text-center py-6 text-sm text-muted-foreground">
                    {t("intersection.noResults")}
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="max-h-62.5 overflow-y-auto space-y-1 border rounded-lg p-2">
                    {searchResults.map((list) => (
                      <label
                        key={list.id}
                        className="flex items-center gap-3 py-2 px-2 rounded-md hover:bg-muted/50 cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedPublicListIds.has(list.id)}
                          onCheckedChange={() => togglePublicList(list)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {list.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {list.ownerDisplayName} &middot; {list.itemCount}{" "}
                            {list.itemCount === 1
                              ? t("lists.song")
                              : t("lists.songs")}
                          </div>
                        </div>
                        {selectedPublicListIds.has(list.id) && (
                          <Check className="h-4 w-4 text-primary shrink-0" />
                        )}
                      </label>
                    ))}
                  </div>
                ) : null}

                {/* Selected public lists summary */}
                {selectedPublicListIds.size > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {t("intersection.publicListsSummary", {
                      count: selectedPublicListIds.size,
                    })}
                  </div>
                )}

                <div className="flex justify-between pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setStep(1)}
                  >
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    {t("import.back")}
                  </Button>
                  <Button size="sm" onClick={() => setStep(3)}>
                    {t("import.next")}
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </StepperContent>

            {/* Step 3: Threshold */}
            <StepperContent value={3}>
              <div className="space-y-5">
                {/* Summary */}
                <div className="rounded-lg border bg-muted/30 p-4 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t("intersection.myListsSummary", {
                        count: selectedMyListIds.size,
                      })}
                    </span>
                    <Badge variant="secondary">{selectedMyListIds.size}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t("intersection.publicListsSummary", {
                        count: selectedPublicListIds.size,
                      })}
                    </span>
                    <Badge variant="secondary">
                      {selectedPublicListIds.size}
                    </Badge>
                  </div>
                  <div className="flex justify-between font-medium pt-1 border-t">
                    <span>
                      {t("intersection.totalSelected", {
                        total: totalSelected,
                      })}
                    </span>
                    <Badge>{totalSelected}</Badge>
                  </div>
                </div>

                {/* Slider */}
                <div className="space-y-3">
                  <Label className="text-sm">
                    {t("intersection.minThreshold", {
                      n: minCount,
                      total: totalSelected,
                    })}
                  </Label>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => setMinCount((v) => Math.max(1, v - 1))}
                      disabled={minCount <= 1}
                    >
                      -
                    </Button>
                    <input
                      type="range"
                      min={1}
                      max={Math.max(1, totalSelected)}
                      value={minCount}
                      onChange={(e) => setMinCount(Number(e.target.value))}
                      className="flex-1 accent-primary"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() =>
                        setMinCount((v) => Math.min(totalSelected, v + 1))
                      }
                      disabled={minCount >= totalSelected}
                    >
                      +
                    </Button>
                    <span className="text-sm font-bold w-6 text-center">
                      {minCount}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setStep(2)}
                  >
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    {t("import.back")}
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleCalculate}
                    disabled={isCalculating}
                  >
                    {isCalculating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        {t("intersection.calculating")}
                      </>
                    ) : (
                      t("intersection.calculate")
                    )}
                  </Button>
                </div>
              </div>
            </StepperContent>

            {/* Step 4: Results */}
            <StepperContent value={4}>
              <div className="space-y-4">
                {/* Installation selector */}
                <div className="flex items-center gap-3">
                  <Label className="text-sm shrink-0">
                    {t("intersection.selectInstallation")}
                  </Label>
                  {installationsLoading ? (
                    <Skeleton className="h-9 flex-1" />
                  ) : (
                    <Select
                      value={selectedInstallationId || "none"}
                      onValueChange={(v) =>
                        handleInstallationChange(v === "none" ? "" : v)
                      }
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue
                          placeholder={t("intersection.noInstallation")}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          {t("intersection.noInstallation")}
                        </SelectItem>
                        {installations.map((inst) => (
                          <SelectItem key={inst.id} value={inst.id}>
                            {inst.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {isRefetchingWithInstallation && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                  )}
                </div>

                {/* Song list */}
                {results.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Music className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p>{t("intersection.noSongsFound")}</p>
                  </div>
                ) : (
                  <div className="max-h-75 overflow-y-auto space-y-1 border rounded-lg p-2">
                    {results.map((song) => (
                      <div
                        key={song.songId}
                        className="flex items-center gap-3 py-2 px-2 rounded-md"
                      >
                        {song.albumImageUrl ? (
                          <div className="relative h-9 w-9 rounded shrink-0">
                            <Image
                              src={song.albumImageUrl}
                              alt=""
                              className="h-9 w-9 rounded object-cover bg-muted opacity-0 transition-opacity duration-300"
                              width={36}
                              height={36}
                              onLoad={(e) => {
                                (e.target as HTMLImageElement).style.opacity =
                                  "1";
                              }}
                            />
                          </div>
                        ) : (
                          <div className="h-9 w-9 rounded bg-muted flex items-center justify-center shrink-0">
                            <Music className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {song.title}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {song.artist}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline" className="text-xs">
                            {t("intersection.inXLists", { count: song.count })}
                          </Badge>
                          {hasInstallation && song.installed && (
                            <span title={t("intersection.installed")}>
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            </span>
                          )}
                          {song.downloadUrls.length > 0 && (
                            <a
                              href={song.downloadUrls[0].url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Download"
                            >
                              <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Action bar */}
                {results.length > 0 && (
                  <div className="space-y-3 border-t pt-3">
                    {/* Save as playlist */}
                    {savedListId ? (
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-green-600">
                          {t("intersection.saved")}
                        </span>
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/lists/${savedListId}`}>
                            <ExternalLink className="h-4 w-4 mr-1" />
                            {t("import.viewList")}
                          </Link>
                        </Button>
                      </div>
                    ) : showSaveForm ? (
                      <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="saveListName" className="text-sm">
                            {t("intersection.savePlaylistName")}
                          </Label>
                          <Input
                            id="saveListName"
                            value={saveListName}
                            onChange={(e) => setSaveListName(e.target.value)}
                            maxLength={50}
                            autoFocus
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={saveIsPublic}
                            onCheckedChange={setSaveIsPublic}
                          />
                          <Label className="text-sm">
                            {saveIsPublic
                              ? t("import.publicList")
                              : t("import.privateList")}
                          </Label>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={handleSavePlaylist}
                            disabled={isSaving || !saveListName.trim()}
                          >
                            {isSaving ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                {t("intersection.saving")}
                              </>
                            ) : (
                              t("intersection.saveAsPlaylist")
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowSaveForm(false)}
                          >
                            {t("lists.cancel")}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowSaveForm(true)}
                      >
                        {t("intersection.saveAsPlaylist")}
                      </Button>
                    )}

                    {/* Download buttons */}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadAll(results)}
                        disabled={isDownloading}
                      >
                        {isDownloading ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4 mr-1" />
                        )}
                        {t("intersection.downloadAll")}
                      </Button>
                      {hasInstallation &&
                        hasInstalledSongs &&
                        uninstalledSongs.length > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadAll(uninstalledSongs)}
                            disabled={isDownloading}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            {t("intersection.downloadUninstalled")}
                          </Button>
                        )}
                    </div>
                  </div>
                )}

                <div className="flex justify-start pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setStep(3)}
                  >
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    {t("import.back")}
                  </Button>
                </div>
              </div>
            </StepperContent>
          </StepperPanel>
        </Stepper>
      </DialogContent>
    </Dialog>
  );
}
