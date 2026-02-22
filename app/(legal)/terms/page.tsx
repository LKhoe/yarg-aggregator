import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — YARG Aggregator",
  description: "Terms of Service for YARG Aggregator.",
};

export default function TermsPage() {
  return (
    <article className="prose prose-neutral dark:prose-invert max-w-none">
      <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
      <p className="text-muted-foreground text-sm mb-8">
        Last updated: February 22, 2026
      </p>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
        <p className="text-muted-foreground leading-relaxed">
          By accessing or using YARG Aggregator (&ldquo;the Service&rdquo;), you
          agree to be bound by these Terms of Service. If you do not agree, please
          do not use the Service. YARG Aggregator is a community-made tool and is
          not affiliated with the YARG project or its developers.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">2. Description of Service</h2>
        <p className="text-muted-foreground leading-relaxed">
          YARG Aggregator is a platform for indexing, searching, and browsing
          music chart metadata sourced from third-party providers (Enchor.us,
          Rhythmverse). We do not host or distribute any audio files or copyrighted
          musical works. All chart files are provided by and linked to their
          respective third-party sources.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">3. User Accounts</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          You are responsible for maintaining the confidentiality of your account
          credentials and for all activity under your account. You must provide
          accurate information when creating an account.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          We reserve the right to suspend or terminate accounts that violate these
          Terms or that engage in abusive, fraudulent, or harmful behavior.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">4. Acceptable Use</h2>
        <p className="text-muted-foreground leading-relaxed mb-2">You agree not to:</p>
        <ul className="list-disc list-inside text-muted-foreground space-y-1 leading-relaxed">
          <li>Use the Service for any unlawful purpose.</li>
          <li>
            Attempt to gain unauthorized access to other users&apos; accounts or
            to the underlying systems.
          </li>
          <li>Scrape or bulk-download data from the Service without permission.</li>
          <li>
            Upload, share, or link to content that infringes copyright or other
            intellectual property rights.
          </li>
          <li>
            Abuse the API or automation features in a way that degrades
            performance for other users.
          </li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">5. Intellectual Property</h2>
        <p className="text-muted-foreground leading-relaxed">
          Song metadata, chart files, and all associated content belong to their
          respective rights holders. YARG Aggregator only indexes publicly
          available metadata and does not claim ownership of any music, charts, or
          related content. The YARG Aggregator source code is open-source under
          its respective license.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">6. User-Generated Content</h2>
        <p className="text-muted-foreground leading-relaxed">
          Content you create on the Service (e.g., song lists, display names) is
          your responsibility. By making lists public, you grant other users the
          right to view them. We do not claim ownership of your content, but we
          may remove content that violates these Terms.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">7. Disclaimer of Warranties</h2>
        <p className="text-muted-foreground leading-relaxed">
          The Service is provided &ldquo;as is&rdquo; without warranties of any
          kind. We do not guarantee that the Service will be uninterrupted,
          error-free, or that chart data will be complete or accurate. Use the
          Service at your own risk.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">8. Limitation of Liability</h2>
        <p className="text-muted-foreground leading-relaxed">
          To the fullest extent permitted by law, YARG Aggregator and its
          maintainers shall not be liable for any indirect, incidental, or
          consequential damages arising from your use of the Service.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">9. Changes to Terms</h2>
        <p className="text-muted-foreground leading-relaxed">
          We may update these Terms from time to time. Continued use of the
          Service after changes are posted constitutes your acceptance of the
          revised Terms.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">10. Contact</h2>
        <p className="text-muted-foreground leading-relaxed">
          If you have questions about these Terms, please open an issue on our
          public repository or contact the project maintainers directly.
        </p>
      </section>
    </article>
  );
}
