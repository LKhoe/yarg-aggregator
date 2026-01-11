# YARG Content Aggregator

The **YARG Content Aggregator** is a modern, high-performance web platform designed to index and serve music charts for **Yet Another Rhythm Game (YARG)**. By searching external repositories like [Enchor.us](https://enchor.us) and [Rhythmverse](https://rhythmverse.co/songfiles/game/yarg) and storing metadata locally, it provides a fast, centralized, and collaborative experience for players.

> [!NOTE]
> This is a community-made tool and is not affiliated with the YARG project.

## 🚀 Features

*   **Unified Search**: Browse and filter music charts from multiple sources in one place.
*   **"Fuzzy" Split-Term Search**: Find songs easily even if you type words out of order (e.g., "Park Linkin").
*   **Advanced Filtering**: Filter by instrument difficulty, genre, artist, and more.
*   **Provider Integration**: Direct API integration with Enchor and Rhythmverse to fetch the latest charts.
*   **Device-to-Device Sharing**: Create collections and share them with other devices via REST API.
*   **Personalization**: Set a custom device name to identify yourself when sharing.
*   **Modern UI**: built with **Next.js**, **Tailwind CSS**, and **Shadcn UI** for a responsive and premium experience.

## 🛠️ Tech Stack

*   **Framework:** [Next.js](https://nextjs.org/) (App Router)
*   **Language:** [TypeScript](https://www.typescriptlang.org/)
*   **Styling:** [Tailwind CSS](https://tailwindcss.com/) + [Shadcn UI](https://ui.shadcn.com/)
*   **Database:** [MongoDB](https://www.mongodb.com/) (Data persistence)
*   **API:** REST APIs for data retrieval and sharing
*   **Containerization:** Docker & Docker Compose

## 📋 Prerequisites

Ensure you have the following installed:

*   **Node.js** (v18+ LTS)
*   **Docker** & **Docker Compose** (for database services)
*   **pnpm** (recommended) or npm

## ⚙️ Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-org/yarg-aggregator.git
    cd yarg-aggregator
    ```

2.  **Install dependencies:**
    ```bash
    pnpm install
    ```

3.  **Configure Environment Variables:**
    Create a `.env.local` file in the root directory:
    ```env
    # Database
    MONGODB_URI=mongodb://localhost:27017/yarg_db

    # App
    NEXT_PUBLIC_APP_URL=http://localhost:3000
    ```

4.  **Start Infrastructure:**
    Start the required MongoDB and Redis services using Docker:
    ```bash
    docker compose -f docker-compose-dev.yml up -d
    ```
    *Note: For production, use `docker-compose.yml` instead.*
    *Note2: You'll need to donwload and load the MongoDB image from [MongoDB - Raspberry Pi - Themattman](https://github.com/themattman/mongodb-raspberrypi-docker?tab=readme-ov-file).*

5.  **Run the Application:**
    ```bash
    pnpm dev
    ```
    The app will be available at [http://localhost:3000](http://localhost:3000).

## 📖 Usage Guide

### Fetching Music
1.  Navigate to the **Provider Control** panel on the right sidebar.
2.  Select a source (`Enchor`, `Rhythmverse`, or `All`).
3.  Click **Start Fetch**.
4.  The system will start a background fetch on the backend. You can monitor progress in real-time.

### Browsing & Filtering
*   **Search**: Type keywords in the search bar. You can search by song name, artist, or album. The search is flexible and finds matches even if words are scrambled.
*   **Sort**: Use the columns to sort by Name, Artist, or Year.
*   **Filters**: Filter by instrument, source, or view only your saved songs.

### Account & Sharing
1.  **Device Name**: Click "Change" next to your device name in the header to update how you appear to others.
2.  **Collections**:
    -   Click the **Heart** icon to save songs to your collection.
    -   Use the **Saved Songs** panel to manage your list.
    -   Export/Import your list or clear it entirely.
    -   Open all download pages at once for bulk downloading.

## 🏗️ Project Structure

```text
├── src
│   ├── app                 # Next.js App Router pages
│   │   ├── api             # API Routes (Providers, Search, Device)
│   │   ├── layout.tsx      # Root layout
│   │   └── page.tsx        # Home page
│   ├── components          # React Components
│   │   ├── ui              # Reusable UI components
│   │   ├── providers       # Provider control panel
│   │   ├── data-table      # Song list implementation
│   │   └── collection      # Collection management & sharing
│   ├── lib                 # Utilities (DB, Queue)
│   ├── models              # Mongoose Schemas
│   ├── services            # Business Logic
│   │   ├── providers       # API Clients (Enchor, Rhythmverse)
│   │   └── queue           # (deprecated)
│   └── types               # TypeScript Interfaces
```

## 🤝 Contributing

Contributions are welcome! Please run the linter before submitting PRs:

```bash
pnpm lint
```

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).

