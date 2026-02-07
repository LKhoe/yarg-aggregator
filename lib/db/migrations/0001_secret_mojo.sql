CREATE TABLE "installation" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"path" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "installation_song" (
	"id" text PRIMARY KEY NOT NULL,
	"installation_id" text NOT NULL,
	"song_id" text NOT NULL,
	"installed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "installation_song" ADD CONSTRAINT "installation_song_installation_id_installation_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."installation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installation_song" ADD CONSTRAINT "installation_song_song_id_song_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."song"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "installation_name_idx" ON "installation" USING btree ("name");--> statement-breakpoint
CREATE INDEX "installation_song_installation_id_idx" ON "installation_song" USING btree ("installation_id");--> statement-breakpoint
CREATE INDEX "installation_song_song_id_idx" ON "installation_song" USING btree ("song_id");