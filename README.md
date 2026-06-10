<div align="center">
  <h1>QueryPerf</h1>
  <p><strong>Terminal-Precision Static Analysis for AI-Generated DB Code</strong></p>
  
  [![GitHub release (latest by date)](https://img.shields.io/github/v/release/WebToolkit-Pro/queryperf?style=flat-square)](https://github.com/WebToolkit-Pro/queryperf/releases)
  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)
</div>

---

**QueryPerf** intercepts bad database code at the moment it's written. By auditing your Prisma schema alongside your TypeScript queries, QueryPerf catches structural performance anti-patterns (like N+1 queries and missing indexes) *before* they ever reach production.

Designed specifically to catch common mistakes made by AI code generators and junior developers.

## ✨ Features

- 🚨 **N+1 Query Detection:** Automatically identifies queries inside loops (`for`/`map`/`forEach`) that should be refactored into batch operations or `.include()`.
- 🔍 **Missing Index Detection:** Scans `.findUnique`, `.findFirst`, and `.where` clauses against your `schema.prisma` to catch slow queries missing proper `@unique` or `@@index` attributes.
- 📦 **Select-Star Bloat:** Flags queries fetching massive payloads without using `select` to narrow down the returned columns.
- 📄 **Unpaginated List Risk:** Detects `.findMany()` calls lacking `take` or `skip` limits.
- 💥 **Cascade Risk:** Identifies `delete` operations on tables with cascading relations that could cause unintended data loss.

---

## 🚀 Usage as a GitHub Action

The best way to use QueryPerf is to run it on every Pull Request to prevent bad queries from merging into your `main` branch.

Add this workflow file to your repository at `.github/workflows/queryperf.yml`:

```yaml
name: Database Performance Audit
on:
  pull_request:
    branches: [ main ]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4
      
      - name: Run QueryPerf Audit
        uses: WebToolkit-Pro/queryperf@v1.0.0
        with:
          # Path to your Prisma schema (default: ./prisma/schema.prisma)
          schema-path: './prisma/schema.prisma'
          # Glob pattern for files containing Prisma queries (default: src/**/*.ts)
          query-glob: 'src/**/*.ts'
```

### Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `schema-path` | Path to your Prisma schema file | `./prisma/schema.prisma` |
| `query-glob` | Glob pattern to find files containing Prisma queries | `src/**/*.ts` |

---

## 💻 Web Interface

We also provide a sleek, terminal-inspired web interface for live code analysis. You can paste your schema and queries directly into the browser to get an instant audit report.

Try the live sandbox: **[queryperf-git-main-netizenlabs.vercel.app](https://queryperf-git-main-netizenlabs.vercel.app)**

### Running Locally

To run the web interface locally:

```bash
# 1. Install dependencies
npm install

# 2. Start the development server
npm run dev

# 3. Open http://localhost:3000
```

## 📝 License

This project is licensed under the MIT License.
