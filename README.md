# YARG Content Aggregator

The **YARG Content Aggregator** is a modern, high-performance web platform designed to index and serve music charts for **Yet Another Rhythm Game (YARG)**. By searching external repositories like [Enchor.us](https://enchor.us) and [Rhythmverse](https://rhythmverse.co/songfiles/game/yarg) and storing metadata locally, it provides a fast, centralized, and collaborative experience for players.

## 🚀 Features

*   **Unified Search**: Browse and filter music charts from multiple sources in one place.
*   **Advanced Filtering**: Filter by instrument difficulty, genre, artist, and more.
*   **Provider Integration**: Direct API integration with Enchor and Rhythmverse to fetch the latest charts.
*   **Real-time Sharing**: Create collections and share them instantly with other devices on the network using **Socket.io**.
*   **Modern UI**: built with **Next.js**, **Tailwind CSS**, and **Shadcn UI** for a responsive and premium experience.

## 🛠️ Tech Stack

*   **Framework:** [Next.js](https://nextjs.org/) (App Router)
*   **Language:** [TypeScript](https://www.typescriptlang.org/)
*   **Styling:** [Tailwind CSS](https://tailwindcss.com/) + [Shadcn UI](https://ui.shadcn.com/)
*   **Database:** [MongoDB](https://www.mongodb.com/) (Data persistence)
*   **Real-time:** [Socket.io](https://socket.io/) (Device-to-device sharing)
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
    docker-compose up -d
    ```
    *Note: Ensure you have a `docker-compose.yml` configured for these services, or install them locally.*

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
*   Use the main table to browse songs.
*   Use the columns to sort by Name, Artist, or Year.
*   (Coming Soon) Advanced filters for specific instrument difficulties.

### Sharing Collections
1.  Select songs using the checkboxes in the table.
2.  View your collection in the sidebar.
3.  Enter a name for your device if prompted.
4.  See other active devices on the network and verify/share your collection with them directly.

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
│   ├── lib                 # Utilities (DB, Redis, socket)
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
