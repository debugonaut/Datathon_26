# Fix My Hostel: Comprehensive Project Documentation

## 1. Project Overview & Motivation

**Project Name:** Fix My Hostel
**Target Event:** Datathon 2026
**Theme/Domain:** Smart Campus & Infrastructure Management

**The Problem:** 
Managing hostel infrastructure is historically chaotic. Students report issues (plumbing, electrical, furniture) through outdated methods like physical registers or scattered WhatsApp groups. Wardens struggle to track open issues, prioritize them, and communicate ETA to students. There is no data to identify recurring systemic issues (e.g., constant pipe leaks on a specific floor) or to hold maintenance staff accountable.

**The Solution:**
"Fix My Hostel" is an enterprise-grade, intelligent issue tracking system bridging the communication gap between students and wardens. By leveraging modern web technologies, real-time databases, and generative AI, the platform automates triage, enforces service-level agreements (SLAs), and provides a transparent, visual dashboard for both students and administration.

---

## 2. Core Architecture & Tech Stack

*   **Frontend Framework:** React + Vite
*   **Routing:** React Router v6
*   **Styling:** Custom CSS with an emphasis on a glassmorphic, premium dark-mode aesthetic.
*   **Database & Backend:** Firebase Firestore (NoSQL Document Database)
*   **Authentication:** Firebase Auth (Email/Password)
*   **Storage:** Firebase Storage (for media, images, audio blobs)
*   **Data Visualization:** Recharts (Area, Pie, Radial charts)
*   **Interactive UI:** `@dnd-kit` for drag-and-drop Kanban boards.
*   **Artificial Intelligence:** Anthropic Claude 3.5 Sonnet API via `@anthropic-ai/sdk`.
*   **Voice APIs:** Native Web Speech API, MediaRecorder API.

---

## 3. Key Modules Built Throughout the Project

### A. The 3D Visualizer & Hierarchy Mapping
The foundation of the app is its deep spacial awareness. Wardens can map out their hostel in a strict hierarchy: `Block → Building → Floor → Room`.
*   A **3D Visualizer** allows admins to view the spatial distribution of complaints across the physical layout of the building.
*   **QR Room Keys:** Every mapped room generates a unique QR code. Students simply scan the QR code pasted on their door to authenticate and automatically link their profile to that specific room.

### B. Intelligent Complaint Logging (Student Side)
Filing a complaint is frictionless and heavily augmented by AI.
*   **Dual-Tier Voice Engine:** Students can speak their complaints.
    *   *Tier 1 (Chrome/Safari):* Uses the native `Web Speech API` for instant dictation. If spoken in a regional language (Hindi, Marathi, Gujarati), it is captured and instantly translated to English via the MyMemory API.
    *   *Tier 2 (Firefox):* Falls back to `MediaRecorder`, saving the spoken audio as a `.webm` voice note attached to the ticket.
*   **Anthropic Context Analyzer:** When a student uploads a photo, finishes dictating, or types a description, Claude 3.5 Sonnet analyzes the combined inputs. It automatically categorizes the issue (Plumbing, Electrical, etc.), assigns a priority (Low, Medium, High), and drafts a clean title.

### C. Warden Intelligence & Triage (Warden Side)
Wardens manage issues via a real-time, interactive Kanban Board ("To Do", "In Progress", "Resolved").
*   **Strict SLAs:** Every ticket has a countdown timer based on its priority (High: 24h, Medium: 72h, Low: 168h). Breached SLAs trigger red alert banners globally on the dashboard.
*   **Systemic Clustering:** The system automatically cross-references active complaints. If 3 or more similar issues (e.g., Electrical) occur on the same Floor of the same Building within a 7-day window, a "Cluster Alert" is generated, suggesting a systemic failure rather than isolated incidents.
*   **Workflow Tracking:** 
    *   **Acknowledgements:** Wardens explicitly acknowledge seeing a ticket.
    *   **ETA Setting:** Wardens can set an `estimatedResolutionAt` datetime, instantly visible to the student.
    *   **Internal Notes:** Staff can collaborate via a secure "Notes" section locked behind Firestore Security Rules, ensuring students never see backend staff communication.

### D. Advanced Analytics
*   **Room Health Score:** Every room starts with a score of 100.
    *   Filing a complaint deducts points based on severity (High: -30, Medium: -15, Low: -5).
    *   Resolving the complaint refunds the points.
    *   The student dashboard features a massive conic-gradient gauge showing their real-time "Room Health".
*   **Warden Global Analytics:** Wardens see application-wide metrics: breakdown of issues by category, average resolution times compared across blocks, and historical trend lines.

### E. Student Empowerment & Feedback Loop
*   **Search & Filter Engine:** As complaint history grows, students can filter by Status, Category, Priority, or free-text search to find old issues.
*   **Withdrawal System:** If an issue resolves itself (e.g., internet comes back online), the student can instantly "Withdraw" the complaint, automatically refunding the room score.
*   **Re-Open System:** If maintenance claims an issue is resolved but it isn't, the student has up to 2 chances to "Re-open" the ticket with a mandatory justification, immediately pinging the warden back.

---

## 4. Security & Data Integrity

The application utilizes strict **Firestore Security Rules**:
*   Students can only read and write documents explicitly tied to their `uid` or `roomId`.
*   Wardens (validated via a `role == 'warden'` check on their user document) have global read/write access to manage the hostel they are assigned to.
*   Client-side stripping combined with database rules ensure sensitive fields (like `internalNotes`) never leak to the student frontend.
