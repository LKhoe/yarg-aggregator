CREATE TYPE "public"."source" AS ENUM('enchor', 'rhythmverse');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "album" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "album_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "artist" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "artist_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "download_url" (
	"id" text PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"source" text NOT NULL,
	"song_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "genre" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "genre_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "provider" (
	"id" text PRIMARY KEY NOT NULL,
	"name" "source" NOT NULL,
	"last_successful_fetch" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "provider_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "song" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"title" text NOT NULL,
	"year" integer,
	"artist_id" text NOT NULL,
	"album_id" text,
	"genre_id" text,
	"album_image_url" text,
	"preview_url" text,
	"charter" text,
	"diff_guitar" integer,
	"diff_bass" integer,
	"diff_drums" integer,
	"diff_keys" integer,
	"diff_vocals" integer,
	"search_vector" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "song_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download_url" ADD CONSTRAINT "download_url_song_id_song_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."song"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "song" ADD CONSTRAINT "song_artist_id_artist_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artist"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "song" ADD CONSTRAINT "song_album_id_album_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."album"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "song" ADD CONSTRAINT "song_genre_id_genre_id_fk" FOREIGN KEY ("genre_id") REFERENCES "public"."genre"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "download_url_song_id_idx" ON "download_url" USING btree ("song_id");--> statement-breakpoint
CREATE INDEX "download_url_source_idx" ON "download_url" USING btree ("source");--> statement-breakpoint
CREATE INDEX "song_updated_at_idx" ON "song" USING btree ("updated_at" DESC NULLS LAST,"id");--> statement-breakpoint
CREATE INDEX "song_diff_guitar_idx" ON "song" USING btree ("diff_guitar");--> statement-breakpoint
CREATE INDEX "song_diff_bass_idx" ON "song" USING btree ("diff_bass");--> statement-breakpoint
CREATE INDEX "song_diff_drums_idx" ON "song" USING btree ("diff_drums");--> statement-breakpoint
CREATE INDEX "song_diff_keys_idx" ON "song" USING btree ("diff_keys");--> statement-breakpoint
CREATE INDEX "song_diff_vocals_idx" ON "song" USING btree ("diff_vocals");--> statement-breakpoint
CREATE INDEX "song_artist_id_idx" ON "song" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "song_album_id_idx" ON "song" USING btree ("album_id");--> statement-breakpoint
CREATE INDEX "song_genre_id_idx" ON "song" USING btree ("genre_id");