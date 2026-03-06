import { NamingStyle, SpaceHandling } from "../types";

/**
 * Arrange the output filename based on the naming style.
 * Port of BatchExtractor.arrangeName() from BatchExtractor.cs:111-173.
 */
export function arrangeName(
  song: string,
  artist: string,
  songId: string,
  style: NamingStyle,
  spaceHandling: SpaceHandling,
): string {
  let arranged = "";

  switch (style) {
    case NamingStyle.SongID:
      arranged = songId;
      break;

    case NamingStyle.ArtistSong:
      arranged = `${artist} - ${song}`;
      break;

    case NamingStyle.ArtistTheSong:
      if (artist.length > 6 && artist.startsWith("The ")) {
        arranged = `${artist.substring(4)}, The - ${song}`;
      } else {
        arranged = `${artist} - ${song}`;
      }
      break;

    case NamingStyle.SongArtist:
      arranged = `${song} - ${artist}`;
      break;

    case NamingStyle.SongArtistThe:
      if (artist.length > 6 && artist.startsWith("The ")) {
        arranged = `${song} - ${artist.substring(4)}, The`;
      } else {
        arranged = `${song} - ${artist}`;
      }
      break;
  }

  switch (spaceHandling) {
    case SpaceHandling.Remove:
      arranged = arranged.replace(/ /g, "");
      break;
    case SpaceHandling.Underscore:
      arranged = arranged.replace(/ /g, "_");
      break;
    case SpaceHandling.Keep:
    default:
      break;
  }

  return arranged;
}
