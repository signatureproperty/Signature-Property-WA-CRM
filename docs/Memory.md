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
* **Google Sheet-Style Dynamic Custom Columns:**
  * Both Contacts and Listings feature dynamic spreadsheet-style custom columns (`text`, `number`, `select` dropdown with custom options, and `date`).
  * Custom Column Manager (`CustomColumnManager`) allows creating, renaming, re-typing, configuring dropdown options, and deleting columns.
  * Columns visibility dropdown ("Columns") allows users to show/hide default and custom columns.
  * Forms (`ContactForm`, `ListingForm`) dynamically render all custom columns.
  * Detail views (`ContactDetailView`, `ListingDetailView`) allow inspecting and updating all custom columns.
* **Auto-Creation of Columns on Import:**
  * When importing a Google Sheet / CSV into Contacts or Listings, any extra headers (e.g. `City, Area, Property Type, Size, Budget, Investor, Notes` or custom listing columns) are automatically registered in the database as custom fields with inferred types (`select`, `number`, `text`) and populated for every row.
* **Real Estate Contacts Import:**
  * Supports real estate Google Sheet format (`Date, Number, Name, City, Area, Property Type, Size, Budget, Investor, Notes`).
  * Column aliases for phone: `number`, `phone number`, `mobile`, `contact`, `cell`, `whatsapp`.
  * Auto-normalizes Pakistani phone numbers (`03xx...`, `3xx...`, `923xx...` -> `+923xx...`).
  * Auto-creates filterable tags and auto-creates missing custom columns.
* **Property Listings CSV Import:**
  * Dedicated modal on `/listings` with "Import" button.
  * Direct ingestion of user's Google Sheet columns: `Sr No`, `Date`, `Number`, `City`, `Area`, `Address`, `Property Type`, `Size`, `Storey`, `Utilities`, `Status`, `Potential Rent`, `Front`, `Length`, `Demand`, `Documents`.
  * Auto-detects custom columns and saves them into `property_listings.custom_fields`.

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
* **Migrations Applied:** 001 through 062 (including `060_property_listings.sql`, `061_redeem_invitation_property_listings.sql`, and `062_custom_fields_enhancements.sql` live).
