'use client';

import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import MusicTable from '@/components/data-table/MusicTable';
import ProviderPanel from '@/components/providers/ProviderPanel';
import SocialPanel from '@/components/social/SocialPanel';
import SavedSongs from '@/components/collection/SavedSongs';
import CacheDeserializer from '@/components/cache/CacheDeserializer';
import { SavedSongsProvider } from '@/context/SavedSongsContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Music, Zap, Share2, X, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';

export default function HomePage() {
  const [deviceId, setDeviceId] = useState<string>('');
  const [deviceName, setDeviceName] = useState('');
  const [showDeviceDialog, setShowDeviceDialog] = useState(false);
  const [totalSongs, setTotalSongs] = useState(0);
  const [sharedSongs, setSharedSongs] = useState<any[]>([]);
  const [showSharedList, setShowSharedList] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Get or generate device ID
    let id = localStorage.getItem('deviceId');
    if (!id) {
      id = uuidv4();
      localStorage.setItem('deviceId', id);
    }
    setDeviceId(id);

    // Check if device name is set
    const name = localStorage.getItem('deviceName');
    if (!name) {
      setShowDeviceDialog(true);
    } else {
      setDeviceName(name);
    }
  }, []);

  const saveDeviceName = async () => {
    if (!deviceName.trim()) return;

    localStorage.setItem('deviceName', deviceName);
    setShowDeviceDialog(false);

    // Register with backend
    try {
      await fetch('/api/device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, deviceName }),
      });
    } catch (error) {
      console.error('Error registering device:', error);
    }
  };

  // Handle accepting shared songs
  const handleAcceptShare = async (share: any) => {
    try {
      // Add songs to saved collection (this would need to be integrated with SavedSongsContext)
      // For now, just mark as accepted
      await fetch('/api/social/shared', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareId: share._id, status: 'accepted' }),
      });

      // Remove from the list
      setSharedSongs(prev => prev.filter(s => s._id !== share._id));
      toast.success(`Accepted ${share.songs.length} songs from ${share.fromDeviceName}`);
    } catch (error) {
      toast.error('Failed to accept shared songs');
      console.error('Error accepting share:', error);
    }
  };

  function handleRejectShare(share: any): void {
    try{
      fetch('/api/social/shared', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareId: share._id, status: 'rejected' }),
      });
      // Remove from the list
      setSharedSongs(prev => prev.filter(s => s._id !== share._id));
      toast.success(`Rejected ${share.songs.length} songs from ${share.fromDeviceName}`);
    } catch (error) {
      toast.error('Failed to reject shared songs');
      console.error('Error rejecting share:', error);
    }
  }

  // Fetch shared songs on page load
  useEffect(() => {
    if (!deviceId) return;

    const fetchSharedSongs = async () => {
      try {
        const response = await fetch(`/api/social/shared?deviceId=${deviceId}`);
        if (response.ok) {
          const data = await response.json();
          setSharedSongs(data.shares || []);
        }
      } catch (error) {
        console.error('Failed to fetch shared songs:', error);
      }
    };

    fetchSharedSongs();
  }, [deviceId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/10">
      {/* Decorative gradient orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-accent/15 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 right-1/3 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-primary/20 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-2 sm:px-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-primary via-accent to-primary/60 text-primary-foreground shadow-lg shadow-primary/30">
              <Music className="h-4 w-4 sm:h-6 sm:w-6" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                YARG Aggregator
              </h1>
              <p className="text-xs text-muted-foreground hidden lg:block">Music chart library</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-primary/10 border border-primary/20 shadow-lg shadow-primary/30">
              <Zap className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
              <span className="text-xs sm:text-sm text-foreground/80 truncate max-w-[80px] sm:max-w-none">
                {deviceName || 'Not registered'}
              </span>
            </div>
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSharedList(!showSharedList)}
                className="relative p-2 h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-primary/10 border border-primary/20 shadow-lg shadow-primary/30 hover:bg-primary/20"
              >
                <Share2 className="h-4 w-4 text-primary" />
                {sharedSongs.length > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
                  >
                    {sharedSongs.length}
                  </Badge>
                )}
              </Button>
              
              {/* Shared Songs List - Overlay */}
              {showSharedList && (
                <div className="absolute top-full right-0 mt-2 z-50 w-80 max-w-[90vw]">
                  <div className="bg-background/99 backdrop-blur-md border border-primary/20 rounded-lg shadow-lg">
                    <div className="flex items-center justify-between p-3 border-b border-primary/10">
                      <h3 className="text-sm font-semibold text-foreground">Shared Songs</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowSharedList(false)}
                        className="h-6 w-6 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="p-3">
                      {sharedSongs.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No shared songs received</p>
                      ) : (
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {sharedSongs.map((share) => (
                            <div key={share._id} className="border border-primary/10 rounded-lg bg-primary/5">
                              <div className="flex items-center justify-between p-2">
                                <div className="flex flex-col min-w-0 flex-1">
                                  <span className="text-xs font-medium truncate">{share.fromDeviceName}</span>
                                  <span className="text-xs text-muted-foreground">{share.songs.length} songs</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setExpandedItems(prev => {
                                        const newSet = new Set(prev);
                                        if (newSet.has(share._id)) {
                                          newSet.delete(share._id);
                                        } else {
                                          newSet.add(share._id);
                                        }
                                        return newSet;
                                      });
                                    }}
                                    className="flex-shrink-0 h-6 px-2 text-xs"
                                  >
                                    {expandedItems.has(share._id) ? (
                                      <ChevronUp className="h-3 w-3" />
                                    ) : (
                                      <ChevronDown className="h-3 w-3" />
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleAcceptShare(share)}
                                    className="flex-shrink-0 h-6 px-2 text-xs"
                                  >
                                    <Download className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleRejectShare(share)}
                                    className="flex-shrink-0 h-6 px-2 text-xs"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                              
                              {/* Expanded song details */}
                              {expandedItems.has(share._id) && (
                                <div className="border-t border-primary/10 p-2 bg-background/50">
                                  <div className="space-y-1 max-h-32 overflow-y-auto">
                                    {share.songs.map((song: any, index: number) => (
                                      <div key={index} className="text-xs text-muted-foreground">
                                        <span className="font-medium text-foreground">{song.name}</span> - {song.artist}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto py-4 sm:py-8 px-2 sm:px-4 relative z-10">
        <SavedSongsProvider deviceId={deviceId} deviceName={deviceName}>
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            {/* Main Content Area */}
            <div className="space-y-6">
              {/* Hero Section */}
              <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-primary/20 via-accent/10 to-primary/5 p-4 sm:p-6 border border-primary/20">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent" />
                <div className="relative">
                  <h2 className="text-xl sm:text-2xl font-bold mb-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                    Welcome to YARG Aggregator
                    {totalSongs > 0 && (
                      <span className="text-sm sm:text-base font-normal text-muted-foreground ml-2">
                        ({totalSongs.toLocaleString()} songs filtered)
                      </span>
                    )}
                  </h2>
                  <p className="text-sm sm:text-base text-muted-foreground">
                    Browse, search, and download music charts from Enchor.us and Rhythmverse.
                    Create collections and share them with other users in real-time.
                  </p>
                </div>
              </div>

              {/* Music Table */}
              <MusicTable
                deviceId={deviceId}
                deviceName={deviceName}
                onTotalChange={setTotalSongs}
              />
            </div>

            {/* Sidebar */}
            <aside className="space-y-4 lg:space-y-6">
              <CacheDeserializer />
              <SocialPanel deviceId={deviceId} deviceName={deviceName} />
              <ProviderPanel />
              <SavedSongs
                deviceId={deviceId}
              />
            </aside>
          </div>
        </SavedSongsProvider>
      </main>

      {/* Footer */}
      <footer className="border-t border-primary/20 py-4 sm:py-6 mt-8 sm:mt-12 relative z-10">
        <div className="container mx-auto px-2 sm:px-4 text-center text-xs sm:text-sm text-muted-foreground">
          <p>YARG Aggregator — Built for YARG community</p>
          <p className="mt-2 text-[10px] sm:text-xs opacity-70">
            This is a community-made tool and is not affiliated with the YARG project.
          </p>
        </div>
      </footer>

      {/* Device Name Dialog */}
      <Dialog open={showDeviceDialog} onOpenChange={setShowDeviceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Welcome to YARG Aggregator!</DialogTitle>
            <DialogDescription>
              Please enter a name for your device. This will be used to identify you
              when sharing collections with other users.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="e.g., Gaming PC, MacBook Pro..."
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveDeviceName()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button onClick={saveDeviceName} disabled={!deviceName.trim()}>
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Toaster />
    </div>
  );
}
