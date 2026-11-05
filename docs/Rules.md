# Engineering & Consistency Rules (Rules.md)

This document is the **mandatory engineering contract** for all future modifications to this codebase. Every agent and developer must strictly adhere to these rules.

---

### 1. UI/UX Consistency Rules (Hallmark Floor)

#### Rule 1.1: Page Header Structure (CRITICAL)
Every dashboard page header must adhere to the exact standard pattern:
```tsx
{/* Standard Page Header */}
<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
  <div>
    <h1 className="text-2xl font-bold text-foreground">{title}</h1>
    <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
  </div>
  <div className="flex items-center gap-2">
    {/* Action buttons */}
  </div>
</div>
```
* **STRICT PROHIBITION:** **NEVER** wrap the `<h1>` title in an icon box or decorative container (e.g. no `<div className="p-2 bg-primary/10"><Icon /></div>`). Page headers in this CRM are typography-first, clean, and unadorned.

#### Rule 1.2: Standard Button Styling
* **Primary CTA:**
  `className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium"`
* **Secondary / Outline Action:**
  `variant="outline" className="border-border text-muted-foreground hover:bg-muted"`
* **Button Heights:** Use default sizing without forcing arbitrary heights (do not hardcode random `h-9` or `h-10` overrides that break visual alignment).

#### Rule 1.3: Search & Filter Bars
* Filter bars must use `flex flex-col sm:flex-row gap-2 items-center` or matching flex layout.
* Search inputs must use:
  `className="pl-9 bg-muted border-border text-foreground placeholder:text-muted-foreground"`
* Filter Selects must use standard `Select` components with `bg-muted` or `bg-card border-border`.

#### Rule 1.4: Modals & Dialogs
* Dialog wrappers must follow:
  `<DialogContent className="bg-popover border-border text-popover-foreground sm:max-w-xl max-h-[90vh] overflow-y-auto">`
* Input fields inside dialogs must use:
  `className="bg-muted border-border text-foreground placeholder:text-muted-foreground"`
* Dialog Footers must follow:
  ```tsx
  <DialogFooter className="bg-popover border-border pt-2 border-t mt-4">
    <Button variant="outline" className="border-border text-muted-foreground hover:bg-muted">Cancel</Button>
    <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium">Save</Button>
  </DialogFooter>
  ```
* **STRICT PROHIBITION:** Avoid creating deeply nested, bordered "mini-boxes" or artificial sub-card sections inside simple dialogs unless displaying read-only metrics.

---

### 2. Engineering Discipline (Superpowers Rules)

#### Rule 2.1: Verification Before Completion
* Never claim a task or bug fix is complete without running verification:
  - Run `npm run typecheck` (`tsc --noEmit`) to verify 0 TypeScript errors.
  - Verify database schema migrations with `supabase db push --remote`.
  - Validate bundle builds with `npm run build`.

#### Rule 2.2: Multi-Tenancy Protection
* Every query to domain tables must be scoped to `account_id`.
* Never perform un-scoped server-side queries using the service role key unless operating the central webhook ingress router.

#### Rule 2.3: Idempotent Migrations
* SQL migrations must be idempotent (use `IF NOT EXISTS`, drop triggers/policies before recreate).
* Never delete historical migrations. Always create sequential numbered migrations (e.g. `060_...`, `061_...`).

#### Rule 2.4: Atomic Git Commits
* Commit changes in logical, verifiable units with clear, conventional commit messages (`feat(...)`, `fix(...)`, `refactor(...)`).

