'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { FolderPlus, Trash2, Share2, List } from 'lucide-react';
import type { IMusic, ICollection } from '@/types';

interface CollectionManagerProps {
  selectedSongs: IMusic[];
  deviceId: string;
  onClearSelection?: () => void;
}

export default function CollectionManager({
  selectedSongs,
  deviceId,
  onClearSelection,
}: CollectionManagerProps) {
  const [collections, setCollections] = useState<ICollection[]>([]);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchCollections = useCallback(async () => {
    try {
      const response = await fetch('/api/collection', {
        headers: { 'x-device-id': deviceId },
      });
      if (response.ok) {
        const data = await response.json();
        setCollections(data.collections || []);
      }
    } catch (error) {
      console.error('Error fetching collections:', error);
    }
  }, [deviceId]);

  useEffect(() => {
    if (deviceId) {
      fetchCollections();
    }
  }, [deviceId, fetchCollections]);

  const createCollection = async () => {
    if (!newCollectionName.trim() || selectedSongs.length === 0) return;

    setLoading(true);
    try {
      const response = await fetch('/api/collection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-id': deviceId,
        },
        body: JSON.stringify({
          name: newCollectionName,
          musicIds: selectedSongs.map((s) => s._id),
        }),
      });

      if (response.ok) {
        await fetchCollections();
        setNewCollectionName('');
        setIsCreateOpen(false);
        if (onClearSelection) onClearSelection();
      }
    } catch (error) {
      console.error('Error creating collection:', error);
    }
    setLoading(false);
  };

  const deleteCollection = async (collectionId: string) => {
    try {
      const response = await fetch(
        `/api/collection?collectionId=${collectionId}`,
        {
          method: 'DELETE',
          headers: { 'x-device-id': deviceId },
        }
      );

      if (response.ok) {
        await fetchCollections();
      }
    } catch (error) {
      console.error('Error deleting collection:', error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <List className="h-5 w-5" />
          My Collections
        </CardTitle>
        <CardDescription>
          Create and manage your song collections
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Create new collection button */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button
              className="w-full"
              variant="outline"
              disabled={selectedSongs.length === 0}
            >
              <FolderPlus className="mr-2 h-4 w-4" />
              Create Collection ({selectedSongs.length} songs)
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Collection</DialogTitle>
              <DialogDescription>
                Save {selectedSongs.length} selected songs to a new collection
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Input
                placeholder="Collection name..."
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createCollection()}
              />
              <div className="max-h-40 overflow-y-auto space-y-1">
                {selectedSongs.slice(0, 10).map((song) => (
                  <div
                    key={song._id}
                    className="text-sm text-muted-foreground truncate"
                  >
                    {song.name} - {song.artist}
                  </div>
                ))}
                {selectedSongs.length > 10 && (
                  <div className="text-sm text-muted-foreground">
                    ...and {selectedSongs.length - 10} more
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={createCollection}
                disabled={!newCollectionName.trim() || loading}
              >
                Create Collection
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Separator />

        {/* Collections list */}
        {collections.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No collections yet. Select songs and create one!
          </p>
        ) : (
          <div className="space-y-2">
            {collections.map((collection) => (
              <div
                key={collection._id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{collection.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {collection.musicIds.length} songs
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {new Date(collection.createdAt).toLocaleDateString()}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Share collection"
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteCollection(collection._id!)}
                    title="Delete collection"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
