'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2, Play, RefreshCw, FlaskConical } from 'lucide-react';
import { toast } from 'sonner';

type ProviderSource = 'all' | 'enchor' | 'rhythmverse';

interface JobProgress {
  status: string;
  progress: number;
  currentSource?: string;
  currentPage?: number;
  totalPages?: number;
  songsProcessed?: number;
  totalFetched?: number;
  totalSaved?: number;
  errors?: string[];
}

export default function ProviderPanel() {
  const [source, setSource] = useState<ProviderSource>('all');
  const [isRunning, setIsRunning] = useState(false);
  const [forceSync, setForceSync] = useState(false);
  const [maxPages, setMaxPages] = useState(10);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<JobProgress | null>(null);

  const pollProgress = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/providers?jobId=${id}`);
      if (response.ok) {
        const data = await response.json();
        setProgress(data);
        
        if (data.status === 'completed' || data.status === 'failed') {
          setIsRunning(false);
        } else {
          // Continue polling
          setTimeout(() => pollProgress(id), 1000);
        }
      }
    } catch (error) {
      console.error('Error polling progress:', error);
    }
  }, []);

  useEffect(() => {
    if (jobId && isRunning) {
      pollProgress(jobId);
    }
  }, [jobId, isRunning, pollProgress]);

  const testProvider = async () => {
    if (source === 'all') {
      toast.error('Please select a specific source to test');
      return;
    }
    
    setIsRunning(true);
    try {
      const response = await fetch('/api/providers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source }),
      });
      
      const data = await response.json();
      console.log('Test result:', data);
      
      if (response.ok) {
        toast.success(`Test successful! Fetched ${data.count} items. Check console for details.`);
      } else {
        toast.error(data.error || 'Test failed');
      }
    } catch (error) {
      console.error('Test failed:', error);
      toast.error('Test failed. Check console for details.');
    } finally {
      setIsRunning(false);
    }
  };

  const startFetch = async () => {
    setIsRunning(true);
    setProgress(null);

    try {
      const response = await fetch('/api/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, maxPages, forceSync }),
      });

      if (response.ok) {
        const data = await response.json();
        setJobId(data.jobId);
      } else {
        setIsRunning(false);
      }
    } catch (error) {
      console.error('Error starting fetch:', error);
      toast.error('Failed to start fetch job');
      setIsRunning(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-blue-500';
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
                
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={testProvider} 
                  disabled={isRunning || source === 'all'} 
                  title="Test Provider (1 page)"
                  className="shrink-0"
                >
                  <FlaskConical className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox 
                id="forceSync" 
                checked={forceSync} 
                onCheckedChange={(c) => setForceSync(!!c)} 
              />
              <Label 
                htmlFor="forceSync" 
                className="text-xs text-muted-foreground cursor-pointer font-normal flex-1"
              >
                Force Full Sync (Ignore Resume)
              </Label>
            </div>

            <div className="space-y-1">
                <label className="text-sm font-medium">Max Pages</label>
                <Input 
                    type="number" 
                    min={1} 
                    value={maxPages} 
                    onChange={(e) => setMaxPages(parseInt(e.target.value) || 1)}
                />
            </div>

            <Button onClick={startFetch} disabled={isRunning} className="w-full cursor-pointer">
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
                <span>Progress</span>
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

            {progress.currentPage && progress.totalPages && (
              <div className="flex justify-between text-sm">
                <span>Page</span>
                <span>{progress.currentPage} / {progress.totalPages}</span>
              </div>
            )}

            {(progress.songsProcessed || progress.totalFetched) && (
              <div className="flex justify-between text-sm">
                <span>Songs Processed</span>
                <span>{progress.songsProcessed || progress.totalFetched}</span>
              </div>
            )}

            {progress.totalSaved !== undefined && (
              <div className="flex justify-between text-sm">
                <span>Songs Saved</span>
                <span>{progress.totalSaved}</span>
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

