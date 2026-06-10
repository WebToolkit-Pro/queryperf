# QueryPerf Implementation Plan

This plan details the steps required to implement the QueryPerf static analysis tool as outlined in the `DESIGN.md` specification. The project is currently scaffolded with Next.js, and some initial files (like `schemaParser.ts`) exist but require full implementation.

## Proposed Changes

### Phase 1: Core Analyzer & Rule Engine
This phase focuses on the static analysis backend—the engine that parses schemas and queries to find performance issues.

- **`src/lib/analyzer/types.ts`**: Define the interfaces for `Severity`, `Finding`, and `RuleResult`.
- **`src/lib/schemaParser.ts`**: Refine the existing basic schema parser to fully support relations (especially for the cascade risk rule) and ensure strong typing.
- **`src/lib/analyzer/rules/n-plus-one.ts`**: Implement AST parsing (via `@babel/parser`) to detect N+1 query patterns in loops and generate `include: { ... }` fixes.
- **`src/lib/analyzer/rules/missing-index.ts`**: Implement detection for fields used in `where`/`orderBy` that lack database indexes, and generate `CREATE INDEX` SQL fixes.
- **`src/lib/analyzer/rules/select-star.ts`**: Flag implicit `SELECT *` patterns on heavy models.
- **`src/lib/analyzer/rules/unpaginated.ts`**: Flag `findMany` queries without `take` or `skip`.
- **`src/lib/analyzer/rules/cascade-risk.ts`**: Identify models with multiple `onDelete: Cascade` relations to warn against accidental mass deletions.
- **`src/lib/analyzer/index.ts`**: Orchestrate the rule execution based on the user's `metricsConfig`.

### Phase 2: API & Supabase Integration
This phase connects the backend engine to the frontend and persists audits.

- **Supabase Setup**: Define the schema for the `audits` table and configure the environment variables (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
- **`src/app/api/analyze/route.ts`**: Create the POST endpoint to receive schema and query inputs, run the orchestrator, and save the resulting `AuditReport` to Supabase.
- **`src/app/audit/[auditId]/share.md/route.ts`**: Implement the raw markdown route to output the LLM-friendly audit summary.

### Phase 3: Frontend & Design System
This phase implements the "Terminal Precision" aesthetic and builds the interactive UI.

- **Design Tokens**: Update `tailwind.config.ts` and `src/app/globals.css` with the specific color palette (`--bg-base`, `--critical`, `--warning`, etc.) and typography (`DM Mono`, `JetBrains Mono`).
- **`src/app/page.tsx`**: Build the dual-pane input interface with rule toggles.
- **`src/components/LiveParseIndicator.tsx`**: Implement the signature "live parsing" animation bar triggered on input.
- **`src/app/audit/[auditId]/page.tsx`**: Build the human-readable dashboard showing the summary bar and the list of finding cards.
- **`src/components/FindingCard.tsx`**: Implement expandable cards displaying the issue description and before/after code fixes.

### Phase 4: GitHub Action
This phase handles the primary distribution channel for the tool.

- **`action.yml`**: Configure the GitHub Action metadata.
- **`scripts/action.ts`**: Build a Node.js script to run the analyzer locally on PRs and post formatted markdown comments to GitHub.

---

> [!IMPORTANT]
> **User Review Required**
>
> 1. **Supabase Integration**: Do you already have a Supabase project set up, and are the `.env.local` credentials configured? If not, we will need to set that up before the API route can save audits.
> 2. **GitHub Action Publication**: Do you want me to handle the GitHub Marketplace publication (Step 13 in `DESIGN.md`), or is that something you will manage manually after the repository is complete?

---

## Verification Plan

### Automated Verification
- Pass a suite of test inputs (mock Prisma schemas and messy `findMany` loops) into the analyzer engine locally to verify all 5 rules trigger accurately and generate correct code fixes.

### Manual Verification
- Deploy locally using `npm run dev`.
- Paste a problematic schema and query into the web UI, verify the live parse indicator animations, and confirm the API successfully returns an audit ID.
- Visit the audit dashboard and share routes to verify visual fidelity matches the "Terminal Precision" design requirements.
