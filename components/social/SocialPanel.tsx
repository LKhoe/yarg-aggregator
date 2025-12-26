'use client';

import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Send, Download } from 'lucide-react';
import { toast } from 'sonner';
import { useSavedSongs } from '@/context/SavedSongsContext';

interface ConnectedDevice {
  deviceId: string;
  deviceName: string;
  lastSeen: string;
}

interface SocialPanelProps {
  deviceId: string;
  deviceName: string;
}

export default function SocialPanel({ deviceId, deviceName }: SocialPanelProps) {
  const [onlineUsers, setOnlineUsers] = useState<ConnectedDevice[]>([]);
  const [socket, setSocket] = useState<any>(null);
  const { savedSongs, addSong } = useSavedSongs();

  useEffect(() => {
    let newSocket: any;

    const initSocket = async () => {
      try {
        await fetch('/api/socket');

        newSocket = io({
          path: '/api/socket',
          addTrailingSlash: false,
        });

        newSocket.on('connect', () => {
          console.log('Social Socket connected', newSocket.id);
          // Register immediately upon connection
          if (deviceId && deviceName) {
            newSocket.emit('register', { deviceId, deviceName });
          }
        });

        newSocket.on('devices:update', (devices: ConnectedDevice[]) => {
          setOnlineUsers(devices.filter(d => d.deviceId !== deviceId));
        });

        newSocket.on('songs:receive', (data: { fromDeviceName: string, songs: any[] }) => {
          const { fromDeviceName, songs } = data;

          toast(
            <div className="flex flex-col gap-2 w-full">
              <p className="font-semibold">Received {songs.length} songs from {fromDeviceName}</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="w-full"
                  onClick={async () => {
                    let added = 0;
                    for (const song of songs) {
                      await addSong({
                        _id: song.musicId,
                        name: song.name,
                        artist: song.artist,
                        // Fill dummy values for required fields that might not be needed for just saving if backend handles it
                        downloadUrl: '',
                        source: 'enchor', // We don't know source if not sent
                        instruments: {}
                      } as any);
                      added++;
                    }
                    toast.success(`Imported ${added} songs to your collection`);
                  }}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Import All
                </Button>
              </div>
            </div>,
            {
              duration: 10000, // Show for longer
            }
          );
        });

        setSocket(newSocket);

      } catch (error) {
        console.error('Failed to initialize social socket', error);
      }
    };

    if (deviceId && deviceName) {
      initSocket();
    }

    return () => {
      if (newSocket) newSocket.disconnect();
    };
  }, [deviceId, deviceName, addSong]);

  const sendSongs = (targetDeviceId: string, targetDeviceName: string) => {
    if (!socket) return;
    if (savedSongs.length === 0) {
      toast.error("You don't have any saved songs to share.");
      return;
    }

    // Emit event
    socket.emit('songs:send', {
      toDeviceId: targetDeviceId,
      songs: savedSongs
    });

    toast.success(`Sent ${savedSongs.length} songs to ${targetDeviceName}`);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Online Users
        </CardTitle>
        <CardDescription>
          Share your collection with others
        </CardDescription>
      </CardHeader>
      <CardContent>
        {onlineUsers.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-4">
            No other users online
          </div>
        ) : (
          <div className="h-[200px] w-full rounded-md border p-4 overflow-y-auto">
            <div className="space-y-4">
              {onlineUsers.map((user) => (
                <div key={user.deviceId} className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="font-medium text-sm">{user.deviceName}</span>
                    <span className="text-xs text-muted-foreground">Online</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => sendSongs(user.deviceId, user.deviceName)}
                    title="Send your saved songs"
                  >
                    <Send className="h-3 w-3 mr-1" />
                    Share
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
