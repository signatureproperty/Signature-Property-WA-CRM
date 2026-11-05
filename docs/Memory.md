# Project Memory & Decisions (Memory.md)
*Adapted from claude-mem & open-gsd for Antigravity AI Pair Programming*

### User Preferences & Working Style
* **Language Preference:** Explanations and conversational messages in friendly, clear Roman Urdu.
* **Communication Style:** Keep explanations direct, concise, and to the point. No fluff.
* **Skill Transparency:** Always end every turn with a short note of what skills were used and what was achieved.
* **Consistency Discipline:** The user has a sharp eye for visual consistency. Never invent new design patterns (like adding decorative icons to page headers) that don't exist in the rest of the CRM.

### Real Estate Domain Decisions
* **Niche Focus:** Real Estate Agencies & Brokers (Property deals, Plots, Villas, Apartments, Commercial).
* **Inventory Architecture:** Dedicated `/listings` page separate from `/contacts`.
* **Auto-Numbering:** `L-1`, `L-2`, `L-3` auto-generated (manual Sr No removed).
* **Auto-Title:** `{Size} {Unit} {Type} in {Area}` (e.g. *5 Marla House in Harbanspura*).
* **Statuses:** Simplified to `Available` and `Sold`.
* **Units Supported:** `Marla`, `Kanal`, `Sq. Ft.`, `Acre`, `Maraba`.
* **1-Click WhatsApp Sharing:** Generates formatted WhatsApp text summary with key details.

### System Architecture Facts
* **Framework:** Next.js 16 (Turbopack, App Router).
* **Backend:** Supabase PostgreSQL 17 with Row-Level Security (RLS) on all tables.
* **Active Remote Supabase Project:** `ruvijtkppnhhasunzoxy` (Signature Property WA CRM).
* **Migrations Applied:** 001 through 060 (`060_property_listings.sql` live).

