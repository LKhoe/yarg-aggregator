'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Download,
  Music,
  Heart,
} from 'lucide-react';
import type { IMusic, PaginatedResponse } from '@/types';
import { DifficultyMedal } from '@/components/ui/difficulty-medal';
import { InstrumentIcon } from '@/components/ui/instrument-icon';
import {
  MultiSelect,
  MultiSelectContent,
  MultiSelectGroup,
  MultiSelectItem,
  MultiSelectTrigger,
  MultiSelectValue,
} from "@/components/ui/multi-select"
import { useSavedSongs } from '@/context/SavedSongsContext';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface MusicTableProps {
  deviceId: string;
  deviceName?: string;
  onSavedSongsChange?: () => void;
  onTotalChange?: (total: number) => void;
}

const INSTRUMENTS = ['bass', 'guitar', 'drums', 'vocals', 'prokeys'] as const;

export default function MusicTable({ deviceId, deviceName, onSavedSongsChange, onTotalChange }: MusicTableProps) {
  const [data, setData] = useState<IMusic[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [source, setSource] = useState<string>('');
  const [instruments, setInstruments] = useState<string[]>([]);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const { savedSongIds, addSong, removeSong } = useSavedSongs();

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sortBy,
        sortOrder,
      });
      if (debouncedQuery) params.set('query', debouncedQuery);
      if (source) params.set('source', source);
      if (instruments.length > 0) params.set('instruments', instruments.join(','));
      if (showSavedOnly) {
        // If showing saved songs only, we need to filter by saved song IDs
        const savedIdsArray = Array.from(savedSongIds);
        if (savedIdsArray.length > 0) {
          params.set('savedIds', savedIdsArray.join(','));
        } else {
          // If no saved songs, return empty result
          setData([]);
          setTotal(0);
          setTotalPages(0);
          setLoading(false);
          return;
        }
      }

      const response = await fetch(`/api/music?${params}`);
      if (response.ok) {
        const result: PaginatedResponse<IMusic> = await response.json();
        setData(result.data);
        setTotal(result.total);
        setTotalPages(result.totalPages);
      }
    } catch (error) {
      console.error('Error fetching music:', error);
    }
    setLoading(false);
  }, [page, limit, sortBy, sortOrder, debouncedQuery, source, instruments, showSavedOnly]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Refetch data when saved songs change and "Saved Only" filter is active
  useEffect(() => {
    if (showSavedOnly) {
      fetchData();
    }
  }, [savedSongIds, showSavedOnly, fetchData]);

  // Notify parent when total changes
  useEffect(() => {
    onTotalChange?.(total);
  }, [total, onTotalChange]);

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortBy !== column) return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />;
    return sortOrder === 'asc'
      ? <ArrowUp className="ml-2 h-4 w-4" />
      : <ArrowDown className="ml-2 h-4 w-4" />;
  };

  const toggleSave = async (music: IMusic) => {
    if (savedSongIds.has(music._id!)) {
      await removeSong(music._id!);
    } else {
      await addSong(music);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col gap-3">
        {/* Search input - exclusive row */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search songs, artists, albums..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 h-10 text-sm w-full"
          />
        </div>
        
        {/* Other filters - second row */}
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Instruments filter - full width on mobile, auto on desktop */}
          <div className="w-full sm:flex-1">
            <MultiSelect
              values={instruments}
              onValuesChange={(val) => {
                setInstruments(val);
                setPage(1);
              }}
            >
              <MultiSelectTrigger className="h-[36px] w-full text-sm">
                <MultiSelectValue placeholder="All Instruments" />
              </MultiSelectTrigger>
              <MultiSelectContent>
                <MultiSelectGroup>
                  {INSTRUMENTS.map((inst) => (
                    <MultiSelectItem key={inst} value={inst} className="capitalize">
                      <div className="flex items-center gap-2">
                        <InstrumentIcon instrument={inst} className="size-4 sm:size-5" />
                        <span className="text-sm">{inst}</span>
                      </div>
                    </MultiSelectItem>
                  ))}
                </MultiSelectGroup>
              </MultiSelectContent>
            </MultiSelect>
          </div>
          
          {/* Source and Saved filters - same row on desktop, separate on mobile */}
          <div className="flex gap-2 w-full sm:w-auto">
            <Select value={source || 'all'} onValueChange={(v) => setSource(v === 'all' ? '' : v)}>
              <SelectTrigger className="flex-1 sm:w-[150px] h-9">
                <SelectValue placeholder="All Sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="enchor">Enchor.us</SelectItem>
                <SelectItem value="rhythmverse">Rhythmverse</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant={showSavedOnly ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setShowSavedOnly(!showSavedOnly);
                setPage(1);
              }}
              className="flex items-center gap-2 h-9 flex-1 sm:flex-none"
            >
              <Heart className={`h-4 w-4 ${showSavedOnly ? 'fill-current' : ''}`} />
              <span className="hidden sm:inline">Saved Only</span>
              <span className="sm:hidden">Saved</span>
            </Button>
          </div>
        </div>
      </div>

      
      {/* Table */}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead className="w-12 sm:w-16">Cover</TableHead>
              <TableHead className="min-w-[100px]">
                <Button variant="ghost" onClick={() => handleSort('name')} className="p-0 hover:bg-transparent text-xs sm:text-sm">
                  Song <SortIcon column="name" />
                </Button>
              </TableHead>
              <TableHead className="hidden sm:table-cell min-w-[80px]">
                <Button variant="ghost" onClick={() => handleSort('artist')} className="p-0 hover:bg-transparent text-xs sm:text-sm">
                  Artist <SortIcon column="artist" />
                </Button>
              </TableHead>
              <TableHead className="hidden md:table-cell min-w-[80px]">
                <Button variant="ghost" onClick={() => handleSort('album')} className="p-0 hover:bg-transparent text-xs sm:text-sm">
                  Album <SortIcon column="album" />
                </Button>
              </TableHead>
              <TableHead className="hidden lg:table-cell min-w-[100px]">Instruments</TableHead>
              <TableHead className="hidden sm:table-cell min-w-[60px]">Source</TableHead>
              <TableHead className="w-12 sm:w-16">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 20 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-8 w-8 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8 sm:h-12 sm:w-12 rounded" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20 sm:w-32" /></TableCell>
                  <TableCell className="hidden xs:table-cell"><Skeleton className="h-4 w-16 sm:w-24" /></TableCell>
                  <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-16 sm:w-24" /></TableCell>
                  <TableCell className="hidden lg:table-cell"><Skeleton className="h-6 w-20 sm:w-32" /></TableCell>
                  <TableCell className="hidden sm:table-cell"><Skeleton className="h-6 w-12 sm:w-16" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8 sm:w-12" /></TableCell>
                </TableRow>
              ))
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Music className="h-8 w-8" />
                    <p className="text-sm">No songs found</p>
                    <p className="text-xs">Try a different search or start the fetcher</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              data.map((music) => (
                <TableRow key={music._id}>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => toggleSave(music)}
                    >
                      <Heart
                        className={`h-4 w-4 sm:h-5 sm:w-5 ${savedSongIds.has(music._id!)
                          ? 'fill-primary text-primary'
                          : 'text-muted-foreground'
                          }`}
                      />
                    </Button>
                  </TableCell>
                  <TableCell>
                    <div className="relative h-8 w-8 sm:h-12 sm:w-12 rounded">
                      {music.coverUrl ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={music.coverUrl}
                            alt={music.name}
                            className="h-8 w-8 sm:h-12 sm:w-12 rounded object-cover bg-muted"
                            style={{display: 'none'}}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              const parent = target.parentElement;
                              if (parent) {
                                const skeleton = parent.querySelector('.loading-skeleton');
                                const fallback = parent.querySelector('.error-fallback');
                                if (skeleton) {
                                  (skeleton as HTMLElement).style.display = 'none';
                                }
                                if (fallback) {
                                  (fallback as HTMLElement).style.display = 'flex';
                                }
                              }
                            }}
                            onLoad={(e) => {
                              const target = e.target as HTMLImageElement;
                              const parent = target.parentElement;
                              if (parent) {
                                const skeleton = parent.querySelector('.loading-skeleton');
                                const fallback = parent.querySelector('.error-fallback');
                                if (skeleton) {
                                  (skeleton as HTMLElement).style.display = 'none';
                                }
                                if (fallback) {
                                  (fallback as HTMLElement).style.display = 'none';
                                }
                              }
                              target.style.display = 'block';
                            }}
                          />
                          {/* Loading skeleton - shown while image is loading */}
                          <div className="loading-skeleton absolute inset-0 h-8 w-8 sm:h-12 sm:w-12 rounded">
                            <Skeleton className="h-full w-full rounded" />
                          </div>
                          {/* Error fallback - shown only on error */}
                          <div className="error-fallback absolute inset-0 h-8 w-8 sm:h-12 sm:w-12 rounded bg-muted flex items-center justify-center" style={{display: 'none'}}>
                            <div className="h-4 w-4 sm:h-6 sm:w-6 rounded bg-muted-foreground/20 flex items-center justify-center text-muted-foreground font-bold text-xs sm:text-sm">
                              ?
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="h-8 w-8 sm:h-12 sm:w-12 rounded bg-muted flex items-center justify-center">
                          <Music className="h-4 w-4 sm:h-6 sm:w-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium max-w-[100px] sm:max-w-[200px] truncate text-xs sm:text-sm">
                    {music.name}
                  </TableCell>
                  <TableCell className="max-w-[60px] sm:max-w-[150px] truncate text-xs sm:text-sm hidden sm:table-cell">{music.artist}</TableCell>
                  <TableCell className="hidden md:table-cell max-w-[60px] sm:max-w-[150px] truncate text-xs sm:text-sm">
                    {music.album}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="flex gap-1 sm:gap-2">
                      {INSTRUMENTS.map((inst) => {
                        const diff = music.instruments?.[inst];
                        if (diff === undefined) return null;
                        return (
                          <div key={inst} className="flex items-center gap-1" title={inst}>
                            <Tooltip>
                              <TooltipTrigger>
                                <DifficultyMedal level={diff} size="sm" icon={<InstrumentIcon instrument={inst} />} />
                              </TooltipTrigger>
                              <TooltipContent>
                                {inst.charAt(0).toUpperCase() + inst.slice(1)} ({diff} / 7)
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        );
                      })}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant="outline" className="capitalize text-xs">
                      {music.source}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      asChild
                      disabled={!music.downloadUrl}
                      className="h-8 w-8 sm:h-10 sm:w-10"
                    >
                      <a href={music.downloadUrl} target="_blank" rel="noopener noreferrer">
                        <Download className="h-3 w-3 sm:h-4 sm:w-4" />
                      </a>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          Page {page} of {totalPages}
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setPage(1)}
            disabled={page === 1 || loading}
            className="h-8 w-8 sm:h-9 sm:w-9"
          >
            <ChevronsLeft className="h-3 w-3 sm:h-4 sm:w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
            className="h-8 w-8 sm:h-9 sm:w-9"
          >
            <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || loading}
            className="h-8 w-8 sm:h-9 sm:w-9"
          >
            <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setPage(totalPages)}
            disabled={page === totalPages || loading}
            className="h-8 w-8 sm:h-9 sm:w-9"
          >
            <ChevronsRight className="h-3 w-3 sm:h-4 sm:w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
