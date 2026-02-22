import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — YARG Aggregator",
  description: "Privacy Policy for YARG Aggregator.",
};

export default function PrivacyPage() {
  return (
    <article className="prose prose-neutral dark:prose-invert max-w-none">
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-muted-foreground text-sm mb-8">
        Last updated: February 22, 2026
      </p>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">1. Overview</h2>
        <p className="text-muted-foreground leading-relaxed">
          YARG Aggregator (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or
          &ldquo;us&rdquo;) is a community-made tool for browsing and
          discovering music charts for YARG (Yet Another Rhythm Game). This
          Privacy Policy explains what information we collect, how we use it,
          and your rights regarding your data.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">2. Information We Collect</h2>
        <h3 className="text-base font-medium mb-2">Account Information</h3>
        <p className="text-muted-foreground leading-relaxed mb-4">
          When you create an account, we collect your email address, display
          name, and a hashed password. If you sign in via a third-party service
          (e.g., Last.fm), we receive basic profile information such as your
          username from that service.
        </p>
        <h3 className="text-base font-medium mb-2">Usage Data</h3>
        <p className="text-muted-foreground leading-relaxed mb-4">
          We store data you create within the platform: song lists, installation
          records, and favorited songs. We also record session tokens to keep
          you signed in.
        </p>
        <h3 className="text-base font-medium mb-2">Device Information</h3>
        <p className="text-muted-foreground leading-relaxed">
          We collect a device name that you choose when registering a device.
          This is used solely to identify devices linked to your account so you
          can manage them.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">3. How We Use Your Information</h2>
        <ul className="list-disc list-inside text-muted-foreground space-y-1 leading-relaxed">
          <li>To provide and operate the YARG Aggregator service.</li>
          <li>To authenticate you and maintain your session.</li>
          <li>To store your song lists, favorites, and installations.</li>
          <li>To send transactional emails (e.g., email verification, password reset).</li>
          <li>To display your public profile and public lists to other users.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">4. Data Sharing</h2>
        <p className="text-muted-foreground leading-relaxed">
          We do not sell, trade, or rent your personal information to third
          parties. Your email address is never publicly visible. Your display
          name and public lists are visible to other users of the platform.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">5. Data Retention</h2>
        <p className="text-muted-foreground leading-relaxed">
          We retain your data for as long as your account is active. You may
          delete your account at any time from the Settings page, which will
          permanently remove all your data from our systems.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">6. Cookies & Sessions</h2>
        <p className="text-muted-foreground leading-relaxed">
          We use HTTP-only session cookies strictly to keep you authenticated.
          We do not use tracking cookies or third-party analytics cookies.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">7. Your Rights</h2>
        <p className="text-muted-foreground leading-relaxed">
          You may access, correct, or delete your personal data at any time via
          the Settings page. You may also request data export or deletion by
          contacting us. If you are located in the EU/EEA, you have rights under
          GDPR including the right to access, rectify, erase, and port your data.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">8. Third-Party Services</h2>
        <p className="text-muted-foreground leading-relaxed">
          Music chart data is aggregated from Enchor.us and Rhythmverse. We do
          not control these services and their own privacy policies apply when
          you interact with them directly. If you connect a Last.fm account, your
          public listening data is fetched via the Last.fm public API.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">9. Contact</h2>
        <p className="text-muted-foreground leading-relaxed">
          If you have questions about this Privacy Policy, please open an issue
          on our public repository or contact the project maintainers directly.
        </p>
      </section>
    </article>
  );
}
