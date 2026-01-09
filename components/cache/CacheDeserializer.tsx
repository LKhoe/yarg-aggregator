'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, Music, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { SongEntry } from '@/services/cache-reader/Song/Entries/SongEntry';
import deserializeCache from '@/services/cache-reader/deserializer';

export default function CacheDeserializer() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [songs, setSongs] = useState<SongEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
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
      // Automatically start deserialization after file selection
      handleDeserialize(file);
    }
  };

  const handleDeserialize = async (file?: File) => {
    const fileToProcess = file || selectedFile;
    if (!fileToProcess) {
      toast.error('Please select a file first');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSongs([]);

    try {
      const songEntries = await deserializeCache(fileToProcess);
      setSongs(songEntries);
      toast.success(`Successfully loaded ${songEntries.length} songs from cache`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to deserialize cache file';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Cache Deserializer
        </CardTitle>
        <CardDescription>
          Upload a YARG cache file to view the list of songs contained within.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* File Input */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Button
              onClick={handleImportClick}
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Deserialize
                </>
              )}
            </Button>
          </div>
          {selectedFile && (
            <p className="text-sm text-muted-foreground">
              Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
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
            <p className="text-sm text-muted-foreground">Deserializing cache file...</p>
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
              Successfully loaded {songs.length} songs from the cache file.
            </AlertDescription>
          </Alert>
        )}

        {/* Songs List */}
        {songs.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Music className="h-5 w-5" />
              Songs ({songs.length})
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
                          {song._metadata.Artist || 'Unknown Artist'}
                        </p>
                      </div>
                      <div className="text-right text-xs text-muted-foreground ml-2">
                        {song._metadata.Album && (
                          <p className="truncate max-w-32">{song._metadata.Album}</p>
                        )}
                        {song._metadata.Genre && (
                          <p className="truncate max-w-32">{song._metadata.Genre}</p>
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
