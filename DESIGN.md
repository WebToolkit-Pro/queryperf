# QueryPerf — System Requirements & Design Specification
> Version 1.0 · Built for agents, read by humans

---

## 0. Context & North Star

QueryPerf is a **static analysis tool** for AI-generated Prisma + PostgreSQL code. It catches structural database performance bugs — N+1 queries, missing indexes, table scans — before they ever reach production.

**Who it's for:** Junior to mid-level developers using AI assistants (Cursor, Claude, ChatGPT) to write database code they don't fully understand yet.

**What it is not:** A monitoring tool. A runtime profiler. An AI wrapper. A generic linter.

**The single job of this product:** Intercept bad AI-generated database code at the moment it's written, not the moment it breaks.

**Distribution strategy:** GitHub Action first. Website second. SEO never (until domain authority exists).

---

## 1. Core User Problems (In Priority Order)

1. **The N+1 Problem** — AI writes `findMany` followed by per-row relational fetches inside a loop. Looks correct, destroys DB under load.
2. **Missing Indexes** — AI never writes `CREATE INDEX`. It writes the query. The table scan is invisible in dev.
3. **SELECT * on large tables** — AI defaults to returning all fields from Prisma models, including BLOBs and heavy JSON columns.
4. **Unguarded pagination** — AI writes queries with no `take`/`limit`, allowing full table returns.
5. **Cascade delete blindness** — AI sets up `onDelete: Cascade` without understanding the blast radius on large relational trees.

---

## 2. Product Scope (MVP)

### In Scope
- Prisma schema parser (`.prisma` file input)
- Query block analyzer (TypeScript/JS Prisma client code input)
- Static rule engine (no AI API calls for analysis)
- Audit result view with per-issue severity, explanation, and fix
- Shareable audit URL (`/audit/[id]`)
- Raw markdown sub-route for AI ingestion (`/audit/[id]/share.md`)
- GitHub Action (primary distribution channel)
- Custom metrics panel (user can toggle which rule categories to audit)

### Out of Scope (v1)
- Runtime query monitoring
- Direct database connection
- Sequelize / TypeORM support (Prisma-only at launch)
- Authentication / user accounts (audits are ephemeral by default)
- Paid tier / gating

---

## 3. Technical Architecture

### 3.1 Stack
```
Frontend:    Next.js 15 (App Router) + TypeScript
Styling:     Tailwind CSS (utility only, no component libraries)
Storage:     Supabase (audit result persistence, anonymous)
Deployment:  Vercel (free tier, zero infra cost)
CLI/Action:  Node.js script, published to GitHub Marketplace
```

### 3.2 Directory Structure
```
src/
├── app/
│   ├── page.tsx                    # Input interface
│   ├── audit/
│   │   └── [auditId]/
│   │       ├── page.tsx            # Human audit dashboard
│   │       └── share.md/
│   │           └── route.ts        # Raw text for LLM ingestion
│   └── api/
│       └── analyze/
│           └── route.ts            # POST endpoint: receives schema + queries
├── lib/
│   ├── analyzer/
│   │   ├── index.ts                # Orchestrator: runs all rules, returns findings[]
│   │   ├── rules/
│   │   │   ├── n-plus-one.ts       # Rule: detects N+1 patterns
│   │   │   ├── missing-index.ts    # Rule: cross-refs schema vs queries
│   │   │   ├── select-star.ts      # Rule: detects implicit full model selects
│   │   │   ├── unpaginated.ts      # Rule: detects missing take/skip
│   │   │   └── cascade-risk.ts     # Rule: flags onDelete: Cascade on large models
│   │   └── types.ts                # Finding, Severity, RuleResult types
│   ├── schemaParser.ts             # Parses .prisma DSL into AST-like object
│   ├── indexGenerator.ts           # Auto-generates CREATE INDEX suggestions
│   └── reportBuilder.ts           # Assembles findings into AuditReport shape
├── components/
│   ├── AuditDashboard.tsx          # Main result view (customizable metric panels)
│   ├── FindingCard.tsx             # Individual issue card with severity + fix
│   ├── MetricsPanel.tsx            # Toggle-able rule categories
│   ├── SchemaInput.tsx             # Dual-pane input (schema + query)
│   └── ShareBar.tsx                # Copy audit link / copy share.md URL
└── types/
    └── audit.ts                    # Shared types: AuditReport, Finding, Metric
```

### 3.3 Data Flow
```
User pastes schema + queries
        │
        ▼
POST /api/analyze
        │
        ├── schemaParser.ts         → ModelMap (models, fields, relations, indexes)
        ├── analyzer/index.ts       → runs all enabled rules against ModelMap + query AST
        │       ├── n-plus-one.ts
        │       ├── missing-index.ts
        │       ├── select-star.ts
        │       ├── unpaginated.ts
        │       └── cascade-risk.ts
        │
        ├── indexGenerator.ts       → generates CREATE INDEX statements for missing indexes
        └── reportBuilder.ts        → AuditReport { id, findings[], metrics, generatedAt }
                │
                ▼
        Saved to Supabase (audits table)
                │
        ┌───────┴────────┐
        ▼                ▼
 /audit/[id]      /audit/[id]/share.md
 Human dashboard  Raw text for Cursor/Claude
```

### 3.4 Rule Engine Contract

Every rule in `lib/analyzer/rules/` must conform to this interface:

```typescript
// lib/analyzer/types.ts

export type Severity = 'critical' | 'warning' | 'info';

export interface Finding {
  ruleId: string;           // e.g. "n-plus-one"
  severity: Severity;
  title: string;            // short label: "N+1 Query Detected"
  description: string;      // what's wrong and why it matters
  location?: string;        // e.g. "getUserPosts() → line 14"
  fix: {
    explanation: string;    // plain English: what to change
    code: string;           // the exact corrected Prisma query or SQL
  };
}

export interface RuleResult {
  ruleId: string;
  findings: Finding[];
}

// Every rule file exports a function matching this signature:
export type Rule = (schema: ModelMap, queries: QueryAST[]) => RuleResult;
```

### 3.5 Supabase Schema

```sql
-- audits table
create table audits (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  schema_input text not null,
  query_input  text not null,
  report       jsonb not null,    -- full AuditReport as JSON
  metrics_config jsonb            -- which rules were enabled (for replay)
);

-- No auth required at MVP. Row-level security off.
-- Audits are public by ID (security by obscurity, acceptable for dev tool).
```

---

## 4. GitHub Action Spec

### 4.1 What It Does
On every pull request, the action scans staged `.ts`/`.js` files and the project's `schema.prisma` for performance issues. If findings exist, it posts a structured comment on the PR.

### 4.2 Usage (developer's workflow file)
```yaml
# .github/workflows/db-audit.yml
name: DB Performance Audit
on: [pull_request]
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: your-handle/queryperf-action@v1
        with:
          schema-path: './prisma/schema.prisma'
          query-glob: 'src/**/*.ts'
```

### 4.3 PR Comment Format
```
## ⚠️ QueryPerf Database Audit

Found **3 issues** in this PR that will cause performance problems under load.

---

### 🔴 CRITICAL — N+1 Query in `getUserPosts()`
`src/lib/users.ts:47`
This query fetches users then makes 1 additional DB call per user to fetch posts.
With 100 users, this is 101 queries per request.

**Fix:**
\`\`\`ts
// Before (AI-generated)
const users = await prisma.user.findMany();
const withPosts = await Promise.all(
  users.map(u => prisma.post.findMany({ where: { authorId: u.id } }))
);

// After (corrected)
const users = await prisma.user.findMany({
  include: { posts: true }
});
\`\`\`

---

### 🟡 WARNING — Missing Index on `Post.authorId`
No index exists on the foreign key used in your most frequent join.
Full table scan on every user page load.

**Suggested migration:**
\`\`\`sql
CREATE INDEX idx_post_author_id ON "Post"("authorId");
\`\`\`

---

[View full audit on QueryPerf →](https://queryperf.vercel.app/audit/abc123)
[Copy shareable fix for Cursor →](https://queryperf.vercel.app/audit/abc123/share.md)
```

---

## 5. Share Route Spec (`/audit/[id]/share.md`)

This route returns `Content-Type: text/plain`. It's designed to be pasted directly into a Cursor or Claude chat window so the AI can apply all fixes to the codebase automatically.

```
=== QueryPerf Audit: abc123 ===
Generated: 2025-06-10T14:32:00Z
Schema: prisma/schema.prisma
Queries analyzed: 4

--- FINDING 1 of 3 ---
Severity: CRITICAL
Rule: n-plus-one
Location: src/lib/users.ts:47
Issue: N+1 query pattern. 1 query per User record to fetch related Posts.

Fix — replace the following:
[ORIGINAL CODE BLOCK]

With this corrected version:
[FIXED CODE BLOCK]

--- FINDING 2 of 3 ---
Severity: WARNING
Rule: missing-index
Location: schema.prisma → Post model
Issue: No index on Post.authorId (foreign key used in 3 queries)

Fix — add to your next Prisma migration or run directly:
CREATE INDEX idx_post_author_id ON "Post"("authorId");

--- END OF AUDIT ---
Paste this entire block into your AI assistant and say:
"Apply all fixes from this QueryPerf audit to my codebase."
```

---

## 6. Custom Metrics Panel

Developers can toggle rule categories on/off before running an audit. This is stored in `localStorage` and reflected in the `metrics_config` field of the saved audit.

### Default Rule Categories
| Rule ID | Label | Default State |
|---|---|---|
| `n-plus-one` | N+1 Query Detection | ON |
| `missing-index` | Missing Index Detection | ON |
| `select-star` | Implicit Full-Model Selects | ON |
| `unpaginated` | Unpaginated Queries | ON |
| `cascade-risk` | Cascade Delete Risk | OFF (power users only) |

### Panel Behavior
- Toggle switches per rule category
- Toggling off a rule: its findings are hidden from the dashboard and excluded from the share.md output
- The metrics config is serialized into the audit record so shared links respect the original settings
- "Reset to defaults" button restores the default state table above

---

## 7. Design System

### 7.1 Design Direction

**Concept: Terminal Precision**
Not a dashboard. Not a SaaS product page. QueryPerf should feel like a tool built by an engineer who deeply understands the problem — minimal surface area, high information density, zero decoration that doesn't carry meaning.

The reference aesthetic is a high-quality CLI tool that gained a web UI. Think `git diff` meets a medical lab report. Every element earns its presence.

**What to avoid:**
- Gradient hero sections
- Icon-heavy feature cards
- Animated number counters
- Generic "dark mode SaaS" look (near-black + acid green)
- Any element that looks like it came from a Shadcn demo

### 7.2 Color Tokens
```css
:root {
  --bg-base:       #0D0F12;   /* Near-black with a blue undertone, not pure black */
  --bg-surface:    #141720;   /* Card/panel background */
  --bg-elevated:   #1C2130;   /* Active states, hover, input fields */
  --border:        #252B3B;   /* Subtle structural lines */
  --border-strong: #3A4255;   /* Focused inputs, active panels */

  --text-primary:  #E8EDF5;   /* Main body text */
  --text-secondary:#8B95A8;   /* Labels, metadata */
  --text-muted:    #505A6E;   /* Disabled, placeholders */

  /* Severity palette — these are the ONLY accent colors */
  --critical:      #E55B4D;   /* Red — not neon, not orange-red. Muted authority. */
  --critical-bg:   #1E1211;
  --warning:       #D4943A;   /* Amber — warm, not yellow */
  --warning-bg:    #1C1509;
  --info:          #4A90C4;   /* Steel blue — informational, not alarming */
  --info-bg:       #0E1620;
  --pass:          #4CAF7D;   /* Desaturated green — health, not celebration */
  --pass-bg:       #0D1A12;

  /* The one brand accent — used ONLY on interactive elements */
  --accent:        #5B8DEF;   /* Periwinkle blue — distinctive, not purple, not cyan */
  --accent-dim:    rgba(91, 141, 239, 0.12);
}
```

### 7.3 Typography
```css
/* Display — used only for the product name and major headings */
font-family: 'DM Mono', monospace;
/* Rationale: code tool → monospaced display type. Unusual choice that reinforces the product. */

/* Body — clean, readable at small sizes */
font-family: 'Inter', system-ui, sans-serif;

/* Code blocks — distinct from display mono */
font-family: 'JetBrains Mono', 'Fira Code', monospace;

/* Type Scale */
--text-xs:   11px;   /* Labels, badges */
--text-sm:   13px;   /* Metadata, captions */
--text-base: 15px;   /* Body copy */
--text-lg:   18px;   /* Section titles */
--text-xl:   24px;   /* Page headings */
--text-2xl:  32px;   /* Hero / product name */
```

### 7.4 Spacing & Layout
```
Max content width:    900px
Page horizontal pad:  24px (mobile), 48px (desktop)
Card padding:         20px
Gap between cards:    12px
Input area height:    360px (resizable)
```

### 7.5 Component Specifications

#### Input Page (`/`)
```
┌─────────────────────────────────────────────────────────┐
│  QueryPerf                              [Docs] [GitHub]  │
│  ─────────────────────────────────────────────────────  │
│  Paste your Prisma schema and AI-generated queries.      │
│  We'll find what breaks under load.                      │
│                                                          │
│  ┌──────────────────────┐ ┌──────────────────────────┐  │
│  │ schema.prisma        │ │ queries.ts               │  │
│  │                      │ │                          │  │
│  │  [textarea]          │ │  [textarea]              │  │
│  │                      │ │                          │  │
│  └──────────────────────┘ └──────────────────────────┘  │
│                                                          │
│  Audit rules: [N+1 ✓] [Indexes ✓] [Select* ✓] [Page ✓] │
│                                                          │
│                          [Run Audit →]                   │
└─────────────────────────────────────────────────────────┘
```
- No hero. No marketing copy above the fold. The tool IS the hero.
- Split-pane input: schema left, queries right
- Rule toggles are visible before running (not buried in settings)
- Single CTA button: "Run Audit →" — not "Analyze", not "Submit"
- On mobile: stacked vertically, schema first

#### Audit Dashboard (`/audit/[id]`)
```
┌─────────────────────────────────────────────────────────┐
│  ← New Audit   Audit #abc123   Jun 10 2025 14:32        │
│  ─────────────────────────────────────────────────────  │
│                                                          │
│  ┌──────────┬──────────┬──────────┬──────────┐          │
│  │ 3 Issues │ 1 Critical│ 2 Warning│ 0 Passing│          │
│  └──────────┴──────────┴──────────┴──────────┘          │
│                                                          │
│  [Share Link]  [Copy for Cursor →]  [Export .md]        │
│  ─────────────────────────────────────────────────────  │
│                                                          │
│  🔴 CRITICAL                                            │
│  N+1 Query — getUserPosts()                             │
│  src/lib/users.ts · line 47                             │
│  ─────────────────────────────────────────────────────  │
│  [Explanation]                                          │
│  [Before code block]  →  [After code block]             │
│  ─────────────────────────────────────────────────────  │
│                                                          │
│  🟡 WARNING                                             │
│  Missing Index — Post.authorId                          │
│  schema.prisma · Post model                             │
│  ─────────────────────────────────────────────────────  │
│  [Explanation]                                          │
│  [Generated CREATE INDEX statement]                     │
└─────────────────────────────────────────────────────────┘
```
- Summary bar shows issue counts by severity — no charts, no donut graphs
- Findings ordered: critical → warning → info
- Each finding is a self-contained block: location, explanation, fix
- Code blocks use `JetBrains Mono`, syntax highlighted, copyable
- "Copy for Cursor →" copies the `/share.md` URL to clipboard
- No pagination — all findings on one scrollable page

#### Finding Card States
```
Expanded (default):    full explanation + before/after code
Collapsed:             title + severity badge + location only
Resolved (toggled):    grayed out, strikethrough title, "Marked resolved"
```

#### Severity Badges
```
[● CRITICAL]   bg: --critical-bg    text: --critical    border: --critical at 30% opacity
[● WARNING]    bg: --warning-bg     text: --warning      border: --warning at 30% opacity
[● INFO]       bg: --info-bg        text: --info         border: --info at 30% opacity
```
No emoji in badges — the colored dot is the signal. Emoji only in GitHub PR comments (markdown context).

### 7.6 Motion Rules
- **No decorative animation.** This is a tool, not a product demo.
- **Allowed transitions:**
  - Finding card expand/collapse: `height` transition, 150ms ease-out
  - Audit results appear: findings fade in sequentially, 80ms stagger, 200ms duration
  - Toast notifications: slide in from bottom-right, 200ms
- `prefers-reduced-motion`: all transitions disabled

### 7.7 The Signature Element
The one distinctive visual: **the live parse indicator on the input page.**

When the user pastes code into either textarea, a thin horizontal bar beneath the input — same width as the textarea, 2px height, `--accent` color — animates from left to right over ~300ms, indicating the static parser is running synchronously as they type. It resets and replays on each paste/keystroke debounce.

This gives the tool a sense of being alive and fast without adding fake loaders or marketing animations. It communicates: *"This isn't sending your code to a server. It's parsing locally, right now."*

---

## 8. API Specification

### POST `/api/analyze`

**Request:**
```typescript
{
  schema: string;          // Raw .prisma file content
  queries: string;         // Raw TypeScript/JS query block
  metricsConfig?: {        // Optional: override default rule states
    [ruleId: string]: boolean;
  }
}
```

**Response:**
```typescript
{
  auditId: string;         // UUID, also the Supabase row ID
  findings: Finding[];     // Ordered by severity (critical first)
  metrics: {
    total: number;
    critical: number;
    warning: number;
    info: number;
    rulesRun: string[];
  };
  shareUrl: string;        // https://queryperf.vercel.app/audit/[auditId]
  shareMdUrl: string;      // https://queryperf.vercel.app/audit/[auditId]/share.md
  generatedAt: string;     // ISO 8601
}
```

**Error responses:**
```typescript
400: { error: "INVALID_SCHEMA", message: "Could not parse schema.prisma input" }
400: { error: "INVALID_QUERIES", message: "Could not parse query block" }
400: { error: "EMPTY_INPUT", message: "Both schema and queries are required" }
500: { error: "ANALYSIS_FAILED", message: "Internal error during rule execution" }
```

### GET `/audit/[auditId]/share.md`

Returns `Content-Type: text/plain; charset=utf-8`. No authentication. Fetches from Supabase by ID and formats the stored `AuditReport` as the plain text format described in Section 5.

---

## 9. Rule Implementation Notes

### Rule: `n-plus-one.ts`
**Detection strategy:**
1. Parse query block into AST (use `@babel/parser` or `ts-morph`)
2. Walk AST for `prisma.[model].findMany()` calls
3. For each `findMany`, check if the result variable is used inside a `.map()`, `for...of`, or `forEach` block
4. Inside that loop, check for any other `prisma.*` call
5. If found: N+1 confirmed

**Fix generation:**
- Extract the inner `prisma.*` call's model name
- Map it to the outer model's relations via the parsed schema
- Generate the corrected `include: { [relationName]: true }` syntax

### Rule: `missing-index.ts`
**Detection strategy:**
1. Parse schema: extract all `@@index`, `@id`, `@unique` declarations per model
2. Parse queries: extract all `where`, `orderBy`, `cursor` field references
3. Cross-reference: fields appearing in `where`/`orderBy` but absent from index declarations = missing index
4. Weight by frequency: fields used in multiple queries get `CRITICAL`, single use gets `WARNING`

**Fix generation:**
- Generate `CREATE INDEX idx_[model]_[field] ON "[Model]"("[field]");`
- Also generate the equivalent Prisma schema addition: `@@index([field])`

### Rule: `select-star.ts`
**Detection strategy:**
1. Find all `prisma.[model].findMany()` / `findFirst()` / `findUnique()` calls
2. Check if a `select: {}` block is present
3. If absent: implicit SELECT * — flag as WARNING
4. If present but includes large field types (Bytes, Json with no type narrowing): flag as INFO

### Rule: `unpaginated.ts`
**Detection strategy:**
1. Find all `findMany()` calls
2. Check for `take` or `skip` in the options object
3. If absent: flag as WARNING with message about full-table return risk

### Rule: `cascade-risk.ts`
**Detection strategy:**
1. Parse schema for all relations with `onDelete: Cascade`
2. Cross-reference: does the parent model have any `findMany` calls in queries?
3. If yes, and the model has 3+ child relations also set to Cascade: flag as WARNING
4. Message: "Deleting a [Model] will cascade-delete all related [X], [Y], [Z] records. Verify this is intentional."

---

## 10. Performance Constraints

- Static analysis must complete in **< 200ms** for inputs under 500 lines
- The API route must respond in **< 400ms** total (including Supabase write)
- The analyzer runs entirely server-side — no client-side AST parsing
- No AI API calls in the core analysis path (keeps cost at zero and latency deterministic)
- AI API may be used optionally in a future "explain this finding in depth" expansion panel — not in MVP

---

## 11. Environment Variables

```bash
# .env.local
NEXT_PUBLIC_APP_URL=https://queryperf.vercel.app
SUPABASE_URL=your-project-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key   # server-side only, never exposed
```

---

## 12. Agent Implementation Checklist

Work through these in order. Do not skip ahead.

- [ ] **1. Scaffold Next.js 15 project** with App Router, TypeScript strict mode, Tailwind
- [ ] **2. Implement `schemaParser.ts`** — parse raw `.prisma` text into `ModelMap`
- [ ] **3. Implement `n-plus-one.ts` rule** — this is the highest-value rule, get it right first
- [ ] **4. Implement `missing-index.ts` rule**
- [ ] **5. Implement `select-star.ts` and `unpaginated.ts` rules**
- [ ] **6. Wire `POST /api/analyze`** — run rules, build report, save to Supabase
- [ ] **7. Build input page (`/`)** — dual textarea, rule toggles, run button
- [ ] **8. Build audit dashboard (`/audit/[id]`)** — findings list, summary bar, share controls
- [ ] **9. Build `/audit/[id]/share.md` route** — plain text output
- [ ] **10. Apply design tokens** — colors, typography, component styles per Section 7
- [ ] **11. Add the live parse indicator** (signature element, Section 7.6)
- [ ] **12. Build GitHub Action** — scanner script + PR comment formatter
- [ ] **13. Publish to GitHub Marketplace**
- [ ] **14. Add `cascade-risk.ts` rule** (lower priority, after above is stable)

---

## 13. What Success Looks Like (v1)

| Signal | Target |
|---|---|
| GitHub Action installs | 50 within first month |
| Audits run via web UI | 200 within first month |
| Share links clicked | 30% of completed audits |
| PR comments generating web visits | Primary traffic source |
| Google organic traffic | Not a metric at this stage |

The tool succeeds when a developer pastes their AI-generated Prisma query, sees a real N+1 bug they didn't know existed, clicks "Copy for Cursor", and their AI assistant fixes it in one shot. That loop — **find → understand → fix** — is the entire product.
