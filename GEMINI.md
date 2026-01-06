# GEMINI Project Analysis: PNEUMA

This document provides a comprehensive analysis of the PNEUMA project, generated to serve as a contextual guide for future development and maintenance.

## Project Overview

PNEUMA is a local-first, personal finance desktop application built with a hybrid architecture. The frontend is a Next.js web application, and the backend is a Rust application using the Tauri framework. This combination allows for a fast, native-like user experience while leveraging web technologies for the user interface.

The application's core philosophy is to provide calm, daily financial guidance, focusing on daily spending limits and a buffer fund (Dana Penyangga) to reduce decision fatigue and financial anxiety.

**Key Technologies:**

*   **Frontend:** Next.js 15, React 19, TypeScript
*   **Backend:** Rust, Tauri 2
*   **Database:** SQLite (local-only)
*   **Package Manager:** npm

## Building and Running

The project uses `npm` for script management. The following commands are essential for development and building:

*   **Install Dependencies:**
    ```bash
    npm install
    ```

*   **Run in Development Mode:**
    This command starts the Next.js development server and the Tauri application in parallel.
    ```bash
    npm run tauri dev
    ```

*   **Build for Production:**
    This command builds the Next.js frontend and then the Tauri application for the current platform.
    ```bash
    npm run build
    npm run tauri build
    ```

*   **Linting and Type Checking:**
    The project is configured with ESLint and TypeScript for code quality.
    ```bash
    npm run lint
    npm run typecheck
    ```

## Development Conventions

*   **Architecture:** The application follows a clear separation of concerns between the frontend (UI and user interaction) and the backend (data, business logic). Communication between the two is handled through Tauri's command bridge.
*   **State Management:** The frontend uses React's built-in state management (`useState`, `useEffect`, `useCallback`) to manage component state and data fetched from the backend.
*   **Styling:** The project uses global CSS (`app/globals.css`).
*   **Routing:** The Next.js App Router is used for navigation.
*   **Data Fetching:** The frontend communicates with the Rust backend using Tauri's `invoke` function to call registered commands.
*   **Testing:** The Rust backend includes a suite of unit tests. The frontend has a smoke test script (`scripts/ui-smoke.mjs`).
*   **Coding Style:** The project uses the standard Next.js ESLint configuration to enforce a consistent coding style.

## Backend (Rust)

The Rust backend is responsible for:

*   **Database Operations:** All interactions with the SQLite database are handled by the Rust backend. The `rusqlite` crate is used for this purpose.
*   **Business Logic:** The core business logic, including calculating financial summaries and coaching insights, is implemented in Rust for performance and safety.
*   **Tauri Commands:** The backend exposes a set of `#[tauri::command]` functions that can be called from the frontend. These commands handle tasks such as adding transactions, fetching data, and updating configuration.

## Frontend (Next.js)

The Next.js frontend is responsible for:

*   **User Interface:** Rendering the application's UI using React components.
*   **User Interaction:** Handling user input and events.
*   **State Management:** Managing the application's state and data.
*   **API Calls:** Calling the Rust backend's Tauri commands to fetch and manipulate data.
