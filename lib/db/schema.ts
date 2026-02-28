import {
  pgTable,
  text,
  integer,
  timestamp,
  pgEnum,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { randomUUID } from "crypto";

// Enums
export const sourceEnum = pgEnum("source", ["enchor", "rhythmverse"]);
export const roleEnum = pgEnum("role", ["user", "moderator", "admin"]);

// Better Auth tables
export const user = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$default(() => randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// User profile (extends Better Auth user with additional fields)
export const userProfile = pgTable(
  "user_profile",
  {
    id: text("id")
      .primaryKey()
      .$default(() => randomUUID()),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull().unique(),
    avatarUrl: text("avatar_url"),
    role: roleEnum("role").notNull().default("user"),
    preferredLanguage: text("preferred_language"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("user_profile_user_id_idx").on(table.userId),
    index("user_profile_display_name_idx").on(table.displayName),
  ],
);

// Trusted devices for users
export const trustedDevice = pgTable(
  "trusted_device",
  {
    id: text("id")
      .primaryKey()
      .$default(() => randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    fingerprint: text("fingerprint").notNull(),
    browser: text("browser"),
    os: text("os"),
    lastUsedAt: timestamp("last_used_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("trusted_device_user_id_idx").on(table.userId)],
);

// Rate limiting attempts
export const rateLimitAttempt = pgTable(
  "rate_limit_attempt",
  {
    id: text("id")
      .primaryKey()
      .$default(() => randomUUID()),
    identifier: text("identifier").notNull(),
    identifierType: text("identifier_type").notNull(), // "ip" | "account"
    attemptCount: integer("attempt_count").notNull().default(0),
    lockedUntil: timestamp("locked_until"),
    windowStart: timestamp("window_start").defaultNow().notNull(),
  },
  (table) => [
    index("rate_limit_identifier_idx").on(table.identifier, table.identifierType),
  ],
);

// Song lists (favorites + custom lists)
export const songList = pgTable(
  "song_list",
  {
    id: text("id")
      .primaryKey()
      .$default(() => randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    isFavorites: boolean("is_favorites").notNull().default(false),
    isPublic: boolean("is_public").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("song_list_user_id_idx").on(table.userId),
    index("song_list_slug_idx").on(table.slug),
    index("song_list_user_public_idx").on(table.userId, table.isPublic),
  ],
);

// Song list items (join table)
export const songListItem = pgTable(
  "song_list_item",
  {
    id: text("id")
      .primaryKey()
      .$default(() => randomUUID()),
    listId: text("list_id")
      .notNull()
      .references(() => songList.id, { onDelete: "cascade" }),
    songId: text("song_id")
      .notNull()
      .references(() => song.id, { onDelete: "cascade" }),
    addedAt: timestamp("added_at").defaultNow().notNull(),
  },
  (table) => [
    index("song_list_item_list_id_idx").on(table.listId),
    index("song_list_item_song_id_idx").on(table.songId),
  ],
);

// Music tables - Normalized structure
export const artist = pgTable("artist", {
  id: text("id")
    .primaryKey()
    .$default(() => randomUUID()),
  name: text("name").notNull().unique(),
});

export const album = pgTable("album", {
  id: text("id")
    .primaryKey()
    .$default(() => randomUUID()),
  name: text("name").notNull().unique(),
});

export const genre = pgTable("genre", {
  id: text("id")
    .primaryKey()
    .$default(() => randomUUID()),
  name: text("name").notNull().unique(),
});

export const song = pgTable(
  "song",
  {
    id: text("id")
      .primaryKey()
      .$default(() => randomUUID()),
    key: text("key").notNull().unique(),
    title: text("title").notNull(),
    year: integer("year"),
    artistId: text("artist_id")
      .notNull()
      .references(() => artist.id),
    albumId: text("album_id").references(() => album.id),
    genreId: text("genre_id").references(() => genre.id),
    albumImageUrl: text("album_image_url"),
    previewUrl: text("preview_url"),
    charter: text("charter"),
    diffGuitar: integer("diff_guitar"),
    diffBass: integer("diff_bass"),
    diffDrums: integer("diff_drums"),
    diffKeys: integer("diff_keys"),
    diffVocals: integer("diff_vocals"),
    searchVector: text("search_vector"), // For full-text search
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("song_created_at_idx").on(table.createdAt.desc(), table.id.asc()),
    index("song_diff_guitar_idx").on(table.diffGuitar),
    index("song_diff_bass_idx").on(table.diffBass),
    index("song_diff_drums_idx").on(table.diffDrums),
    index("song_diff_keys_idx").on(table.diffKeys),
    index("song_diff_vocals_idx").on(table.diffVocals),
    index("song_artist_id_idx").on(table.artistId),
    index("song_album_id_idx").on(table.albumId),
    index("song_genre_id_idx").on(table.genreId),
  ],
);

export const downloadUrl = pgTable(
  "download_url",
  {
    id: text("id")
      .primaryKey()
      .$default(() => randomUUID()),
    url: text("url").notNull(),
    source: text("source").notNull(),
    songId: text("song_id")
      .notNull()
      .references(() => song.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("download_url_song_id_idx").on(table.songId),
    index("download_url_source_idx").on(table.source),
  ],
);

// Provider table
export const provider = pgTable("provider", {
  id: text("id").primaryKey(),
  name: sourceEnum("name").notNull().unique(),
  lastSuccessfulFetch: timestamp("last_successful_fetch"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Installation table - tracks game installations (YARG instances)
export const installation = pgTable(
  "installation",
  {
    id: text("id")
      .primaryKey()
      .$default(() => randomUUID()),
    name: text("name").notNull(),
    path: text("path"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("installation_name_idx").on(table.name)],
);

// Installation-Song join table - tracks which songs are installed in each installation
export const installationSong = pgTable(
  "installation_song",
  {
    id: text("id")
      .primaryKey()
      .$default(() => randomUUID()),
    installationId: text("installation_id")
      .notNull()
      .references(() => installation.id, { onDelete: "cascade" }),
    songId: text("song_id")
      .notNull()
      .references(() => song.id, { onDelete: "cascade" }),
    installedAt: timestamp("installed_at").defaultNow().notNull(),
  },
  (table) => [
    index("installation_song_installation_id_idx").on(table.installationId),
    index("installation_song_song_id_idx").on(table.songId),
    index("installation_song_compound_idx").on(table.installationId, table.songId),
  ],
);

// Relations
export const userRelations = relations(user, ({ one, many }) => ({
  accounts: many(account),
  sessions: many(session),
  profile: one(userProfile),
  trustedDevices: many(trustedDevice),
  songLists: many(songList),
}));

export const userProfileRelations = relations(userProfile, ({ one }) => ({
  user: one(user, {
    fields: [userProfile.userId],
    references: [user.id],
  }),
}));

export const trustedDeviceRelations = relations(trustedDevice, ({ one }) => ({
  user: one(user, {
    fields: [trustedDevice.userId],
    references: [user.id],
  }),
}));

export const songListRelations = relations(songList, ({ one, many }) => ({
  user: one(user, {
    fields: [songList.userId],
    references: [user.id],
  }),
  items: many(songListItem),
}));

export const songListItemRelations = relations(songListItem, ({ one }) => ({
  list: one(songList, {
    fields: [songListItem.listId],
    references: [songList.id],
  }),
  song: one(song, {
    fields: [songListItem.songId],
    references: [song.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const artistRelations = relations(artist, ({ many }) => ({
  songs: many(song),
}));

export const albumRelations = relations(album, ({ many }) => ({
  songs: many(song),
}));

export const genreRelations = relations(genre, ({ many }) => ({
  songs: many(song),
}));

export const songRelations = relations(song, ({ one, many }) => ({
  artist: one(artist, {
    fields: [song.artistId],
    references: [artist.id],
  }),
  album: one(album, {
    fields: [song.albumId],
    references: [album.id],
  }),
  genre: one(genre, {
    fields: [song.genreId],
    references: [genre.id],
  }),
  downloads: many(downloadUrl),
  installations: many(installationSong),
  listItems: many(songListItem),
}));

export const installationRelations = relations(installation, ({ many }) => ({
  songs: many(installationSong),
}));

export const installationSongRelations = relations(
  installationSong,
  ({ one }) => ({
    installation: one(installation, {
      fields: [installationSong.installationId],
      references: [installation.id],
    }),
    song: one(song, {
      fields: [installationSong.songId],
      references: [song.id],
    }),
  }),
);

export const downloadUrlRelations = relations(downloadUrl, ({ one }) => ({
  song: one(song, {
    fields: [downloadUrl.songId],
    references: [song.id],
  }),
}));

// Types for use in the application
export type Artist = typeof artist.$inferSelect;
export type NewArtist = typeof artist.$inferInsert;
export type Album = typeof album.$inferSelect;
export type NewAlbum = typeof album.$inferInsert;
export type Genre = typeof genre.$inferSelect;
export type NewGenre = typeof genre.$inferInsert;
export type Song = typeof song.$inferSelect;
export type NewSong = typeof song.$inferInsert;
export type DownloadUrl = typeof downloadUrl.$inferSelect;
export type NewDownloadUrl = typeof downloadUrl.$inferInsert;
export type Provider = typeof provider.$inferSelect;
export type NewProvider = typeof provider.$inferInsert;
export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type Installation = typeof installation.$inferSelect;
export type NewInstallation = typeof installation.$inferInsert;
export type InstallationSong = typeof installationSong.$inferSelect;
export type NewInstallationSong = typeof installationSong.$inferInsert;
export type UserProfile = typeof userProfile.$inferSelect;
export type NewUserProfile = typeof userProfile.$inferInsert;
export type TrustedDevice = typeof trustedDevice.$inferSelect;
export type NewTrustedDevice = typeof trustedDevice.$inferInsert;
export type RateLimitAttempt = typeof rateLimitAttempt.$inferSelect;
export type NewRateLimitAttempt = typeof rateLimitAttempt.$inferInsert;
export type SongList = typeof songList.$inferSelect;
export type NewSongList = typeof songList.$inferInsert;
export type SongListItem = typeof songListItem.$inferSelect;
export type NewSongListItem = typeof songListItem.$inferInsert;
export type Role = (typeof roleEnum.enumValues)[number];
