'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Play, RefreshCw, Square } from 'lucide-react';
import { toast } from 'sonner';

type ProviderSource = 'all' | 'enchor' | 'rhythmverse';

interface JobProgress {
  status: string;
  progress: number;
  currentSource?: string;
  currentPage?: number;
  totalPages?: number;
  songsProcessed?: number;
  totalSongs?: number;
  totalAvailable?: number;
  totalFetched?: number;
  totalSaved?: number;
  jobsCompleted?: number;
  jobsTotal?: number;
  failedJobIndex?: number;
  errors?: string[];
}

interface ProviderStat {
  name: string;
  lastSuccessfulFetch?: string;
  isRunning: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export default function ProviderPanel() {
  const [source, setSource] = useState<ProviderSource>('all');
  const [runningSources, setRunningSources] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [stats, setStats] = useState<ProviderStat[]>([]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/providers');
      if (response.ok) {
        const data = await response.json();
        setStats(data);

        // Update running sources based on stats
        const currentlyRunning: Set<string> = new Set(
          data
            .filter((s: ProviderStat) => s.isRunning)
            .map((s: ProviderStat) => s.name as string)
        );
        setRunningSources(currentlyRunning);

        // Update progress based on running sources (simplified since queue system removed)
        const runningProvider = data.find((s: ProviderStat) => s.isRunning);

        if (runningProvider) {
          // Simple progress indication since no queue stats available
          setProgress({
            status: 'running',
            progress: 50, // Generic progress since we can't track queue
            currentSource: runningProvider.name,
          });
        } else if (!data.some((s: ProviderStat) => s.isRunning)) {
          // No providers are running
          if (runningSources.size > 0) {
            setRunningSources(new Set());
            setProgress(prev => {
              if (prev?.status === 'running') {
                toast.success('Provider fetch completed!');
                return { ...prev, status: 'completed', progress: 100 };
              }
              return prev;
            });
          }
        }
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const stopProvider = async (source: string) => {
    try {
      const response = await fetch('/api/providers', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        toast.error(`Failed to stop ${source}: ${errorData.error}`);
      } else {
        toast.success(`Stopped ${source}`);
        // Remove from running sources immediately
        setRunningSources(prev => {
          const newSet = new Set(prev);
          newSet.delete(source);
          return newSet;
        });
        // Clear progress if this was the only running provider
        if (runningSources.size === 1) {
          setProgress(null);
        }
        // Refresh stats
        await fetchStats();
      }
    } catch (error) {
      toast.error(`Failed to stop ${source}: ${error}`);
    }
  };

  const startFetch = async () => {
    // Determine which sources to fetch
    const sourcesToFetch = source === 'all' 
      ? ['enchor', 'rhythmverse'] 
      : [source];

    // Filter out already running sources
    const availableSources = sourcesToFetch.filter(src => !runningSources.has(src));

    if (availableSources.length === 0) {
      toast.error('Selected sources are already running');
      return;
    }

    // Set initial progress state
    setProgress({
      status: 'starting',
      progress: 0,
      currentSource: source !== 'all' ? source : 'multiple',
      jobsCompleted: 0,
      jobsTotal: availableSources.length,
    });

    // Process each source sequentially
    for (const src of availableSources) {
      try {
        setRunningSources(prev => new Set([...prev, src]));
        setProgress(prev => ({
          ...prev,
          status: 'running',
          currentSource: src,
          progress: 0,
        }));

        const response = await fetch('/api/providers/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: src }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to start fetch');
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error('No response body');
        }

        let totalPages = 0;
        let completedPages = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                switch (data.type) {
                  case 'start':
                    toast.success(`Started fetching ${src}`);
                    break;
                  case 'progress':
                    console.log(data.message);
                    break;
                  case 'page_complete':
                    totalPages = Math.max(totalPages, data.page);
                    completedPages = data.page;
                    const progress = totalPages > 0 ? Math.round((completedPages / totalPages) * 100) : 0;
                    setProgress(prev => ({
                      ...prev,
                      progress,
                      currentPage: data.page,
                      totalPages: totalPages,
                      songsProcessed: data.totalSongsProcessed,
                      status: 'running',
                    }));
                    break;
                  case 'complete':
                    toast.success(`Completed fetching ${src}: ${data.totalSongsProcessed} songs processed`);
                    setProgress(prev => ({
                      ...prev,
                      status: 'completed',
                      progress: 100,
                      songsProcessed: data.totalSongsProcessed,
                    }));
                    break;
                  case 'error':
                    toast.error(`Error fetching ${src}: ${data.message}`);
                    setProgress(prev => ({
                      ...prev,
                      status: 'error',
                      errors: [data.message],
                      progress: prev?.progress || 0,
                    }));
                    break;
                  case 'retry':
                    console.log(`Retrying page ${data.page} for ${src}`);
                    break;
                }
              } catch (e) {
                console.error('Error parsing SSE data:', e);
              }
            }
          }
        }

        // Refresh stats after completion
        await fetchStats();

      } catch (error: any) {
        console.error(`Error fetching ${src}:`, error);
        toast.error(`Failed to fetch ${src}: ${error.message}`);
        setProgress(prev => ({ 
          ...prev, 
          status: 'error', 
          errors: prev?.errors ? [...prev.errors, error.message] : [error.message],
          progress: prev?.progress || 0,
        }));
      } finally {
        setRunningSources(prev => {
          const newSet = new Set(prev);
          newSet.delete(src);
          return newSet;
        });
      }
    }

    // Final completion
    setProgress(prev => {
      if (prev?.status !== 'error') {
        return { ...prev, status: 'completed', progress: 100 };
      }
      return prev;
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-blue-500';
      case 'starting': return 'bg-yellow-500';
      case 'completed': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const formatLastFetchTime = (lastFetchedAt?: string) => {
    if (!lastFetchedAt) return 'Never fetched';

    const date = new Date(lastFetchedAt);
    if (isNaN(date.getTime())) return 'Invalid date';
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <TooltipProvider>
      <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Provider Control
        </CardTitle>
        <CardDescription>
          Fetch music charts from Enchor.us and Rhythmverse
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-4">
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Source</label>
              <div className="flex gap-2">

                <Select value={source} onValueChange={(v) => setSource(v as ProviderSource)}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    <SelectItem value="enchor">Enchor.us</SelectItem>
                    <SelectItem value="rhythmverse">Rhythmverse</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-2">
                {['enchor', 'rhythmverse'].map((src) => {
                  const stat = stats.find((s) => s.name === src);

                  return (
                    <div key={src} className="bg-muted/50 p-2 rounded-md border text-sm">
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground">
                          {src === 'enchor' ? 'Enchor.us' : 'Rhythmverse'}
                        </p>
                        <div className="flex gap-1">
                          <input
                            type="file"
                            id={`upload-${src}`}
                            className="hidden"
                            accept=".zip"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const formData = new FormData();
                                formData.append('file', file);
                                formData.append('source', src);

                                // Start progress tracking
                                setProgress({
                                  status: 'starting',
                                  progress: 0,
                                  currentSource: src,
                                  jobsCompleted: 0,
                                  jobsTotal: 1,
                                });

                                // Start streaming upload
                                fetch('/api/providers/upload/stream', {
                                  method: 'POST',
                                  body: formData,
                                }).then(async (response) => {
                                  if (!response.ok) {
                                    throw new Error('Upload failed');
                                  }

                                  const reader = response.body?.getReader();
                                  const decoder = new TextDecoder();

                                  if (!reader) {
                                    throw new Error('No response body');
                                  }

                                  let totalBatches = 0;
                                  let completedBatches = 0;

                                  while (true) {
                                    const { done, value } = await reader.read();
                                    if (done) break;

                                    const chunk = decoder.decode(value);
                                    const lines = chunk.split('\n');

                                    for (const line of lines) {
                                      if (line.startsWith('data: ')) {
                                        try {
                                          const data = JSON.parse(line.slice(6));
                                          
                                          switch (data.type) {
                                            case 'start':
                                              setProgress(prev => ({
                                                ...prev,
                                                status: 'running',
                                                progress: 0,
                                              }));
                                              break;
                                            case 'progress':
                                              console.log(data.message);
                                              break;
                                            case 'batch_complete':
                                              totalBatches = Math.max(totalBatches, data.totalBatches);
                                              completedBatches = data.batch;
                                              const progress = totalBatches > 0 ? Math.round((completedBatches / totalBatches) * 100) : 0;
                                              setProgress(prev => ({
                                                ...prev,
                                                progress,
                                                currentPage: data.batch,
                                                totalPages: totalBatches,
                                                songsProcessed: data.totalSaved,
                                                status: 'running',
                                              }));
                                              break;
                                            case 'complete':
                                              toast.success(data.message);
                                              setProgress(prev => ({
                                                ...prev,
                                                status: 'completed',
                                                progress: 100,
                                                songsProcessed: data.totalSaved,
                                              }));
                                              fetchStats(); // Refresh stats after upload
                                              break;
                                            case 'error':
                                              toast.error(`Upload error: ${data.message}`);
                                              setProgress(prev => ({
                                                ...prev,
                                                status: 'error',
                                                errors: [data.message],
                                                progress: prev?.progress || 0,
                                              }));
                                              break;
                                            case 'warning':
                                              console.warn(data.message);
                                              break;
                                          }
                                        } catch (e) {
                                          console.error('Error parsing SSE data:', e);
                                        }
                                      }
                                    }
                                  }
                                }).catch((error) => {
                                  toast.error(`Upload failed: ${error.message}`);
                                  setProgress(prev => ({
                                    ...prev,
                                    status: 'error',
                                    errors: [error.message],
                                    progress: prev?.progress || 0,
                                  }));
                                });
                              }
                              // Reset the input so the same file can be selected again if needed
                              e.target.value = '';
                            }}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={() => document.getElementById(`upload-${src}`)?.click()}
                            title="Upload Zip"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="w-3 h-3"
                            >
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="17 8 12 3 7 8" />
                              <line x1="12" x2="12" y1="3" y2="15" />
                            </svg>
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge
                              variant={runningSources.has(src) ? "default" : "secondary"}
                              className="text-xs h-4"
                            >
                              {runningSources.has(src) ? 'Running' : 'Idle'}
                            </Badge>
                          </TooltipTrigger>
                          {!runningSources.has(src) && (
                            <TooltipContent>
                              <p>Last fetch: {formatLastFetchTime(stat?.lastSuccessfulFetch)}</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                        {runningSources.has(src) && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 text-red-500 hover:text-red-600 hover:bg-red-50"
                                onClick={() => stopProvider(src)}
                                title={`Stop ${src}`}
                              >
                                <Square className="w-3 h-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Stop {src}</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={startFetch} disabled={runningSources.size > 0} className="flex-1 cursor-pointer">
                {runningSources.size > 0 ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Fetching...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Start Fetch
                  </>
                )}
              </Button>
              <Button 
                variant="outline" 
                onClick={fetchStats}
                disabled={runningSources.size > 0}
                className="cursor-pointer"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {progress && (
          <div className="space-y-3 pt-4 border-t">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Status</span>
              <Badge className={getStatusColor(progress.status)}>
                {progress.status}
              </Badge>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Total Progress</span>
                <span>{progress.progress || 0}%</span>
              </div>
              <Progress value={progress.progress || 0} />
            </div>

            {progress.currentSource && (
              <div className="flex justify-between text-sm">
                <span>Current Source</span>
                <span className="capitalize">{progress.currentSource}</span>
              </div>
            )}

            {progress.errors && progress.errors.length > 0 && (
              <div className="mt-2 p-2 bg-red-50 dark:bg-red-950 rounded text-sm">
                <p className="font-medium text-red-600 dark:text-red-400">Errors:</p>
                <ul className="list-disc pl-4 text-red-500 dark:text-red-300">
                  {progress.errors.slice(0, 3).map((err, i) => (
                    <li key={i} className="truncate">{err}</li>
                  ))}
                  {progress.errors.length > 3 && (
                    <li>...and {progress.errors.length - 3} more</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
    </TooltipProvider>
  );
}

