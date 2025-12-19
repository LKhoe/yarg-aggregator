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
import { Checkbox } from '@/components/ui/checkbox';
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
  Drum,
  Guitar,
  Mic,
  Piano,
} from 'lucide-react';
import type { IMusic, PaginatedResponse } from '@/types';

interface MusicTableProps {
  onSelectionChange?: (selected: IMusic[]) => void;
}

const INSTRUMENTS = ['drums', 'bass', 'guitar', 'prokeys', 'vocals'] as const;

const InstrumentIcon = ({ instrument }: { instrument: string }) => {
  switch (instrument) {
    case 'drums': return <Drum className="h-4 w-4" />;
    case 'bass': return <Guitar className="h-4 w-4 rotate-180" />;
    case 'guitar': return <Guitar className="h-4 w-4" />;
    case 'prokeys': return <Piano className="h-4 w-4" />;
    case 'vocals': return <Mic className="h-4 w-4" />;
    default: return <Music className="h-4 w-4" />;
  }
};

const DifficultyBadge = ({ value }: { value: number }) => {
  const colors = [
    'bg-gray-400',
    'bg-green-500',
    'bg-lime-500',
    'bg-yellow-500',
    'bg-orange-500',
    'bg-red-500',
    'bg-purple-500',
  ];
  return (
    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-xs font-bold ${colors[value] || colors[0]}`}>
      {value}
    </span>
  );
};

export default function MusicTable({ onSelectionChange }: MusicTableProps) {
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
  const [selected, setSelected] = useState<Set<string>>(new Set());

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
  }, [page, limit, sortBy, sortOrder, debouncedQuery, source]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelected(newSelected);
    if (onSelectionChange) {
      onSelectionChange(data.filter(m => newSelected.has(m._id!)));
    }
  };

  const toggleSelectAll = () => {
    if (selected.size === data.length) {
      setSelected(new Set());
      if (onSelectionChange) onSelectionChange([]);
    } else {
      const allIds = new Set(data.map(m => m._id!));
      setSelected(allIds);
      if (onSelectionChange) onSelectionChange(data);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search songs, artists, albums..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={source || 'all'} onValueChange={(v) => setSource(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="enchor">Enchor.us</SelectItem>
            <SelectItem value="rhythmverse">Rhythmverse</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{total} songs found</span>
        {selected.size > 0 && (
          <Badge variant="secondary">{selected.size} selected</Badge>
        )}
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={data.length > 0 && selected.size === data.length}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead className="w-16">Cover</TableHead>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort('name')} className="p-0 hover:bg-transparent">
                  Song <SortIcon column="name" />
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort('artist')} className="p-0 hover:bg-transparent">
                  Artist <SortIcon column="artist" />
                </Button>
              </TableHead>
              <TableHead className="hidden md:table-cell">
                <Button variant="ghost" onClick={() => handleSort('album')} className="p-0 hover:bg-transparent">
                  Album <SortIcon column="album" />
                </Button>
              </TableHead>
              <TableHead className="hidden lg:table-cell">Instruments</TableHead>
              <TableHead className="hidden sm:table-cell">Source</TableHead>
              <TableHead className="w-16">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                  <TableCell><Skeleton className="h-12 w-12 rounded" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell className="hidden lg:table-cell"><Skeleton className="h-6 w-32" /></TableCell>
                  <TableCell className="hidden sm:table-cell"><Skeleton className="h-6 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                </TableRow>
              ))
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Music className="h-8 w-8" />
                    <p>No songs found</p>
                    <p className="text-sm">Try a different search or start the fetcher</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              data.map((music) => (
                <TableRow key={music._id} className={selected.has(music._id!) ? 'bg-accent' : ''}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(music._id!)}
                      onCheckedChange={() => toggleSelect(music._id!)}
                    />
                  </TableCell>
                  <TableCell>
                    {music.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={music.coverUrl}
                        alt={music.name}
                        className="h-12 w-12 rounded object-cover bg-muted"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">
                        <Music className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium max-w-[200px] truncate">
                    {music.name}
                  </TableCell>
                  <TableCell className="max-w-[150px] truncate">{music.artist}</TableCell>
                  <TableCell className="hidden md:table-cell max-w-[150px] truncate">
                    {music.album}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="flex gap-2">
                      {INSTRUMENTS.map((inst) => {
                        const diff = music.instruments?.[inst];
                        if (diff === undefined) return null;
                        return (
                          <div key={inst} className="flex items-center gap-1" title={inst}>
                            <InstrumentIcon instrument={inst} />
                            <DifficultyBadge value={diff} />
                          </div>
                        );
                      })}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant="outline" className="capitalize">
                      {music.source}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      asChild
                      disabled={!music.downloadUrl}
                    >
                      <a href={music.downloadUrl} target="_blank" rel="noopener noreferrer">
                        <Download className="h-4 w-4" />
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
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Page {page} of {totalPages}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setPage(1)}
            disabled={page === 1 || loading}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || loading}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setPage(totalPages)}
            disabled={page === totalPages || loading}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
