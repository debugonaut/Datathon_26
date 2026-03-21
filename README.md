# Fix My Hostel

A comprehensive, intelligent hostel management system built with React, Vite, and Firebase. This application streamlines complaint tracking, room management, and student-warden communication.

## Key Features

### 🎙️ Student Tools
*   **Dual-Tier Voice Reporting:** Effortlessly log complaints using native Web Speech API (Chrome/Safari) or MediaRecorder fallback (Firefox), complete with MyMemory automated translation to English.
*   **AI Auto-Fill:** Powered by Anthropic's Claude 3.5 Sonnet, the app analyzes uploaded images, voice transcripts, and text descriptions to automatically select the right category and priority level.
*   **Complaint Lifecycle Management:** Withdraw complaints if fixed, or re-open them (up to 2 times) if the issue persists.
*   **Advanced Search & Filtering:** Filter your timeline by status, category, priority, or text search.
*   **Live Room Score:** Maintain a room health score (0-100) based on resolution times and complaint frequency.

### 🛡️ Warden Intelligence
*   **Automated SLAs (Service Level Agreements):** Visual countdown timers enforce strict resolution deadlines based on priority (High: 24h, Medium: 72h, Low: 168h), with auto-escalation banners for breached cases.
*   **Systemic Issue Clustering:** Automatically detects clusters (e.g., 3 plumbing issues on Floor 1 within 7 days) to highlight widespread problems.
*   **Interactive Kanban Board:** Drag-and-drop complaints through "To Do", "In Progress", and "Resolved" statuses.
*   **Detailed Workflow Tracking:** Acknowledge new complaints, set estimated resolution dates, and track student withdrawals/re-opens.
*   **Secure Internal Notes:** Add private, staff-only notes to complaints which are hidden from students via UI and Firestore Security Rules.

## Tech Stack
*   **Frontend**: React + Vite
*   **Backend**: Firebase (Auth, Firestore, Storage)
*   **Charting**: Recharts
*   **Drag and Drop**: dnd-kit
*   **AI & ML**: Anthropic API (`@anthropic-ai/sdk`), Web Speech API, MyMemory API

## Getting Started

1. **Clone the repository.**
2. **Install dependencies:** `npm install`
3. **Set up Firebase:**
   * Create a Firebase project and enable Auth (Email/Password), Firestore, and Storage.
   * Add your config variables to `.env`:
     ```env
     VITE_FIREBASE_API_KEY=your_api_key
     VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
     VITE_FIREBASE_PROJECT_ID=your_project_id
     VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
     VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
     VITE_FIREBASE_APP_ID=your_app_id
     VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
     ```
4. **Set up AI Analysis:**
   * Add your Anthropic API Key to `.env`:
     ```env
     VITE_ANTHROPIC_API_KEY=your_anthropic_key
     ```
5. **Set up Firestore Rules:**
   * Deploy the included `firestore.rules` to secure complaint reads/writes between wardens and students.
6. **Start Dev Server:** `npm run dev`
