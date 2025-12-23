'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Trash2, Heart, Music, Download } from 'lucide-react';
import type { ISavedSong } from '@/types';
import { useSavedSongs } from '@/context/SavedSongsContext';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface SavedSongsProps {
    deviceId: string;
}

export default function SavedSongs({
    deviceId,
}: SavedSongsProps) {
    const { savedSongs, removeSong, clearSongs } = useSavedSongs();

    const handleClearAll = async () => {
        await clearSongs();
    };

    return (
        <Card className="border-primary/20 bg-background/50 backdrop-blur-sm">
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Heart className="h-5 w-5 text-primary fill-primary" />
                        Saved Songs
                    </div>
                    {savedSongs.length > 0 && (
                        <Badge variant="secondary" className="font-mono">
                            {savedSongs.length}
                        </Badge>
                    )}
                </CardTitle>
                <CardDescription>
                    Your personal library of charts
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2 max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-primary/20">
                    {savedSongs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center space-y-2 opacity-50">
                            <Music className="h-8 w-8" />
                            <p className="text-sm">No saved songs yet</p>
                        </div>
                    ) : (
                        savedSongs.map((song) => (
                            <div
                                key={song.musicId}
                                className="group flex items-center justify-between p-2 rounded-md border border-primary/10 bg-card/50 hover:bg-accent/50 transition-all"
                            >
                                <div className="flex-1 min-w-0 pr-2">
                                    <p className="font-medium text-sm truncate">{song.name}</p>
                                    <p className="text-xs text-muted-foreground truncate">
                                        {song.artist}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                        onClick={() => removeSong(song.musicId)}
                                        title="Remove"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
                {savedSongs.length > 0 && (
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="w-full text-muted-foreground hover:text-destructive"
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Clear All
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete all
                                    songs from your saved list.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={handleClearAll}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                    Clear All
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}
            </CardContent>
        </Card>
    );
}
