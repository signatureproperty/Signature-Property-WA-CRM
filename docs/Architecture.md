# System Architecture Document
## Technical Stack & System Design

### 1. High-Level Architecture

```
                    +---------------------------+
                    |    Meta Cloud WhatsApp    |
                    +-------------+-------------+
                                  | Inbound Webhooks
                                  v
+---------------------------------+---------------------------------+
|                        Next.js 16 Web App                         |
|  (App Router, React 19, Turbopack, Tailwind CSS v4, Base UI)     |
|                                                                   |
|  - UI Pages: /dashboard, /inbox, /contacts, /listings, /pipelines |
|  - Route Handlers: /api/whatsapp/webhook, /api/automations/cron   |
+---------------------------------+---------------------------------+
                                  |
                                  v
+---------------------------------+---------------------------------+
|                      Supabase Cloud Backend                       |
|                                                                   |
|  1. Auth: User Sessions, JWTs, Team Invitations                   |
|  2. Database: PostgreSQL 17 with Row Level Security (RLS)         |
|  3. Realtime: WebSockets for Instant Inbox & Notification delivery|
|  4. Storage: Buckets for Media, Voice Notes & Avatars             |
|  5. AI Embeddings: pgvector extension                             |
+-------------------------------------------------------------------+
```

---

### 2. Multi-Tenancy & Data Security Model
* **Tenancy Unit:** `account_id` (UUID). Every domain table carries an `account_id` foreign key referencing `accounts.id`.
* **Database Isolation:** PostgreSQL **Row Level Security (RLS)** is enabled on every single table.
* **Helper Function:**
  ```sql
  is_account_member(account_id UUID, min_role account_role_enum DEFAULT 'viewer')
  ```
  Evaluates whether the caller's JWT `auth.uid()` belongs to the specified account with sufficient role authorization.
* **Role Hierarchy:** `owner` > `admin` > `agent` > `viewer`.
* **Zero Cross-Contamination:** Even if a malicious user executes raw REST/GraphQL calls, PostgreSQL engine physically rejects any query across account boundaries.

---

### 3. WhatsApp Integration Architecture
* **Single Webhook Ingress:** All inbound events from Meta are received at `/api/whatsapp/webhook`.
* **HMAC-SHA256 Signature Verification:** Verified against `META_APP_SECRET`.
* **Multi-Account Dispatch:**
  1. Meta payload provides `entry[0].changes[0].value.metadata.phone_number_id`.
  2. The webhook query looks up the `whatsapp_config` row matching that `phone_number_id`.
  3. The associated `account_id` is resolved.
  4. Messages and media are routed to that account's inbox and automation triggers.
* **Credential Encryption:** WhatsApp permanent access tokens are encrypted in the database using **AES-256-GCM** with the server's `ENCRYPTION_KEY`.

---

### 4. Database Schema Structure
* `accounts`: Organization workspaces.
* `profiles`: User details and account membership link.
* `property_listings`: Real Estate properties (Serial number, Title, Dimensions, Demand, Status, Area, City, Utilities, Docs, Tags).
* `contacts` & `contact_tags`: Clients, Buyers, and Sellers with tagged categorization.
* `conversations` & `messages`: WhatsApp thread state, message timestamps, delivery receipts (`sent`, `delivered`, `read`).
* `pipelines` & `deals`: Visual sales stages and pipeline records.
* `automations` & `flows`: Event-driven workflows and condition graphs.

