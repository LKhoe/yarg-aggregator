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
        Last updated: November 6, 2026
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
          (e.g., Google or Last.fm), we receive basic profile information from
          that service, such as your email address, name and profile picture
          (Google) or your username (Last.fm). Section 9 explains how we handle
          data received from Google.
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
          <li>
            If you choose to connect your YouTube account, to read your own
            playlists so you can find which of their songs have charts
            available (see Section 9).
          </li>
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
          public listening data is fetched via the Last.fm public API. If you
          sign in with Google or connect your YouTube account, Google&rsquo;s
          own terms and privacy policy also apply (see Section 9).
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">
          9. Google User Data and YouTube API Services
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          YARG Aggregator uses Google Sign-In and, only if you choose to import
          your YouTube playlists, the YouTube API Services.
        </p>
        <h3 className="text-base font-medium mb-2">What we access</h3>
        <ul className="list-disc list-inside text-muted-foreground space-y-1 leading-relaxed mb-4">
          <li>
            When you sign in with Google: your email address, name and profile
            picture (scopes <span className="font-mono text-foreground">openid</span>, <span className="font-mono text-foreground">email</span> and{" "}
            <span className="font-mono text-foreground">profile</span>).
          </li>
          <li>
            When you import a YouTube playlist: read-only access to your YouTube
            account (scope <span className="font-mono text-foreground">youtube.readonly</span>). We list your own
            playlists and read the video titles of the playlists you select.
            We cannot change, upload or delete anything on your YouTube
            account.
          </li>
        </ul>
        <h3 className="text-base font-medium mb-2">How we use it</h3>
        <p className="text-muted-foreground leading-relaxed mb-4">
          The email, name and picture are used to create and identify your
          account. The YouTube playlist data is used for a single purpose: to
          match the video titles in a playlist you select against our index of
          charts, so you can see which songs have charts available. This
          happens when you request it, and playlist contents are not stored in
          our database.
        </p>
        <h3 className="text-base font-medium mb-2">Storage, sharing and retention</h3>
        <p className="text-muted-foreground leading-relaxed mb-4">
          To make these requests on your behalf we store the access and refresh
          tokens that Google issues to us, linked to your account. They are
          deleted when you delete your account. We do not sell Google user
          data, use it for advertising, or share it with third parties, except
          where necessary to operate the service, to comply with the law, or
          with your consent. No one at YARG Aggregator reads your Google data
          except for security purposes, to comply with the law, or with your
          consent. We do not use Google user data to develop, improve or train
          artificial intelligence or machine learning models.
        </p>
        <h3 className="text-base font-medium mb-2">Limited Use</h3>
        <p className="text-muted-foreground leading-relaxed mb-4">
          YARG Aggregator&rsquo;s use and transfer to any other app of
          information received from Google APIs will adhere to the{" "}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </p>
        <h3 className="text-base font-medium mb-2">Revoking access</h3>
        <p className="text-muted-foreground leading-relaxed mb-4">
          You can revoke YARG Aggregator&rsquo;s access to your Google account at
          any time in your{" "}
          <a
            href="https://myaccount.google.com/permissions"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Google Account permissions
          </a>
          . You can also delete your account from the Settings page, which
          removes the stored tokens.
        </p>
        <h3 className="text-base font-medium mb-2">YouTube API Services</h3>
        <p className="text-muted-foreground leading-relaxed">
          By using the YouTube features of this service, you are bound by the{" "}
          <a
            href="https://www.youtube.com/t/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            YouTube Terms of Service
          </a>{" "}
          and agree to the{" "}
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Google Privacy Policy
          </a>
          .
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">10. Contact</h2>
        <p className="text-muted-foreground leading-relaxed">
          If you have questions about this Privacy Policy, please open an issue
          on our public repository or contact the project maintainers directly.
        </p>
      </section>
    </article>
  );
}
