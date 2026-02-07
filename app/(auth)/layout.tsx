import Header from "@/components/layout/Header";
import BackgroundOrbs from "@/components/layout/BackgroundOrbs";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <BackgroundOrbs />
      <Header />
      <main className="container mx-auto flex items-center justify-center min-h-[calc(100vh-4rem)] px-4 py-8">
        {children}
      </main>
    </div>
  );
}
