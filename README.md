# YARG Content Aggregator

The **YARG Content Aggregator** is a modern, high-performance web platform designed to index and serve music charts for **Yet Another Rhythm Game (YARG)**. By searching external repositories like [Enchor.us](https://enchor.us) and [Rhythmverse](https://rhythmverse.co) and storing metadata locally, it provides a fast, centralized, and collaborative experience for players.

> [!NOTE]
> This is a community-made tool and is not affiliated with the YARG project.

## Features

- **Unified Search**: Browse and filter music charts from multiple sources in one place.
- **"Fuzzy" Split-Term Search**: Find songs easily even if you type words out of order (e.g., "Park Linkin").
- **Advanced Filtering**: Filter by instrument difficulty (guitar, bass, drums, keys, vocals), genre, artist, and more.
- **Provider Integration**: Direct API integration with Enchor and Rhythmverse to fetch the latest charts.
- **YARG Game Integration**: Parse your game's cache file to track installed songs across multiple installations.
- **User Accounts**: Authentication system with email/password login and session management.
- **Internationalization**: Available in 7 languages (English, Spanish, French, German, Japanese, Portuguese, Chinese).
- **Theme Support**: Light, dark, and system theme options.
- **Modern UI**: Built with **Next.js**, **Tailwind CSS**, and **Shadcn UI** for a responsive and premium experience.

## Tech Stack

- **Framework:** [Next.js](https://nextjs.org/) 16 (App Router)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) 4 + [Shadcn UI](https://ui.shadcn.com/)
- **Database:** [PostgreSQL](https://www.postgresql.org/) with [Drizzle ORM](https://orm.drizzle.team/)
- **Authentication:** [Better Auth](https://www.better-auth.com/)
- **Job Queue:** [BullMQ](https://docs.bullmq.io/) with Redis
- **Internationalization:** [next-intl](https://next-intl-docs.vercel.app/)
- **Containerization:** Docker & Docker Compose

## Prerequisites

Ensure you have the following installed:

- **Node.js** (v18+ LTS)
- **Docker** & **Docker Compose** (for database services)
- **pnpm** (recommended) or npm

## Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-org/yarg-aggregator.git
   cd yarg-aggregator
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Configure Environment Variables:**
   Create a `.env.local` file in the root directory:
   ```env
   # Database
   DATABASE_URL=postgresql://postgres:password@localhost:5432/yarg_db

   # Redis (for job queue)
   REDIS_HOST=localhost
   REDIS_PORT=6379

   # App
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

4. **Start Infrastructure:**
   Start the required PostgreSQL and Redis services using Docker:
   ```bash
   docker compose -f docker-compose-dev.yml up -d
   ```

5. **Run Database Migrations:**
   ```bash
   pnpm db:migrate
   ```

6. **Set Up Full-Text Search:**
   ```bash
   pnpm db:setup
   ```

7. **Run the Application:**
   ```bash
   pnpm dev
   ```
   The app will be available at [http://localhost:3000](http://localhost:3000).

## Usage Guide

### Fetching Music
1. Navigate to the **Provider Control** panel.
2. Select a source (`Enchor`, `Rhythmverse`, or `All`).
3. Click **Start Fetch**.
4. The system will start a background fetch. You can monitor progress in real-time.

### Browsing & Filtering
- **Search**: Type keywords in the search bar. You can search by song name, artist, or album. The search is flexible and finds matches even if words are scrambled.
- **Sort**: Use the columns to sort by Name, Artist, or Year.
- **Filters**: Filter by instrument difficulty, source, or other criteria.

### YARG Integration
1. Add your YARG game installation path.
2. Upload your game's cache file to sync your installed songs.
3. View which songs you have installed directly in the music browser.

### Account Features
1. Create an account or log in with email/password.
2. Set a custom device name to identify yourself.
3. Manage your song collections and preferences.

## Project Structure

```
├── app/                    # Next.js App Router
│   ├── api/                # API Routes
│   │   ├── auth/           # Authentication endpoints
│   │   ├── installations/  # Game installation management
│   │   ├── installed-songs/# Installed songs tracking
│   │   ├── music/          # Music search and retrieval
│   │   └── providers/      # Provider management
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Home page
├── components/             # React Components
│   ├── ui/                 # Shadcn UI components
│   ├── cache/              # Cache file parsing
│   ├── data-table/         # Music table/grid
│   ├── installations/      # Installation management
│   ├── language/           # Language switcher
│   ├── layout/             # Header, Footer, etc.
│   ├── providers/          # Provider control panel
│   └── theme/              # Theme toggle
├── lib/                    # Utilities & Services
│   ├── db/                 # Database (Drizzle ORM)
│   │   ├── schema.ts       # Database schema
│   │   ├── migrations/     # Migrations
│   │   └── setup/          # Setup scripts
│   ├── services/           # Business logic
│   ├── auth.ts             # Authentication config
│   ├── queue.ts            # Job queue
│   └── utils.ts            # Helper functions
├── services/               # External Integrations
│   ├── cache-reader/       # YARG cache file parser
│   ├── providers/          # API clients (Enchor, Rhythmverse)
│   └── songs/              # Song management
├── messages/               # Localization (7 languages)
├── contexts/               # React contexts
├── hooks/                  # Custom React hooks
└── types/                  # TypeScript interfaces
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Build for production |
| `pnpm start` | Start production server |
| `pnpm lint` | Run ESLint |
| `pnpm db:generate` | Generate Drizzle migrations |
| `pnpm db:migrate` | Run database migrations |
| `pnpm db:studio` | Open Drizzle Studio |
| `pnpm db:setup` | Set up full-text search |

## Contributing

Contributions are welcome! Please run the linter before submitting PRs:

```bash
pnpm lint
```

## License

This project is open-source and available under the [MIT License](LICENSE).
