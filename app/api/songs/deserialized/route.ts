import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Music from '@/models/Music';
import { SongEntry } from '@/services/cache-reader/Song/Entries/SongEntry';

interface DeserializedSongRequest {
  songs: SongEntry[];
  deviceId: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: DeserializedSongRequest = await request.json();
    const { songs, deviceId } = body;

    if (!songs || !Array.isArray(songs)) {
      return NextResponse.json(
        { error: 'Invalid request: songs array is required' },
        { status: 400 }
      );
    }

    if (!deviceId) {
      return NextResponse.json(
        { error: 'Invalid request: deviceId is required' },
        { status: 400 }
      );
    }

    await connectDB();

    // Convert SongEntry to database format
    const songsToUpsert = songs.map((song) => {
      const metadata = song._metadata;
      const parts = song._parts;
      const hash = Buffer.from(song._hash).toString('hex');

      return {
        name: metadata.Name || 'Unknown Song',
        artist: metadata.Artist || 'Unknown Artist',
        album: metadata.Album,
        year: metadata.Year ? parseInt(metadata.Year, 10) : undefined,
        genre: metadata.Genre,
        charter: metadata.Charter,
        source: 'yarg-cache',
        sourceUpdatedAt: new Date(),
        hash,
        // Map available parts to instruments
        instruments: {
          ...(parts.FiveFretBass && parts.FiveFretBass.Difficulties !== 0 && { bass: 1 }),
          ...(parts.FourLaneDrums && parts.FourLaneDrums.Difficulties !== 0 && { drums: 1 }),
          ...(parts.FiveFretGuitar && parts.FiveFretGuitar.Difficulties !== 0 && { guitar: 1 }),
          ...(parts.Keys && parts.Keys.Difficulties !== 0 && { prokeys: 1 }),
          ...(parts.LeadVocals && parts.LeadVocals.Difficulties !== 0 && { vocals: 1 }),
          ...(parts.EliteDrums && parts.EliteDrums.Difficulties !== 0 && { eliteDrums: 1 }),
          ...(parts.ProBass_17Fret && parts.ProBass_17Fret.Difficulties !== 0 && { proBass: 1 }),
          ...(parts.ProGuitar_17Fret && parts.ProGuitar_17Fret.Difficulties !== 0 && { proGuitar: 1 }),
          ...(parts.ProKeys && parts.ProKeys.Difficulties !== 0 && { proKeys: 1 }),
        },
        // Additional metadata
        metadata: {
          songLength: Number(metadata.SongLength),
          songOffset: Number(metadata.SongOffset),
          songRating: metadata.SongRating,
          albumTrack: metadata.AlbumTrack,
          playlistTrack: metadata.PlaylistTrack,
          isMaster: metadata.IsMaster,
          videoLoop: metadata.VideoLoop,
          source: metadata.Source,
          playlist: metadata.Playlist,
          location: metadata.Location,
          // Links
          links: {
            bandcamp: metadata.LinkBandcamp,
            bluesky: metadata.LinkBluesky,
            facebook: metadata.LinkFacebook,
            instagram: metadata.LinkInstagram,
            newgrounds: metadata.LinkNewgrounds,
            soundcloud: metadata.LinkSoundcloud,
            spotify: metadata.LinkSpotify,
            tiktok: metadata.LinkTiktok,
            twitter: metadata.LinkTwitter,
            other: metadata.LinkOther,
            youtube: metadata.LinkYoutube,
          },
          // Credits
          credits: {
            albumArtDesignedBy: metadata.CreditAlbumArtDesignedBy,
            arrangedBy: metadata.CreditArrangedBy,
            composedBy: metadata.CreditComposedBy,
            courtesyOf: metadata.CreditCourtesyOf,
            engineeredBy: metadata.CreditEngineeredBy,
            license: metadata.CreditLicense,
            masteredBy: metadata.CreditMasteredBy,
            mixedBy: metadata.CreditMixedBy,
            other: metadata.CreditOther,
            performedBy: metadata.CreditPerformedBy,
            producedBy: metadata.CreditProducedBy,
            publishedBy: metadata.CreditPublishedBy,
            writtenBy: metadata.CreditWrittenBy,
          },
          // Charter info
          charterInfo: {
            bass: metadata.CharterBass,
            drums: metadata.CharterDrums,
            eliteDrums: metadata.CharterEliteDrums,
            guitar: metadata.CharterGuitar,
            keys: metadata.CharterKeys,
            lowerDiff: metadata.CharterLowerDiff,
            proBass: metadata.CharterProBass,
            proKeys: metadata.CharterProKeys,
            proGuitar: metadata.CharterProGuitar,
            venue: metadata.CharterVenue,
            vocals: metadata.CharterVocals,
          },
        },
        // Track which device this song came from
        deviceId,
        // Mark as installed (from cache)
        isInstalled: true,
      };
    });

    // Check for existing songs and prepare operations
    const existingSongs = await Music.find({
      hash: { $in: songsToUpsert.map(song => song.hash) },
      source: 'yarg-cache'
    }).select('hash').lean();

    const existingHashes = new Set(existingSongs.map(song => song.hash));
    
    // Separate into new songs and updates
    const newSongs = songsToUpsert.filter(song => !existingHashes.has(song.hash));
    const updatedSongs = songsToUpsert.filter(song => existingHashes.has(song.hash));

    let insertedCount = 0;
    let updatedCount = 0;

    // Insert new songs
    if (newSongs.length > 0) {
      const insertResult = await Music.insertMany(newSongs, { ordered: false });
      insertedCount = insertResult.length;
    }

    // Update existing songs
    if (updatedSongs.length > 0) {
      const bulkUpdateOps = updatedSongs.map(song => ({
        updateOne: {
          filter: { 
            hash: song.hash, 
            source: song.source as 'enchor' | 'rhythmverse' | 'yarg-cache'
          },
          update: { 
            $set: {
              name: song.name,
              artist: song.artist,
              album: song.album,
              year: song.year,
              genre: song.genre,
              charter: song.charter,
              sourceUpdatedAt: song.sourceUpdatedAt,
              instruments: song.instruments,
              metadata: song.metadata,
              deviceId: song.deviceId,
              isInstalled: song.isInstalled,
              updatedAt: new Date()
            }
          }
        }
      }));

      const updateResult = await Music.bulkWrite(bulkUpdateOps, { ordered: false });
      updatedCount = updateResult.modifiedCount;
    }

    // Remove songs that are no longer in the cache for this device
    const currentHashes = new Set(songsToUpsert.map(song => song.hash));
    const deleteResult = await Music.deleteMany({
      deviceId,
      source: 'yarg-cache',
      hash: { $nin: Array.from(currentHashes) }
    });

    return NextResponse.json({
      success: true,
      message: `Processed ${songs.length} songs: ${insertedCount} new, ${updatedCount} updated, ${deleteResult.deletedCount} removed`,
      stats: {
        total: songs.length,
        inserted: insertedCount,
        updated: updatedCount,
        deleted: deleteResult.deletedCount,
        newSongs: newSongs.length,
        updatedSongs: updatedSongs.length
      }
    });

  } catch (error) {
    console.error('Error processing deserialized songs:', error);
    return NextResponse.json(
      { error: 'Failed to process deserialized songs' },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve installed songs for a device
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');

    if (!deviceId) {
      return NextResponse.json(
        { error: 'deviceId is required' },
        { status: 400 }
      );
    }

    await connectDB();

    const installedSongs = await Music.find({
      deviceId,
      source: 'yarg-cache',
      isInstalled: true
    }).select('name artist album hash').lean();

    return NextResponse.json({
      success: true,
      songs: installedSongs,
      count: installedSongs.length
    });

  } catch (error) {
    console.error('Error fetching installed songs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch installed songs' },
      { status: 500 }
    );
  }
}
