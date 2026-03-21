# Fix My Hostel: Comprehensive Project Documentation

## 1. Project Overview & Motivation

**Project Name:** Fix My Hostel
**Target Event:** Datathon 2026
**Theme/Domain:** Smart Campus Infrastructure — Hostel Maintenance Intelligence Platform

**The Problem:** 
Managing hostel infrastructure is historically chaotic. Students report issues (plumbing, electrical, furniture) through outdated methods like physical registers or scattered WhatsApp groups. Wardens struggle to track open issues, prioritize them, and communicate ETA to students. There is no data to identify recurring systemic issues (e.g., constant pipe leaks on a specific floor) or to hold maintenance staff accountable.

**The Solution:**
"Fix My Hostel" is an enterprise-grade, intelligent issue tracking system bridging the communication gap between students and wardens. By leveraging modern web technologies, real-time databases, and generative AI, the platform automates triage, enforces service-level agreements (SLAs), and provides a transparent, visual dashboard for both students and administration. The system is designed for universal deployment — any hostel worldwide can be fully onboarded in under 5 minutes using the guided setup wizard, requiring zero technical knowledge from the administrator.

---

## 2. Core Architecture & Tech Stack

*   **Frontend Framework:** React + Vite
*   **Routing:** React Router v6
*   **Styling:** Custom CSS with an emphasis on a glassmorphic, premium dark-mode aesthetic.
*   **Database & Backend:** Firebase Firestore (NoSQL Document Database)
*   **Authentication:** Firebase Auth (Google OAuth, restricted to @mitaoe.ac.in institutional emails only)
*   **Storage:** Firebase Storage (for media, images, audio blobs)
*   **Data Visualization:** Recharts (Area, Pie, Radial charts)
*   **Interactive UI:** `@dnd-kit` for drag-and-drop Kanban boards.
*   **Artificial Intelligence:** Anthropic Claude API (claude-sonnet-4-20250514) via direct fetch
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
*   **Student Personal Analytics:** Each student has a personal 
    "My Stats" dashboard showing their room health gauge (radial), 
    30-day score trend (area chart), complaint category breakdown 
    (donut chart), personal vs hostel-average resolution time 
    (radial bar chart), and a full complaint status timeline 
    with overdue flags.

### E. Student Empowerment & Feedback Loop
*   **Search & Filter Engine:** As complaint history grows, students can filter by Status, Category, Priority, or free-text search to find old issues.
*   **Withdrawal System:** If an issue resolves itself (e.g., internet comes back online), the student can instantly "Withdraw" the complaint, automatically refunding the room score.
*   **Re-Open System:** If maintenance claims an issue is resolved but it isn't, the student has up to 2 chances to "Re-open" the ticket with a mandatory justification, immediately pinging the warden back.

### F. Secure Student Onboarding & Room Registration

Student registration is a one-time, verified process designed to prevent
unauthorized room claims and ensure institutional data integrity.

**Profile Setup:**
- Students complete a one-time profile form after Google OAuth
- PRN (Permanent Registration Number) is validated as exactly 12 digits,
  purely numerical, non-zero leading, and cross-checked against the
  student's college email (MITAOE format: {PRN}@mitaoe.ac.in)
- PRN uniqueness is enforced via a Firestore-wide query before submission
  preventing identity duplication across the entire system

**Room Claiming:**
- Students scan the QR code on their physical door or enter the 6-character
  room code to claim their room
- Before confirming, the student's PRN is SHA-256 hashed using the native
  Web Crypto API and compared against all existing occupant hashes in the
  room document — preventing the same student from claiming multiple rooms
- Room joins use atomic Firestore transactions to prevent race conditions
  when multiple students attempt to claim the last available bed simultaneously
- Wardens control maxOccupants per room and can eject and reassign
  students from the dashboard

**QR Smart Routing:**
- The /room/:roomId route intelligently handles all states:
  unauthenticated users are redirected to login with the roomId preserved
  in localStorage, unregistered students are taken through the profile and
  room setup flow, and registered students are taken directly to the
  complaint filing form for their room
- Cross-room complaint filing is blocked — students can only file complaints
  for their own assigned room

---

### G. Room History & Institutional Memory

Every room maintains a permanent complaint record that persists across 
tenant changes, giving new students full transparency into the room's 
maintenance history before they move in.

**Pre-move-in transparency:**
- Before confirming room registration, students see the room's full 
  complaint history, an AI-generated summary, top recurring issue 
  category, and average resolution time across all previous tenants

**Persistent timeline:**
- The room history view on the student dashboard shows all complaints 
  ever filed for that room across all tenants
- Previous tenant complaints are anonymized — shown as "Previous tenant" 
  with no name or UID exposed to protect privacy

**AI-generated briefing:**
- Claude (claude-sonnet-4-20250514) generates a 2-sentence neutral 
  summary of the room's maintenance record written as a briefing 
  for an incoming tenant
- Generated from: total complaints, resolution rate, most common issue 
  category, average resolution time, and re-open count

**Warden institutional memory:**
- Wardens can view full room histories with tenant details intact
- Enables identification of chronic problem rooms before new allocations
- Complements the 3D visualizer's real-time health scores with 
  historical context

## 4. Security & Data Integrity

The application utilizes strict **Firestore Security Rules**:
*   Students can only read and write documents explicitly tied to their `uid` or `roomId`.
*   Wardens (validated via a `role == 'warden'` check on their user document) have global read/write access to manage the hostel they are assigned to.
*   Client-side stripping combined with database rules ensure sensitive fields (like `internalNotes`) never leak to the student frontend.
