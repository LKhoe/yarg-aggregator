'use client';

import React from 'react';

import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trash2, Heart, Music, Download, FileDown, Upload } from 'lucide-react';
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
    const { savedSongs, removeSong, clearSongs, exportSongs, importSongs } = useSavedSongs();
    const [isImporting, setIsImporting] = React.useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleClearAll = async () => {
        await clearSongs();
    };

    const handleExport = async () => {
        await exportSongs();
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        try {
            const result = await importSongs(file);
            console.log('Import result:', result);
            // You could show a toast notification here
            alert(`Successfully imported ${result.imported} songs. ${result.skipped} skipped.`);
        } catch (error) {
            console.error('Import error:', error);
            alert('Failed to import songs. Please check the file format.');
        } finally {
            setIsImporting(false);
            // Reset the input so the same file can be selected again
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
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

                {/* Import/Export Section - Always visible */}
                <div className="space-y-2 pt-2 border-t border-primary/10">
                    <div className="grid grid-cols-2 gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleExport}
                            disabled={savedSongs.length === 0}
                            className="w-full"
                        >
                            <FileDown className="mr-2 h-4 w-4" />
                            Export
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleImportClick}
                            disabled={isImporting}
                            className="w-full"
                        >
                            <Upload className="mr-2 h-4 w-4" />
                            {isImporting ? 'Importing...' : 'Import'}
                        </Button>
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="application/json"
                        onChange={handleImportFile}
                        className="hidden"
                    />
                </div>

                {/* Clear All Section - Only when there are songs */}
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
