"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "@/hooks/use-translations";
import { signIn } from "@/lib/auth-client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Loader2,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

interface ProviderAccount {
  provider: string;
  linked: boolean;
  hasScopes: boolean;
}

interface Playlist {
  id: string;
  name: string;
  imageUrl: string | null;
  trackCount: number;
  owner?: string;
}

interface MatchedSong {
  songId: string;
  title: string;
  artist: string;
  albumImageUrl: string | null;
  score: number;
  confident: boolean;
}

interface MatchResult {
  externalTrack: { title: string; artist: string };
  match: MatchedSong | null;
}

interface MatchResponse {
  results: MatchResult[];
  matchedCount: number;
  unmatchedCount: number;
  totalCount: number;
}

interface SongList {
  id: string;
  name: string;
  isFavorites: boolean;
}

interface PlaylistImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialProvider?: string | null;
}

export function PlaylistImportDialog({
  open,
  onOpenChange,
  initialProvider,
}: PlaylistImportDialogProps) {
  const { t } = useTranslations();
  const [step, setStep] = useState(1);

  // Step 1 state
  const [accounts, setAccounts] = useState<ProviderAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);

  // Step 2 state
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(
    null,
  );

  // Step 3 state
  const [matchResults, setMatchResults] = useState<MatchResponse | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [selectedSongIds, setSelectedSongIds] = useState<Set<string>>(
    new Set(),
  );
  const [listName, setListName] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [useExistingList, setUseExistingList] = useState(false);
  const [existingListId, setExistingListId] = useState<string>("");
  const [userLists, setUserLists] = useState<SongList[]>([]);
  const [importing, setImporting] = useState(false);

  // Step 4 state
  const [importedListId, setImportedListId] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState(0);

  // Fetch linked accounts
  const fetchAccounts = useCallback(async () => {
    setAccountsLoading(true);
    try {
      const res = await fetch("/api/import/accounts");
      if (res.ok) {
        const data = await res.json();
        setAccounts(data);
      }
    } catch {
      toast.error(t("import.error"));
    } finally {
      setAccountsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (open) {
      fetchAccounts();
    }
  }, [open, fetchAccounts]);

  // Auto-advance to step 2 if coming from OAuth callback
  useEffect(() => {
    if (open && initialProvider && accounts.length > 0) {
      const acc = accounts.find((a) => a.provider === initialProvider);
      if (acc?.linked && acc.hasScopes) {
        setSelectedProvider(initialProvider);
        setStep(2);
      }
    }
  }, [open, initialProvider, accounts]);

  // Fetch playlists when step 2 is reached
  useEffect(() => {
    if (step === 2 && selectedProvider) {
      fetchPlaylists(selectedProvider);
    }
  }, [step, selectedProvider]);

  // Fetch user lists for the "add to existing" option
  useEffect(() => {
    if (step === 3) {
      fetchUserLists();
    }
  }, [step]);

  const fetchPlaylists = async (provider: string) => {
    setPlaylistsLoading(true);
    setPlaylists([]);
    try {
      const res = await fetch(`/api/import/playlists?provider=${provider}`);
      if (res.status === 401) {
        const data = await res.json();
        if (data.error === "reauth_required") {
          toast.error(t("import.reauthRequired"));
          setStep(1);
          return;
        }
      }
      if (res.ok) {
        const data = await res.json();
        setPlaylists(data);
      }
    } catch {
      toast.error(t("import.error"));
    } finally {
      setPlaylistsLoading(false);
    }
  };

  const fetchUserLists = async () => {
    try {
      const res = await fetch("/api/lists");
      if (res.ok) {
        const data = await res.json();
        setUserLists(data);
      }
    } catch {
      // Non-critical, silently fail
    }
  };

  const handleProviderSelect = (provider: string) => {
    const acc = accounts.find((a) => a.provider === provider);
    if (!acc) return;

    if (!acc.linked || !acc.hasScopes) {
      // Need to connect or re-authorize
      signIn.social({
        provider: provider as "google" | "spotify",
        callbackURL: `/lists?import=${provider}`,
      });
      return;
    }

    setSelectedProvider(provider);
    setStep(2);
  };

  const handlePlaylistSelect = async (playlist: Playlist) => {
    setSelectedPlaylist(playlist);
    setListName(playlist.name);
    setMatchLoading(true);
    setStep(3);

    try {
      const res = await fetch("/api/import/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: selectedProvider,
          playlistId: playlist.id,
        }),
      });

      if (res.status === 401) {
        toast.error(t("import.reauthRequired"));
        setStep(1);
        return;
      }

      if (res.ok) {
        const data: MatchResponse = await res.json();
        setMatchResults(data);

        // Pre-select all matched songs
        const matched = new Set<string>();
        for (const r of data.results) {
          if (r.match) {
            matched.add(r.match.songId);
          }
        }
        setSelectedSongIds(matched);
      }
    } catch {
      toast.error(t("import.error"));
      setStep(2);
    } finally {
      setMatchLoading(false);
    }
  };

  const toggleSong = (songId: string) => {
    setSelectedSongIds((prev) => {
      const next = new Set(prev);
      if (next.has(songId)) {
        next.delete(songId);
      } else {
        next.add(songId);
      }
      return next;
    });
  };

  const handleImport = async () => {
    if (selectedSongIds.size === 0) return;
    setImporting(true);

    try {
      const body: Record<string, unknown> = {
        songIds: Array.from(selectedSongIds),
      };

      if (useExistingList && existingListId) {
        body.existingListId = existingListId;
      } else {
        body.name = listName;
        body.isPublic = isPublic;
      }

      const res = await fetch("/api/import/create-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        setImportedListId(data.listId);
        setImportedCount(data.addedCount);
        setStep(4);

        const message = useExistingList
          ? t("import.successExisting", { count: data.addedCount })
          : t("import.success", { count: data.addedCount });
        toast.success(message);
      } else {
        toast.error(t("import.error"));
      }
    } catch {
      toast.error(t("import.error"));
    } finally {
      setImporting(false);
    }
  };

  const resetDialog = () => {
    setStep(1);
    setSelectedProvider(null);
    setPlaylists([]);
    setSelectedPlaylist(null);
    setMatchResults(null);
    setSelectedSongIds(new Set());
    setListName("");
    setIsPublic(true);
    setUseExistingList(false);
    setExistingListId("");
    setImportedListId(null);
    setImportedCount(0);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetDialog();
    }
    onOpenChange(newOpen);
  };

  const providerLabel = (provider: string) =>
    provider === "spotify" ? t("import.spotify") : t("import.youtube");

  const getProviderStatus = (acc: ProviderAccount) => {
    if (!acc.linked) return "notLinked";
    if (!acc.hasScopes) return "missingScopes";
    return "ready";
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-150 max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("import.title")}</DialogTitle>
          <DialogDescription>
            {step === 1 && t("import.step1Description")}
            {step === 2 && t("import.step2Description")}
            {step === 3 && t("import.step3Description")}
            {step === 4 && t("import.step4Description")}
          </DialogDescription>
        </DialogHeader>

        <Stepper value={step} className="space-y-6">
          <StepperNav className="mb-2 gap-5">
            {[
              { title: t("import.step1Title") },
              { title: t("import.step2Title") },
              { title: t("import.step3Title") },
              { title: t("import.step4Title") },
            ].map((s, index) => (
              <StepperItem
                key={index}
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
            {/* Step 1: Select Provider */}
            <StepperContent value={1}>
              <div className="space-y-3">
                {accountsLoading ? (
                  <>
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </>
                ) : (
                  accounts.map((acc) => {
                    const status = getProviderStatus(acc);
                    return (
                      <button
                        key={acc.provider}
                        onClick={() => handleProviderSelect(acc.provider)}
                        className={`w-full flex items-center gap-4 p-4 rounded-lg border transition-colors text-left ${
                          status === "ready"
                            ? "hover:border-primary/50 cursor-pointer"
                            : "hover:border-primary/30 cursor-pointer"
                        }`}
                      >
                        <div className="flex-1">
                          <div className="font-medium">
                            {providerLabel(acc.provider)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {status === "notLinked" && t("import.notLinked")}
                            {status === "missingScopes" &&
                              t("import.missingScopes")}
                            {status === "ready" && t("import.ready")}
                          </div>
                        </div>
                        <div>
                          {status === "ready" ? (
                            <Check className="h-5 w-5 text-green-500" />
                          ) : (
                            <span className="text-sm text-primary">
                              {status === "notLinked"
                                ? t("import.connect")
                                : t("import.reauthorize")}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </StepperContent>

            {/* Step 2: Select Playlist */}
            <StepperContent value={2}>
              <div className="space-y-3">
                {playlistsLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))
                ) : playlists.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Music className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p>{t("import.noPlaylists")}</p>
                  </div>
                ) : (
                  <div className="max-h-[400px] overflow-y-auto space-y-2">
                    {playlists.map((playlist) => (
                      <button
                        key={playlist.id}
                        onClick={() => handlePlaylistSelect(playlist)}
                        className="w-full flex items-center gap-3 p-3 rounded-lg border hover:border-primary/50 transition-colors cursor-pointer text-left"
                      >
                        {playlist.imageUrl ? (
                          <img
                            src={playlist.imageUrl}
                            alt={playlist.name}
                            className="h-12 w-12 rounded object-cover"
                          />
                        ) : (
                          <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">
                            <Music className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">
                            {playlist.name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {t("import.tracks", { count: playlist.trackCount })}
                            {playlist.owner && ` · ${playlist.owner}`}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex justify-start pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setStep(1)}
                  >
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    {t("import.back")}
                  </Button>
                </div>
              </div>
            </StepperContent>

            {/* Step 3: Review Matches */}
            <StepperContent value={3}>
              {matchLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                  <p className="text-muted-foreground">
                    {t("import.matching")}
                  </p>
                </div>
              ) : matchResults ? (
                <div className="space-y-4">
                  {matchResults.matchedCount === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <AlertTriangle className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      <p>{t("import.noMatches")}</p>
                    </div>
                  ) : (
                    <>
                      {/* Matched songs */}
                      <div>
                        <h4 className="text-sm font-medium mb-2">
                          {t("import.matchedSongs", {
                            matched: matchResults.matchedCount,
                            total: matchResults.totalCount,
                          })}
                        </h4>
                        <div className="max-h-50 overflow-y-auto space-y-1 border rounded-lg p-2">
                          {matchResults.results
                            .filter((r) => r.match)
                            .map((r, i) => (
                              <div
                                key={i}
                                className="flex items-center gap-2 py-1.5 px-1"
                              >
                                <Checkbox
                                  checked={selectedSongIds.has(r.match!.songId)}
                                  onCheckedChange={() =>
                                    toggleSong(r.match!.songId)
                                  }
                                />
                                {r.match!.albumImageUrl && (
                                  <img
                                    src={r.match!.albumImageUrl}
                                    alt=""
                                    className="h-8 w-8 rounded object-cover"
                                  />
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm truncate">
                                    {r.match!.title}
                                  </div>
                                  <div className="text-xs text-muted-foreground truncate">
                                    {r.match!.artist}
                                  </div>
                                </div>
                                {!r.match!.confident && (
                                  <span title={t("import.lowConfidence")}>
                                    <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
                                  </span>
                                )}
                              </div>
                            ))}
                        </div>
                      </div>

                      {/* Unmatched songs */}
                      {matchResults.unmatchedCount > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-2 text-muted-foreground">
                            {t("import.notFound", {
                              count: matchResults.unmatchedCount,
                            })}
                          </h4>
                          <div className="max-h-30 overflow-y-auto space-y-1 border rounded-lg p-2 opacity-60">
                            {matchResults.results
                              .filter((r) => !r.match)
                              .map((r, i) => (
                                <div key={i} className="text-sm py-1 px-1">
                                  <span>{r.externalTrack.title}</span>
                                  <span className="text-muted-foreground">
                                    {" "}
                                    — {r.externalTrack.artist}
                                  </span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* List configuration */}
                      <div className="space-y-3 border-t pt-3">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={useExistingList}
                            onCheckedChange={setUseExistingList}
                          />
                          <Label>{t("import.addToExisting")}</Label>
                        </div>

                        {useExistingList ? (
                          <Select
                            value={existingListId}
                            onValueChange={setExistingListId}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue
                                placeholder={t("import.selectList")}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {userLists.map((list) => (
                                <SelectItem key={list.id} value={list.id}>
                                  {list.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <>
                            <div className="flex flex-col gap-2">
                              <Label htmlFor="importListName">
                                {t("import.listName")}
                              </Label>
                              <Input
                                id="importListName"
                                value={listName}
                                onChange={(e) => setListName(e.target.value)}
                                maxLength={50}
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={isPublic}
                                onCheckedChange={setIsPublic}
                              />
                              <Label>
                                {isPublic
                                  ? t("import.publicList")
                                  : t("import.privateList")}
                              </Label>
                            </div>
                          </>
                        )}
                      </div>
                    </>
                  )}

                  <div className="flex justify-between pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setStep(2)}
                    >
                      <ArrowLeft className="h-4 w-4 mr-1" />
                      {t("import.back")}
                    </Button>
                    {matchResults.matchedCount > 0 && (
                      <Button
                        size="sm"
                        onClick={handleImport}
                        disabled={
                          importing ||
                          selectedSongIds.size === 0 ||
                          (!useExistingList && !listName.trim()) ||
                          (useExistingList && !existingListId)
                        }
                      >
                        {importing ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            {t("import.importing")}
                          </>
                        ) : (
                          <>
                            {t("import.importButton", {
                              count: selectedSongIds.size,
                            })}
                            <ArrowRight className="h-4 w-4 ml-1" />
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              ) : null}
            </StepperContent>

            {/* Step 4: Success */}
            <StepperContent value={4}>
              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                  <Check className="h-6 w-6 text-green-500" />
                </div>
                <p className="text-center font-medium">
                  {useExistingList
                    ? t("import.successExisting", { count: importedCount })
                    : t("import.success", { count: importedCount })}
                </p>
                <div className="flex gap-2">
                  {importedListId && (
                    <Button asChild size="sm">
                      <Link href={`/lists/${importedListId}`}>
                        <ExternalLink className="h-4 w-4 mr-1" />
                        {t("import.viewList")}
                      </Link>
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenChange(false)}
                  >
                    {t("import.close")}
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
