Playlist Import Feature

 Context

 Users who sign in with Spotify or Google (YouTube Music) want to import their playlists from those platforms into the app. The app matches each track against the game's song database using fuzzy matching and
 creates (or adds to) a user song list with the matched songs. This feature leverages the existing song list system, OAuth social login, and PostgreSQL similarity matching.

 User choices: Both providers at once, scopes added to login config, import to new or existing list.

 ---
 1. OAuth Scope Changes

 File: lib/auth.ts

 Add required scopes to the social provider config:

 socialProviders: {
   google: {
     clientId: ...,
     clientSecret: ...,
     scopes: ["openid", "profile", "email", "https://www.googleapis.com/auth/youtube.readonly"],
   },
   spotify: {
     clientId: ...,
     clientSecret: ...,
     scopes: ["user-read-private", "user-read-email", "playlist-read-private", "playlist-read-collaborative"],
   },
 },

 New users automatically get these scopes. Existing users who try to import will get a "re-authorize" prompt if their stored scope (in the account table) doesn't include the required ones.

 ---
 2. Token Refresh Utility

 New file: lib/services/platform-auth.ts

 Helper that retrieves a valid access token for a user's linked social account:

 - Query the account table for (userId, providerId)
 - If accessTokenExpiresAt is in the future (with 5-min buffer), return accessToken
 - Otherwise, use the stored refreshToken to get a new token from the provider's token endpoint (Spotify: https://accounts.spotify.com/api/token, Google: https://oauth2.googleapis.com/token)
 - Update the account row with the new token and expiry
 - Return the access token, or null if no linked account / refresh fails

 Also include a helper hasRequiredScopes(userId, providerId) that checks the account.scope field.

 ---
 3. Platform Playlist Services

 3a. Spotify User Playlists

 New file: services/platforms/spotify-user.ts

 - getUserPlaylists(accessToken) — calls GET /v1/me/playlists (paginated, 50/page), returns { id, name, imageUrl, trackCount, owner }
 - getPlaylistTracks(accessToken, playlistId) — calls GET /v1/playlists/{id}/tracks (paginated, 100/page), returns { title, artist, album }[], filtering out null tracks (local files)

 3b. YouTube Music User Playlists

 New file: services/platforms/youtube-user.ts

 - getUserPlaylists(accessToken) — calls GET /youtube/v3/playlists?part=snippet,contentDetails&mine=true (paginated), returns { id, name, imageUrl, trackCount }
 - getPlaylistItems(accessToken, playlistId) — calls GET /youtube/v3/playlistItems?part=snippet&playlistId={id} (paginated, 50/page), returns { title, artist }[]
 - Artist extraction: strip " - Topic" suffix from videoOwnerChannelTitle (YouTube Music convention for auto-generated content)

 ---
 4. Song Matching Service

 New file: lib/services/playlist-matcher.ts

 static async matchTracks(tracks: { title: string; artist: string }[]): Promise<MatchResult[]>

 For each track, run a SQL query using the existing similarity() function (same pattern as MusicService in lib/services/music.ts):

 SELECT s.id, s.title, a.name as artist, s.album_image_url,
   (similarity(s.title, $title) * 0.6 + similarity(a.name, $artist) * 0.4) as score
 FROM song s
 JOIN artist a ON s.artist_id = a.id
 WHERE similarity(s.title, $title) >= 0.3 OR similarity(a.name, $artist) >= 0.3
 ORDER BY score DESC
 LIMIT 1

 - Score >= 0.4 = confident match
 - Score 0.3–0.4 = low confidence (shown with warning in UI)
 - No result or score < 0.3 = unmatched
 - Execute queries in parallel (batches of 10) for efficiency

 Return type:
 interface MatchResult {
   externalTrack: { title: string; artist: string };
   match: { songId: string; title: string; artist: string; albumImageUrl: string | null; score: number; confident: boolean } | null;
 }

 ---
 5. Batch Add to List

 File: lib/services/list.ts

 Add a new method addSongsToList(listId, songIds, userId) that batch-inserts songListItem rows in a single transaction (instead of calling addSongToList N times). Skip duplicates.

 ---
 6. API Routes

 GET /api/import/accounts

 Returns linked providers and whether they have required scopes. Auth required.

 GET /api/import/playlists?provider=spotify|youtube

 Fetches user's playlists from the selected provider using their stored OAuth token. Returns simplified playlist list.

 POST /api/import/match

 Body: { provider, playlistId }. Fetches tracks from the playlist, runs matching, returns results with matched/unmatched counts.

 POST /api/import/create-list

 Body: { name, isPublic, songIds, existingListId? }. Creates a new list OR adds songs to an existing list. Uses ListService.createList() + ListService.addSongsToList().

 All routes use withAuth() middleware from lib/middleware/auth.ts.

 ---
 7. UI: Multi-Step Import Dialog

 New file: components/import/PlaylistImportDialog.tsx

 A Dialog (from components/ui/dialog.tsx) with the Stepper component (from components/reui/stepper.tsx) for step navigation.

 Step 1: Select Provider

 - Cards for Spotify and YouTube Music
 - Three states per provider: not linked (show "Connect" button), linked but missing scopes (show "Re-authorize" button), ready (clickable)
 - "Connect" triggers signIn.social({ provider, callbackURL: "/lists?import={provider}" })
 - "Re-authorize" triggers the same flow (Better Auth will request updated scopes)

 Step 2: Select Playlist

 - Fetch playlists via GET /api/import/playlists?provider=...
 - Scrollable list of cards: playlist name, image thumbnail, track count
 - Click to select, then "Next"

 Step 3: Review Matches

 - Call POST /api/import/match, show loading spinner
 - Two sections: "Matched Songs (X/Y)" with checkboxes (default checked), "Not Found (Z)" grayed out
 - Low-confidence matches shown with warning icon
 - Input for list name (pre-filled with playlist name)
 - Toggle for public/private
 - Dropdown to choose "Create new list" or select existing list
 - "Import X Songs" button

 Step 4: Success

 - Confirmation with link to the created/updated list
 - Toast notification via Sonner

 Integration with Lists Page

 File: app/lists/page.tsx

 - Add "Import Playlist" button next to "Create List"
 - Detect ?import=spotify|youtube query param (OAuth redirect callback) and auto-open dialog at Step 2

 ---
 8. i18n

 Files: messages/en.json (+ 6 other locale files)

 Add import section with keys for all UI strings: button labels, step titles/descriptions, provider names, match results, error messages, loading states. English first, then translate to de, es, fr, ja, pt-BR,
  zh.

 ---
 9. Error Handling

 - No linked account: Step 1 shows "Connect" button
 - Missing scopes: Step 1 shows "Re-authorize" button
 - Token expired / refresh fails: API returns 401 { error: "reauth_required", provider }, dialog shows re-auth prompt
 - Platform API errors (rate limit, quota): Toast with retry suggestion
 - No matches found: Step 3 shows "No songs from this playlist were found" with Back button

 ---
 10. Files to Create/Modify

 ┌────────────────────────────────────────────┬────────────────────────────────────────────┐
 │                    File                    │                   Action                   │
 ├────────────────────────────────────────────┼────────────────────────────────────────────┤
 │ lib/auth.ts                                │ Modify — add scopes to social providers    │
 ├────────────────────────────────────────────┼────────────────────────────────────────────┤
 │ lib/services/platform-auth.ts              │ Create — token refresh utility             │
 ├────────────────────────────────────────────┼────────────────────────────────────────────┤
 │ services/platforms/spotify-user.ts         │ Create — Spotify playlist client           │
 ├────────────────────────────────────────────┼────────────────────────────────────────────┤
 │ services/platforms/youtube-user.ts         │ Create — YouTube playlist client           │
 ├────────────────────────────────────────────┼────────────────────────────────────────────┤
 │ lib/services/playlist-matcher.ts           │ Create — song matching service             │
 ├────────────────────────────────────────────┼────────────────────────────────────────────┤
 │ lib/services/list.ts                       │ Modify — add addSongsToList() batch method │
 ├────────────────────────────────────────────┼────────────────────────────────────────────┤
 │ app/api/import/accounts/route.ts           │ Create                                     │
 ├────────────────────────────────────────────┼────────────────────────────────────────────┤
 │ app/api/import/playlists/route.ts          │ Create                                     │
 ├────────────────────────────────────────────┼────────────────────────────────────────────┤
 │ app/api/import/match/route.ts              │ Create                                     │
 ├────────────────────────────────────────────┼────────────────────────────────────────────┤
 │ app/api/import/create-list/route.ts        │ Create                                     │
 ├────────────────────────────────────────────┼────────────────────────────────────────────┤
 │ components/import/PlaylistImportDialog.tsx │ Create — multi-step dialog                 │
 ├────────────────────────────────────────────┼────────────────────────────────────────────┤
 │ app/lists/page.tsx                         │ Modify — add import button + dialog        │
 ├────────────────────────────────────────────┼────────────────────────────────────────────┤
 │ messages/en.json                           │ Modify — add import i18n keys              │
 ├────────────────────────────────────────────┼────────────────────────────────────────────┤
 │ messages/{de,es,fr,ja,pt-BR,zh}.json       │ Modify — add translated import keys        │
 └────────────────────────────────────────────┴────────────────────────────────────────────┘

 ---
 11. Implementation Order

 1. lib/auth.ts — scopes
 2. lib/services/platform-auth.ts — token utility
 3. services/platforms/spotify-user.ts + youtube-user.ts — platform clients
 4. lib/services/playlist-matcher.ts — matching
 5. lib/services/list.ts — batch add
 6. API routes (accounts, playlists, match, create-list)
 7. messages/en.json — i18n keys
 8. components/import/PlaylistImportDialog.tsx — UI
 9. app/lists/page.tsx — integration
 10. Other locale files — translations

 ---
 12. Verification

 1. Build check: npm run build passes
 2. Auth flow: Log in with Spotify → verify new scopes are requested → check account.scope in DB
 3. Import flow (Spotify): Click Import → select Spotify → see playlists → select one → review matches → create list → verify list appears with songs
 4. Import flow (YouTube): Same as above with Google/YouTube Music
 5. Existing list: Import into an existing list → verify songs are added without duplicates
 6. Re-auth: Test with an account missing scopes → verify re-auth prompt works
 7. No matches: Import a playlist with obscure tracks → verify "no matches" message
 8. Token refresh: Wait for token expiry → verify auto-refresh works
