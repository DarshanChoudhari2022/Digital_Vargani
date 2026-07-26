# Feature Completion Audit

Status as of the current implementation.

## Verified Working

- Monorepo setup with NestJS API, Next.js web app, and Prisma database package.
- Supabase-ready PostgreSQL schema in Prisma.
- Supabase browser/server helpers for Next.js.
- Auth API foundation: login, refresh token rotation, logout, JWT guard, roles guard.
- Super admin mandal onboarding APIs.
- Festival setup APIs.
- Member and group setup APIs.
- Digital Vargani slip APIs:
  - active form lookup
  - create slip
  - duplicate-safe slip number sequence
  - list slips
  - get slip
  - cancel slip with audit event
- Expense category and expense APIs.
- Collection report API with totals by member, group, and payment mode.
- Collection report CSV export for accountant/shareable workflows.
- Custom vargani field APIs for per-festival configurable collection forms.
- Slip template and template version APIs, including active version selection per festival.
- Mandal audit-event query API for traceability.
- Supabase public schema pushed and verified with all expected tables:
  `audit_events`, `custom_fields`, `expense_categories`, `expenses`, `festivals`, `mandals`,
  `member_groups`, `members`, `slip_sequences`, `slip_template_versions`, `slip_templates`,
  `user_sessions`, `users`, and `vargani_slips`.
- Focused API unit tests for CSV export, tenant isolation, and slug/key generation.
- Demo web app for super admin, mandal admin, and member collector flows.

## Verified Build Checks

The following commands pass:

```bash
pnpm typecheck
pnpm build
pnpm lint
pnpm format:check
pnpm test
```

## Partial / Not Yet Production Complete

- Web app still uses demo/in-memory data for the polished presentation surface.
- Web app is not yet connected to the NestJS APIs for live CRUD.
- Template builder UI is represented in the demo; backend APIs now exist, but the live drag/drop builder screen is not connected yet.
- PDF/image receipt rendering worker is not implemented yet.
- Queue/Redis worker integration for receipt rendering and exports is not implemented yet.
- File storage upload to S3/Supabase Storage is not implemented yet.
- Row Level Security policies are not yet authored for Supabase because the backend currently enforces tenant isolation in NestJS.
- Broader automated integration tests and slip-sequence concurrency tests are not written yet.
- Production deployment pipeline is not configured yet.

## Next Required Production Milestones

1. Seed the first super admin and demo mandal credentials.
2. Connect Next.js screens to NestJS APIs.
3. Build live template upload and field placement UI on top of the template APIs.
4. Build receipt rendering worker.
5. Add integration/concurrency tests for slip creation.
6. Add storage, queues, observability, and deployment config.
