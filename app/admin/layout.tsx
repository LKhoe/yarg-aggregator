import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { userProfile } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import Header from "@/components/layout/Header";
import BackgroundOrbs from "@/components/layout/BackgroundOrbs";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/login");
  }

  const [profile] = await db
    .select({ role: userProfile.role })
    .from(userProfile)
    .where(eq(userProfile.userId, session.user.id))
    .limit(1);

  if (!profile || (profile.role !== "admin" && profile.role !== "moderator")) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <BackgroundOrbs />
      <Header />
      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
