'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Send, Download, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useSavedSongs } from '@/context/SavedSongsContext';
import { Badge } from '@/components/ui/badge';

interface ConnectedDevice {
  deviceId: string;
  deviceName: string;
  isOnline: boolean;
  lastSeenAt: string;
}

interface SharedMusicItem {
  _id: string;
  fromDeviceId: string;
  fromDeviceName: string;
  songs: {
    musicId: string;
    name: string;
    artist: string;
  }[];
  createdAt: string;
}

interface SocialPanelProps {
  deviceId: string;
  deviceName: string;
}

export default function SocialPanel({ deviceId, deviceName }: SocialPanelProps) {
  const [recentUsers, setRecentUsers] = useState<ConnectedDevice[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { savedSongs, addSong } = useSavedSongs();

  // Fetch user list
  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch(`/api/device?exclude=${deviceId}`);
      if (response.ok) {
        const data = await response.json();
        setRecentUsers(data.devices || []);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  }, [deviceId]);

  // Refresh button handler
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchUsers();
    setIsRefreshing(false);
  };

  // Poll for incoming shared music
  const checkForSharedMusic = useCallback(async () => {
    try {
      const response = await fetch(`/api/social/shared?deviceId=${deviceId}`);
      if (response.ok) {
        const data = await response.json();
        const shares: SharedMusicItem[] = data.shares || [];

        // Show toast for each new share
        shares.forEach((share) => {
          toast(
            <div className="flex flex-col gap-2 w-full">
              <p className="font-semibold">Received {share.songs.length} songs from {share.fromDeviceName}</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="w-full"
                  onClick={async () => {
                    let added = 0;
                    for (const song of share.songs) {
                      await addSong({
                        _id: song.musicId,
                        name: song.name,
                        artist: song.artist,
                        // Fill dummy values for required fields
                        downloadUrl: '',
                        source: 'enchor',
                        instruments: {}
                      } as any);
                      added++;
                    }

                    // Mark as accepted
                    await fetch('/api/social/shared', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ shareId: share._id, status: 'accepted' }),
                    });

                    toast.success(`Imported ${added} songs to your collection`);
                  }}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Import All
                </Button>
              </div>
            </div>,
            {
              duration: 10000,
            }
          );
        });
      }
    } catch (error) {
      console.error('Failed to check for shared music:', error);
    }
  }, [deviceId, addSong]);

  // Initial fetch only
  useEffect(() => {
    if (!deviceId || !deviceName) return;

    // Initial fetch
    fetchUsers();
    checkForSharedMusic();
  }, [deviceId, deviceName, fetchUsers, checkForSharedMusic]);

  const sendSongs = async (targetDeviceId: string, targetDeviceName: string) => {
    if (savedSongs.length === 0) {
      toast.error("You don't have any saved songs to share.");
      return;
    }

    try {
      const response = await fetch('/api/social/shared', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromDeviceId: deviceId,
          toDeviceId: targetDeviceId,
          songs: savedSongs.map(song => ({
            musicId: song.musicId,
            name: song.name,
            artist: song.artist,
          })),
        }),
      });

      if (response.ok) {
        toast.success(`Sent ${savedSongs.length} songs to ${targetDeviceName}`);
      } else {
        const error = await response.json();
        toast.error(`Failed to send songs: ${error.error}`);
      }
    } catch (error) {
      toast.error('Failed to send songs');
      console.error('Error sending songs:', error);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Recent Users
            </CardTitle>
            <CardDescription>
              Share your collection with others
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {recentUsers.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-4">
            No recent users found
          </div>
        ) : (
          <div className="h-[180px] sm:h-[200px] w-full rounded-md border p-3 sm:p-4 overflow-y-auto">
            <div className="space-y-3 sm:space-y-4">
              {recentUsers.map((user: ConnectedDevice) => (
                <div key={user.deviceId} className="flex items-center justify-between gap-2">
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="font-medium text-xs sm:text-sm truncate">{user.deviceName}</span>
                    <div className="flex items-center gap-1">
                      <Badge
                        variant={user.isOnline ? "default" : "secondary"}
                        className="text-xs h-4 px-2"
                      >
                        {user.isOnline ? 'Online' : 'Offline'}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => sendSongs(user.deviceId, user.deviceName)}
                    title="Send your saved songs"
                    className="flex-shrink-0 h-8 w-16 sm:h-9 sm:w-auto"
                  >
                    <Send className="h-3 w-3 sm:h-3 sm:w-3 mr-1" />
                    <span className="hidden sm:inline">Share</span>
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
