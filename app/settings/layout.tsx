import Header from "@/components/layout/Header";
import BackgroundOrbs from "@/components/layout/BackgroundOrbs";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <BackgroundOrbs />
      <Header />
      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
