import Header from "@/components/layout/Header";
import BackgroundOrbs from "@/components/layout/BackgroundOrbs";
import Footer from "@/components/layout/Footer";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <BackgroundOrbs />
      <Header />
      <main className="container mx-auto px-4 py-12 max-w-3xl relative z-10">
        {children}
      </main>
      <Footer />
    </div>
  );
}
