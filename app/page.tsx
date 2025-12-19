'use client';

import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import MusicTable from '@/components/data-table/MusicTable';
import ProviderPanel from '@/components/providers/ProviderPanel';
import CollectionManager from '@/components/collection/CollectionManager';
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
import { Music, Zap } from 'lucide-react';
import type { IMusic } from '@/types';
import { Toaster } from '@/components/ui/sonner';

export default function HomePage() {
  const [selectedSongs, setSelectedSongs] = useState<IMusic[]>([]);
  const [deviceId, setDeviceId] = useState<string>('');
  const [deviceName, setDeviceName] = useState('');
  const [showDeviceDialog, setShowDeviceDialog] = useState(false);

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
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-primary via-accent to-primary/60 text-primary-foreground shadow-lg shadow-primary/30">
              <Music className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                YARG Aggregator
              </h1>
              <p className="text-xs text-muted-foreground">Music chart library</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-sm text-foreground/80">
              {deviceName || 'Not registered'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto py-8 px-4 relative z-10">
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          {/* Main Content Area */}
          <div className="space-y-8">
            {/* Hero Section */}
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-primary/20 via-accent/10 to-primary/5 p-6 border border-primary/20">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent" />
              <div className="relative">
                <h2 className="text-2xl font-bold mb-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  Welcome to YARG Aggregator
                </h2>
                <p className="text-muted-foreground max-w-2xl">
                  Browse, search, and download music charts from Enchor.us and Rhythmverse. 
                  Create collections and share them with other users in real-time.
                </p>
              </div>
            </div>

            {/* Music Table */}
            <MusicTable onSelectionChange={setSelectedSongs} />
          </div>

          {/* Sidebar */}
          <aside className="space-y-6">
            <ProviderPanel />
            <CollectionManager
              selectedSongs={selectedSongs}
              deviceId={deviceId}
              onClearSelection={() => setSelectedSongs([])}
            />
          </aside>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-primary/20 py-6 mt-12 relative z-10">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>YARG Aggregator — Built for the YARG community</p>
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
