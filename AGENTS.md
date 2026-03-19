# AGENTS.md

## Product
Build a personal accounting workflow management system for recurring client work.

This is not a generic to-do app. It is a recurring operations system for:
- month-end close
- quarter-end close
- year-end close
- audit PBC tracking
- tax filings
- one-off accounting tasks

The core concept is:
- reusable checklist templates
- client-specific workflow instances by period
- rollforward of recurring tasks
- preservation of prior period history
- support for importing existing close schedules and audit PBC lists

## Primary user
Single primary user initially.
Desktop-first.
Clean, fast, practical UI.
Optimize for accounting operations, not consumer productivity.

## Product goals
1. Create reusable templates by workflow type
2. Generate monthly, quarterly, yearly, and one-off task instances from templates
3. Roll forward recurring tasks into a new period
4. Track status, due dates, owners, notes, blockers, and evidence links
5. Import existing month-end close checklists and audit PBC lists from CSV/XLSX
6. Convert imported rows into reusable templates or one-time task batches
7. Preserve audit trail and historical period snapshots

## Technical preferences
- TypeScript
- Next.js latest stable
- React
- Tailwind CSS
- Prisma ORM
- PostgreSQL for production-ready design
- SQLite acceptable for local dev if it speeds MVP
- Server actions or API routes acceptable
- Use zod for validation
- Use a good component pattern, keep code maintainable

## UX preferences
- Accounting-oriented terminology
- Fast data entry
- Bulk edit where useful
- Clean filters
- Excellent period navigation
- No clutter
- No gimmicks

## Domain rules
- Tasks can be recurring or one-time
- Templates define default tasks
- Period instances are generated from templates
- Historical periods are immutable except for notes/status corrections
- Rollforward should create new period tasks without mutating prior periods
- Incomplete tasks from prior period can optionally be surfaced in next period as carryforwards
- Imported checklist rows can be mapped into:
  - template tasks
  - one-time imported task batches
  - audit PBC request items
- Due date rules may be relative, such as:
  - day of month
  - business day offset from period end
  - fixed calendar date
  - offset from generated period start
- Audit PBC items should support request status:
  - not requested
  - requested
  - received
  - under review
  - cleared

## Build expectations
- Prefer simple, working architecture over overengineering
- Create code incrementally
- After each major feature, run the app or tests and fix errors
- Keep README updated
- Seed demo data so the app is usable immediately

## Deliverables
- working local app
- prisma schema
- seed script
- import parser for CSV/XLSX
- sample import files
- README with setup and usage
