'use client';

import { io } from 'socket.io-client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Play, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { NumberInput } from '@/components/ui/number-input';

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
  source: string;
  totalFetched: number;
  totalAvailable: number;
  lastFetchedAt?: string;
  isRunning: boolean;
  failedJobs: any[];
}

export default function ProviderPanel() {
  const [source, setSource] = useState<ProviderSource>('all');
  const [isRunning, setIsRunning] = useState(false);
  const [recordsToFetch, setRecordsToFetch] = useState(10);
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [stats, setStats] = useState<ProviderStat[]>([]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/providers');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, []);

  useEffect(() => {
    let socket: any;

    const initSocket = async () => {
      try {
        await fetch('/api/socket');

        socket = io({
          path: '/api/socket',
          addTrailingSlash: false,
        });

        socket.on('connect', () => {
          console.log('Socket connected', socket.id);
        });

        socket.on('provider:progress', (data: any) => {
          setIsRunning(true);
          const { source, page, count, active, completed, failed, waiting, delayed, total } = data;

          // Calculate percentage based on completed jobs vs total jobs
          const percent = total > 0 ? Math.round(((completed) / total) * 100) : 0;

          setProgress({
            status: 'running',
            progress: percent,
            currentSource: source,
            currentPage: page,
            songsProcessed: count,
            jobsCompleted: completed,
            jobsTotal: total,
            totalSaved: completed * 10 + count,
          });
        });

        socket.on('provider:failed', (data: any) => {
          setIsRunning(false);
          const { source, page, error } = data;
          setProgress({
            status: 'failed',
            progress: 0,
            currentSource: source,
            currentPage: page,
            songsProcessed: 0,
            jobsCompleted: 0,
            jobsTotal: 0,
            totalSaved: 0,
          });
          toast.error(`Provider fetch failed for ${source} page ${page}: ${error}`);
        });

        socket.on('provider:drained', () => {
          setProgress(prev => prev ? { ...prev, status: 'completed', progress: 100 } : null);
          toast.success('Provider fetch completed!');
          fetchStats(); // Refresh stats
          setIsRunning(false);
        });

      } catch (error) {
        console.error('Failed to initialize socket', error);
      }
    };

    initSocket();

    return () => {
      if (socket) socket.disconnect();
    };
  }, [fetchStats]);

  // Check for running jobs on load (Late Joiner)
  useEffect(() => {
    if (stats.length > 0) {
      const runningProvider = stats.find(s => s.isRunning);
      if (runningProvider && (runningProvider as any).queueStats) {
        setIsRunning(true);
        const qs = (runningProvider as any).queueStats;
        const total = qs.total;
        const completed = qs.completed;
        const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

        setProgress({
          status: 'running',
          progress: percent,
          currentSource: runningProvider.source,
          jobsCompleted: completed,
          jobsTotal: total,
        });
      }
    }
  }, [stats]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const startFetch = async () => {
    setIsRunning(true);
    // Set initial progress state to show the UI immediately
    setProgress({
      status: 'starting',
      progress: 0,
      currentSource: source !== 'all' ? source : undefined,
      jobsCompleted: 0,
      jobsTotal: 0, // Will be updated by socket
    });

    try {
      const response = await fetch('/api/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, amount: recordsToFetch }),
      });

      if (!response.ok) {
        setIsRunning(false);
        setProgress(null);
        toast.error('Failed to start fetch job');
      }
    } catch (error) {
      toast.error(`Failed to start fetch job: ${error}`);
      setIsRunning(false);
      setProgress(null);
    }
  };

  const retryFailedJobs = async (targetSource: string) => {
    setIsRunning(true);
    setProgress({
      status: 'retrying',
      progress: 0,
      currentSource: targetSource,
      jobsCompleted: 0,
      jobsTotal: 0,
    });

    try {
      const response = await fetch('/api/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: targetSource, retryFailed: true }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setIsRunning(false);
        setProgress(null);
        toast.error(`Failed to retry jobs: ${errorData.error}`);
      } else {
        toast.success(`Retrying failed jobs for ${targetSource}`);
      }
    } catch (error) {
      toast.error(`Failed to retry jobs: ${error}`);
      setIsRunning(false);
      setProgress(null);
    }
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

  return (
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
                  const stat = stats.find((s) => s.source === src);
                  const hasFailedJobs = stat?.failedJobs && stat.failedJobs.length > 0;

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

                                toast.promise(
                                  fetch('/api/providers/upload', {
                                    method: 'POST',
                                    body: formData,
                                  }).then(async (res) => {
                                    if (!res.ok) throw new Error(await res.text());
                                    return res.json();
                                  }),
                                  {
                                    loading: 'Uploading...',
                                    success: (data) => {
                                      fetchStats();
                                      return data.message;
                                    },
                                    error: (err) => `Upload failed: ${err.message}`,
                                  }
                                );
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
                      <div className="flex items-baseline gap-1">
                        <span className="text-sm font-semibold">{stat?.totalFetched || 0}</span>
                        <span className="text-[10px] text-muted-foreground italic">/ {stat?.totalAvailable || 0}</span>
                      </div>
                      {stat?.totalAvailable ? (
                        <div className="w-full bg-secondary h-1 rounded-full mt-1 overflow-hidden">
                          <div
                            className="bg-primary h-full transition-all duration-500"
                            style={{ width: `${Math.min(100, (stat.totalFetched / stat.totalAvailable) * 100)}%` }}
                          />
                        </div>
                      ) : null}

                      {hasFailedJobs && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full mt-2 h-6 text-xs bg-red-50 hover:bg-red-100 text-red-600 border-red-200 dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-400 dark:border-red-800"
                          onClick={() => retryFailedJobs(src)}
                          disabled={isRunning}
                        >
                          Retry {stat.failedJobs.length} Jobs
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Records to Fetch</label>
              <NumberInput
                value={recordsToFetch}
                min={1}
                max={100}
                defaultValue={10}
                onValueChange={(v) => setRecordsToFetch(v || 1)}
              />
            </div>

            <Button onClick={startFetch} disabled={isRunning || true} className="w-full cursor-pointer">
              {isRunning ? (
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
  );
}

