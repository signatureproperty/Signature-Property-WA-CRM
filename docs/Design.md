# Design System & UI Specification (Design.md)

This document outlines the visual system, design tokens, color palette, component semantics, and typography rules across the CRM.

---

### 1. Typography & Hierarchy
* **Font Family:** Inherits system Geist Sans / Inter font stack.
* **Page Titles:** `text-2xl font-bold text-foreground` (or `tracking-tight`).
* **Subtitles:** `mt-1 text-sm text-muted-foreground`.
* **Section Headers:** `text-base font-semibold text-foreground`.
* **Labels:** `text-sm font-medium text-muted-foreground` (or `text-foreground`).
* **Micro-copy / Badges:** `text-xs` or `text-[10px]`.

---

### 2. Color Palette & Semantic Tokens
The application relies on CSS variables declared at `:root` and `.dark`:
* **Background (`bg-background`):** Deep canvas background.
* **Card (`bg-card`):** Elevated container surface for tables, widgets, and kanban cards.
* **Popover / Dialog (`bg-popover`):** Dialog and dropdown background.
* **Muted (`bg-muted`):** Recessed input backgrounds, hover states, and inactive chips.
* **Border (`border-border`):** Neutral 1px borders dividing components and rows.
* **Primary (`bg-primary`, `text-primary`):** Brand accent (Emerald green `#10b981` or Indigo depending on theme).

---

### 3. Real Estate Domain Colors & Badges
* **Available:** `bg-emerald-500/10 text-emerald-400 border-emerald-500/30`
* **Sold:** `bg-red-500/10 text-red-400 border-red-500/30`
* **Tags & Chips:** `bg-muted text-foreground border-border text-xs px-2.5 py-0.5 rounded-full`

---

### 4. Component Standards

#### 4.1. Tables
* Table container: `rounded-xl border border-border bg-card overflow-hidden`.
* Table rows: `border-border hover:bg-muted/40 transition-colors`.
* Action cell: Right-aligned 3-dots ghost button (`size-8 text-muted-foreground hover:text-foreground`).

#### 4.2. Cards
* Grid cards: `rounded-xl border border-border bg-card p-4 hover:border-primary/50 transition-all shadow-xs hover:shadow-md`.

#### 4.3. Inputs & Forms
* Inputs and Textareas: `bg-muted border-border text-foreground placeholder:text-muted-foreground`.
* Focus visible: Standard ring matching `focus-visible:ring-primary`.

