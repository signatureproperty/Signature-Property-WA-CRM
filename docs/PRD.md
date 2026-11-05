# Product Requirements Document (PRD)
## Signature Property — WhatsApp Automation CRM for Real Estate

### 1. Product Vision & Executive Summary
Signature Property WA CRM is a multi-tenant, self-hosted WhatsApp CRM engineered specifically for Real Estate agencies, property brokers, and sales teams. It bridges direct customer communication on WhatsApp with structured real estate property inventory, sales pipelines, broadcast campaigns, and visual workflow automations.

### 2. User Personas
* **Agency Owner / Broker:** Manages the agency, monitors team performance, oversees high-value property deals, and controls Meta WhatsApp credentials.
* **Real Estate Agent / Sales Rep:** Answers buyer inquiries in the unified WhatsApp inbox, shares property listings and PDF brochures in 1 click, tracks leads on visual pipeline boards, and schedules site visits.
* **Buyer / Investor (End User):** Reaches out on WhatsApp, receives instant automated property recommendations, and communicates with human agents.
* **Seller / Property Owner:** Lists their property for sale/rent with the agency.

---

### 3. Core Functional Modules

#### 3.1. Property Listings Inventory (`/listings`)
* **Auto-Numbering:** Automated reference code generation (`L-1`, `L-2`, `L-3`...).
* **Auto-Generated Titles:** Structured naming format (`{Size} {Unit} {Type} in {Area}`, e.g., *"5 Marla House in Harbanspura"*).
* **Dimensional Specifications:** Front and Length dimensions (e.g. 30 ft × 55 ft), Storey count, and flexible unit selector (`Marla`, `Kanal`, `Sq. Ft.`, `Acre`, `Maraba`).
* **Pricing & Financials:** Demand / Asking price (e.g. 2.2 Cr) and Potential Rental Income.
* **Legal & Utilities:** Ownership documentation (`Registry Inteqal`, `Fard`, `Allotment Letter`) and utility statuses (Electricity, Gas, Water).
* **Status Tracking:** Direct binary state (`Available`, `Sold`).
* **1-Click WhatsApp Share:** Pre-formats clean, emoji-formatted property summary to clipboard ready to send to clients on WhatsApp.
* **Dual View:** Spreadsheet-style Table view with customizable column toggles and Real Estate Cards view.

#### 3.2. Contacts & Client Management (`/contacts`)
* Client categorization: Buyers, Sellers, Tenants, Investors.
* Quick inline Tag creation (`+ Add Tag`) directly inside the contact modal.
* Custom fields (e.g., Preferred Society, Minimum Budget, Maximum Budget).
* Duplicate detection based on international phone numbers.

#### 3.3. WhatsApp Inbox & Live Chat (`/inbox`)
* Unified team inbox with live real-time messaging powered by Supabase.
* Multi-agent conversation assignment (Agent assignment, presence status).
* Audio recorder (Opus voice notes), media attachments, quick reply snippets.
* Contact sidebar with notes, tags, and linked pipeline deals.

#### 3.4. Sales Pipelines & Kanban Board (`/pipelines`)
* Customizable deal stages (e.g., *New Inquiry → Qualified → Site Visit Scheduled → Negotiation → Token Paid → Closed Won*).
* Drag-and-drop deal movement.
* Linking deals to specific Property Listings and Contacts.

#### 3.5. Automations & Visual Flows (`/automations` & `/flows`)
* Keyword-based triggers (e.g., client sends "Harbanspura House" -> auto-reply with matching listing details).
* Interactive WhatsApp messages (Buttons, List menus).
* Wait steps, condition branches, and drip follow-up sequences.

#### 3.6. Broadcast Campaigns (`/broadcasts`)
* Targeted messaging to tagged segments (e.g., broadcast newly listed commercial plot to all contacts tagged `Investor`).
* Template compliance with Meta Cloud API.

#### 3.7. AI Reply Assistant (`/agents`)
* Knowledge base search via Postgres `pgvector` for instant automated answers.
* Human takeover toggle to pause AI when an agent joins the conversation.

---

### 4. Non-Functional Requirements
* **Data Isolation:** 100% strict multi-tenancy enforced by PostgreSQL Row-Level Security (RLS). No customer can ever query or access another account's records.
* **Design Consistency:** Strict adherence to the CRM design system (typography, button dimensions, input backgrounds, modal wrappers).
* **Performance:** Sub-100ms UI responsiveness, server-side pagination, optimistic UI updates.

