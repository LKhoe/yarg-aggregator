import { db } from "@/lib/db";
import { userProfile } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ListService } from "@/lib/services/list";
import { notFound } from "next/navigation";
import { PublicProfileView } from "./PublicProfileView";

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  const profileResult = await db
    .select()
    .from(userProfile)
    .where(eq(userProfile.displayName, username))
    .limit(1);
  const profile = profileResult[0];

  if (!profile) {
    notFound();
  }

  const lists = await ListService.getPublicLists(profile.userId);

  const publicProfile = {
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    createdAt:
      profile.createdAt instanceof Date
        ? profile.createdAt.toISOString()
        : String(profile.createdAt),
    lists: lists.map((list) => ({
      id: list.id,
      name: list.name,
      slug: list.slug,
      songCount: list.itemCount,
    })),
  };

  return <PublicProfileView profile={publicProfile} username={username} />;
}
