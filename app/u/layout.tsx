import Header from "@/components/layout/Header";
import BackgroundOrbs from "@/components/layout/BackgroundOrbs";
import Footer from "@/components/layout/Footer";

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-linear-to-br from-background via-background to-primary/10">
      <BackgroundOrbs />
      <Header />
      <main className="container mx-auto px-4 py-8 relative z-10">
        {children}
      </main>
      <Footer />
    </div>
  );
}
