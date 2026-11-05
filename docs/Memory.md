# Project Memory & Decisions (Memory.md)
*Persistent Context & Decisions Log — Powered by Claude-Mem & GSD*

### User Preferences & Working Style
* **Language Preference:** Explanations and conversational messages in friendly, clear Roman Urdu.
* **Communication Style:** Keep explanations direct, concise, and to the point. No fluff.
* **Skill Transparency:** Always end every turn with a short note of what skills were used and what was achieved.
* **Consistency Discipline:** The user has a sharp eye for visual consistency. Never invent new design patterns (like adding decorative icons to page headers or grey `bg-card` surfaces) that don't exist in the rest of the CRM.

### Real Estate Domain Decisions
* **Niche Focus:** Real Estate Agencies & Brokers (Property deals, Plots, Villas, Apartments, Commercial).
* **Inventory Architecture:** Dedicated `/listings` page separate from `/contacts`.
* **Auto-Numbering:** `L-1`, `L-2`, `L-3` auto-generated (manual Sr No removed).
* **Auto-Title:** `{Size} {Unit} {Type} in {Area}` (e.g. *5 Marla House in Harbanspura*).
* **Statuses:** Simplified to `Available` and `Sold`.
* **Units Supported:** `Marla`, `Kanal`, `Sq. Ft.`, `Acre`, `Maraba`.
* **1-Click WhatsApp Sharing:** Generates formatted WhatsApp text summary with key details.
* **Real Estate Contacts Import:**
  * Supports real estate Google Sheet format (`Date, Number, Name, City, Area, Property Type, Size, Budget, Investor, Notes`).
  * Column aliases for phone: `number`, `phone number`, `mobile`, `contact`, `cell`, `whatsapp`.
  * Auto-normalizes Pakistani phone numbers (`03xx...`, `3xx...`, `923xx...` -> `+923xx...`).
  * Auto-creates filterable tags from `City`, `Area`, `Property Type`, `Investor`.
  * Saves customer preferences (Budget, Area, Size, Date, Notes) directly into `contact_notes`.
* **Property Listings CSV Import:**
  * Dedicated modal on `/listings` with "Import" button.
  * Direct ingestion of user's Google Sheet columns: `Sr No`, `Date`, `Number`, `City`, `Area`, `Address`, `Property Type`, `Size`, `Storey`, `Utilities`, `Status`, `Potential Rent`, `Front`, `Length`, `Demand`, `Documents`.
  * Previews first 5 rows before importing. Auto-generates reference numbers (`L-1`, `L-2`) and titles if missing.

### UI & Dark Mode Consistency Lessons
* **Container Backgrounds:** Table containers must be `<div className="rounded-lg border border-border overflow-hidden">` WITHOUT `bg-card`. In dark mode, `bg-card` adds an elevated grey surface that clashes with the pure dark background.
* **Empty State Contract:**
  * Must render within the table (`<TableBody> -> <TableRow> -> <TableCell className="text-center py-12">`).
  * Icon must be bare: `<Building2 className="size-8 text-muted-foreground" />` (NO round background circle wrapper).
  * Text must be a simple `<p className="text-sm text-muted-foreground">` (NO `h3` heading).
  * Action button: `<Button variant="outline" size="sm" className="mt-2 border-border text-muted-foreground hover:bg-muted"><Plus className="size-3.5" /> Add your first property</Button>`.

### System Architecture Facts
* **Framework:** Next.js 16 (Turbopack, App Router).
* **Backend:** Supabase PostgreSQL 17 with Row-Level Security (RLS) on all tables.
* **Active Remote Supabase Project:** `ruvijtkppnhhasunzoxy` (Signature Property WA CRM).
* **Migrations Applied:** 001 through 061 (including `060_property_listings.sql` and `061_redeem_invitation_property_listings.sql` live).
