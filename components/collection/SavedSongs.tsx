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
    const [isOpeningDownloads, setIsOpeningDownloads] = React.useState(false);
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

    const openAllDownloadPages = async () => {
        setIsOpeningDownloads(true);
        
        try {
            if (savedSongs.length === 0) {
                alert('No saved songs to open download pages for');
                return;
            }
            
            // Fetch full music data for all saved songs to get download URLs
            const musicIds = savedSongs.map(song => song.musicId);
            const response = await fetch('/api/music', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ musicIds })
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch music data');
            }
            
            const musicData = await response.json();
            
            // Open each song's download page in a new tab
            let openedCount = 0;
            for (const music of musicData) {
                if (music.downloadUrl) {
                    window.open(music.downloadUrl, music.downloadUrl);
                    openedCount++;
                    
                    // Small delay between opening tabs to prevent browser blocking
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
            
            alert(`Opened ${openedCount} download pages in new tabs`);
        } catch (error) {
            console.error('Error opening download pages:', error);
            alert('Failed to open download pages');
        } finally {
            setIsOpeningDownloads(false);
        }
    };


    return (
        <Card className="border-primary/20 bg-background/50 backdrop-blur-sm">
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Heart className="h-4 w-4 sm:h-5 sm:w-5 text-primary fill-primary" />
                        <span className="text-sm sm:text-base">Saved Songs</span>
                    </div>
                    {savedSongs.length > 0 && (
                        <Badge variant="secondary" className="font-mono text-xs sm:text-sm">
                            {savedSongs.length}
                        </Badge>
                    )}
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                    Your personal library of charts
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4">
                <div className="space-y-2 max-h-[50vh] sm:max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-primary/20">
                    {savedSongs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-6 sm:py-8 text-center space-y-2 opacity-50">
                            <Music className="h-6 w-6 sm:h-8 sm:w-8" />
                            <p className="text-sm">No saved songs yet</p>
                        </div>
                    ) : (
                        savedSongs.map((song) => (
                            <div
                                key={song.musicId}
                                className="group flex items-center justify-between p-2 sm:p-3 rounded-md border border-primary/10 bg-card/50 hover:bg-accent/50 transition-all"
                            >
                                <div className="flex-1 min-w-0 pr-2">
                                    <p className="font-medium text-xs sm:text-sm truncate">{song.name}</p>
                                    <p className="text-xs text-muted-foreground truncate">
                                        {song.artist}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 sm:h-7 sm:w-7 text-destructive hover:bg-destructive/10"
                                        onClick={() => removeSong(song.musicId)}
                                        title="Remove"
                                    >
                                        <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Import/Export Section - Always visible */}
                <div className="space-y-2 pt-2 border-t border-primary/10">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleExport}
                            disabled={savedSongs.length === 0}
                            className="w-full h-9"
                        >
                            <FileDown className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                            <span className="text-xs sm:text-sm">Export</span>
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleImportClick}
                            disabled={isImporting}
                            className="w-full h-9"
                        >
                            <Upload className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                            <span className="text-xs sm:text-sm">{isImporting ? 'Importing...' : 'Import'}</span>
                        </Button>
                    </div>
                    
                    {/* Open All Downloads Button */}
                    {savedSongs.length > 0 && (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={isOpeningDownloads}
                                    className="w-full h-9"
                                >
                                    <Download className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                                    <span className="text-xs sm:text-sm">{isOpeningDownloads ? 'Opening...' : 'Open All Downloads'}</span>
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Open All Download Pages?</AlertDialogTitle>
                                    <AlertDialogDescription className="text-sm">
                                        This will open {savedSongs.length} download pages in new browser tabs. 
                                        This may take a moment and could overwhelm your browser. 
                                        Are you sure you want to continue?
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                        onClick={openAllDownloadPages}
                                        className="bg-primary text-primary-foreground hover:bg-primary/90"
                                    >
                                        Open {savedSongs.length} Pages
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}
                    
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
                                className="w-full h-9 text-muted-foreground hover:text-destructive"
                            >
                                <Trash2 className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                                <span className="text-xs sm:text-sm">Clear All</span>
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription className="text-sm">
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
