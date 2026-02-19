import { db } from "@/lib/db";
import { userProfile } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ListService } from "@/lib/services/list";
import { notFound } from "next/navigation";
import { PublicListView } from "./PublicListView";

export default async function PublicListPage({
  params,
}: {
  params: Promise<{ username: string; slug: string }>;
}) {
  const { username, slug } = await params;

  const profileResult = await db
    .select()
    .from(userProfile)
    .where(eq(userProfile.displayName, username))
    .limit(1);
  const profile = profileResult[0];

  if (!profile) {
    notFound();
  }

  const list = await ListService.getListBySlug(profile.userId, slug);

  if (!list || !list.isPublic) {
    notFound();
  }

  const publicList = {
    id: list.id,
    name: list.name,
    slug: list.slug,
    owner: {
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
    },
    songs: list.items.map((item) => ({
      id: item.song.id,
      name: item.song.title,
      artist: item.song.artist.name,
      album: item.song.album?.name ?? null,
      albumImageUrl: item.song.albumImageUrl,
      addedAt:
        item.addedAt instanceof Date
          ? item.addedAt.toISOString()
          : String(item.addedAt),
      downloadUrls: item.song.downloadUrls,
    })),
  };

  return <PublicListView list={publicList} username={username} />;
}
