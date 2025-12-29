'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { ISavedSong, IMusic } from '@/types';

interface SavedSongsContextType {
    savedSongs: ISavedSong[];
    savedSongIds: Set<string>;
    isLoading: boolean;
    addSong: (music: IMusic) => Promise<void>;
    removeSong: (musicId: string) => Promise<void>;
    clearSongs: () => Promise<void>;
    refresh: () => Promise<void>;
    exportSongs: () => Promise<void>;
    importSongs: (file: File) => Promise<{ imported: number; skipped: number; errors?: string[] }>;
}

const SavedSongsContext = createContext<SavedSongsContextType | undefined>(undefined);

export function SavedSongsProvider({
    children,
    deviceId,
    deviceName
}: {
    children: React.ReactNode;
    deviceId: string;
    deviceName: string;
}) {
    const [savedSongs, setSavedSongs] = useState<ISavedSong[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const savedSongIds = useMemo(() => new Set(savedSongs.map(s => s.musicId)), [savedSongs]);

    const fetchSavedSongs = useCallback(async () => {
        if (!deviceId) return;
        setIsLoading(true);
        try {
            const response = await fetch('/api/songs', {
                headers: { 'x-device-id': deviceId },
            });
            if (response.ok) {
                const data = await response.json();
                setSavedSongs(data.savedSongs || []);
            }
        } catch (error) {
            console.error('Error fetching saved songs:', error);
        } finally {
            setIsLoading(false);
        }
    }, [deviceId]);

    useEffect(() => {
        fetchSavedSongs();
    }, [fetchSavedSongs]);

    const addSong = useCallback(async (music: IMusic) => {
        if (!deviceId) return;

        // Optimistic update
        const newSavedSong: ISavedSong = {
            musicId: music._id!,
            name: music.name,
            artist: music.artist,
            addedAt: new Date(),
        };

        setSavedSongs(prev => [...prev, newSavedSong]);

        try {
            const response = await fetch('/api/songs', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-device-id': deviceId,
                    'x-device-name': deviceName || 'Unknown Device',
                },
                body: JSON.stringify({
                    musicId: music._id!,
                    name: music.name,
                    artist: music.artist,
                }),
            });

            if (!response.ok) {
                // Rollback on error
                setSavedSongs(prev => prev.filter(s => s.musicId !== music._id));
                console.error('Failed to save song');
            }
        } catch (error) {
            // Rollback on error
            setSavedSongs(prev => prev.filter(s => s.musicId !== music._id));
            console.error('Error adding song:', error);
        }
    }, [deviceId, deviceName]);

    const removeSong = useCallback(async (musicId: string) => {
        if (!deviceId) return;

        // Optimistic update
        const songToRemove = savedSongs.find(s => s.musicId === musicId);
        setSavedSongs(prev => prev.filter(s => s.musicId !== musicId));

        try {
            const response = await fetch('/api/songs', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'x-device-id': deviceId,
                },
                body: JSON.stringify({ musicId }),
            });

            if (!response.ok) {
                // Rollback on error
                if (songToRemove) {
                    setSavedSongs(prev => [...prev, songToRemove]);
                }
                console.error('Failed to remove song');
            }
        } catch (error) {
            // Rollback on error
            if (songToRemove) {
                setSavedSongs(prev => [...prev, songToRemove]);
            }
            console.error('Error removing song:', error);
        }
    }, [deviceId, savedSongs]);

    const clearSongs = useCallback(async () => {
        if (!deviceId) return;

        // Optimistic update
        const previousSongs = [...savedSongs];
        setSavedSongs([]);

        try {
            const response = await fetch('/api/songs', {
                method: 'PATCH',
                headers: { 'x-device-id': deviceId },
            });

            if (!response.ok) {
                // Rollback on error
                setSavedSongs(previousSongs);
                console.error('Failed to clear songs');
            }
        } catch (error) {
            // Rollback on error
            setSavedSongs(previousSongs);
            console.error('Error clearing songs:', error);
        }
    }, [deviceId, savedSongs]);

    const exportSongs = useCallback(async () => {
        if (!deviceId) return;

        try {
            const response = await fetch('/api/songs/export', {
                headers: { 'x-device-id': deviceId },
            });

            if (!response.ok) {
                console.error('Failed to export songs');
                return;
            }

            // Get the blob and trigger download
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `saved-songs-${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Error exporting songs:', error);
        }
    }, [deviceId]);

    const importSongs = useCallback(async (file: File) => {
        if (!deviceId) {
            throw new Error('Device ID not available');
        }

        try {
            // Read the file
            const text = await file.text();
            const data = JSON.parse(text);

            // Send to import API
            const response = await fetch('/api/songs/import', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-device-id': deviceId,
                    'x-device-name': deviceName || 'Unknown Device',
                },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to import songs');
            }

            const result = await response.json();

            // Refresh the saved songs list
            await fetchSavedSongs();

            return result;
        } catch (error) {
            console.error('Error importing songs:', error);
            throw error;
        }
    }, [deviceId, deviceName, fetchSavedSongs]);


    const value = useMemo(() => ({
        savedSongs,
        savedSongIds,
        isLoading,
        addSong,
        removeSong,
        clearSongs,
        refresh: fetchSavedSongs,
        exportSongs,
        importSongs
    }), [savedSongs, savedSongIds, isLoading, addSong, removeSong, clearSongs, fetchSavedSongs, exportSongs, importSongs]);

    return (
        <SavedSongsContext.Provider value={value}>
            {children}
        </SavedSongsContext.Provider>
    );
}

export function useSavedSongs() {
    const context = useContext(SavedSongsContext);
    if (context === undefined) {
        throw new Error('useSavedSongs must be used within a SavedSongsProvider');
    }
    return context;
}
