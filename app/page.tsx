"use client";

import { useState } from "react";
import { useTranslations } from "@/hooks/use-translations";
import dynamic from "next/dynamic";
import type { ProviderMusic } from "@/types";

// Dynamically import heavy components
const MusicTable = dynamic(() => import("@/components/data-table/MusicTable"), {
  loading: () => <div className="animate-pulse bg-muted h-96 rounded-lg" />,
  ssr: false,
});

const SongDetail = dynamic(() => import("@/components/song/SongDetail"), {
  loading: () => <div className="animate-pulse bg-muted h-64 rounded-lg" />,
  ssr: false,
});

const UsersCard = dynamic(() => import("@/components/users/UsersCard"), {
  loading: () => <div className="animate-pulse bg-muted h-48 rounded-lg" />,
  ssr: false,
});

// Static imports for lightweight components
import { Toaster } from "@/components/ui/sonner";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Hero from "@/components/home/Hero";
import BackgroundOrbs from "@/components/layout/BackgroundOrbs";
import { InstallationProvider } from "@/components/installations/InstallationSelector";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useMediaQuery } from "@/hooks/use-media-query";

export default function HomePage() {
  const [totalSongs, setTotalSongs] = useState(0);
  const [selectedSong, setSelectedSong] = useState<ProviderMusic | null>(null);
  const { t, loading } = useTranslations();
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <InstallationProvider>
      <div className="min-h-screen bg-linear-to-br from-background via-background to-primary/10">
        <BackgroundOrbs />

        <Header />

        <main className="container mx-auto py-4 sm:py-8 px-2 sm:px-4 relative z-10">
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="space-y-6">
              <Hero totalSongs={totalSongs} />
              <MusicTable
                onTotalChange={setTotalSongs}
                onSongSelect={setSelectedSong}
              />
            </div>

            <aside className="hidden lg:block space-y-4 lg:space-y-6 sticky top-20 self-start max-h-[calc(100vh-2rem)] overflow-y-hidden">
              {selectedSong && (
                <SongDetail
                  song={selectedSong}
                  onClose={() => setSelectedSong(null)}
                />
              )}
              <UsersCard />
            </aside>
          </div>
        </main>

        <Footer />

        {/* Mobile drawer for song details */}
        {!isDesktop && (
          <Drawer
            open={!!selectedSong}
            onOpenChange={(open) => !open && setSelectedSong(null)}
          >
            <DrawerContent>
              <DrawerHeader className="sr-only">
                <DrawerTitle>{t("songDetail.title")}</DrawerTitle>
              </DrawerHeader>
              <div className="p-4 overflow-y-auto max-h-[70vh]">
                <SongDetail
                  song={selectedSong}
                  onClose={() => setSelectedSong(null)}
                />
              </div>
            </DrawerContent>
          </Drawer>
        )}

        <Toaster />
      </div>
    </InstallationProvider>
  );
}
