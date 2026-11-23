# SideQuest

SideQuest's backend runs independent personal Scouts with persistent private memory and a PostgreSQL mailbox. Scouts exchange inquiries, information, proposals, counteroffers and exact-version acceptances. The scheduler routes turns and enforces limits; it does not use a central model to choose for everyone. A shared LLM provider is used with separate, owner-scoped inputs for each Scout. Humans approve the final proposal individually.

The Figma-derived Next.js frontend is connected to the authenticated backend through tRPC. Login/signup, onboarding, Scout conversations, memory review/edit/delete, catalog discovery, permitted people, settings, negotiation transcripts, exact-version approvals, and dated revisions use persisted data. The existing visual design and component library are retained; the runtime screens no longer use fabricated activities, replies, plans, match percentages or notifications.

## Local setup

Use Node **22.21+** and pnpm **10.19+**, with PostgreSQL 15+.

```sh
pnpm install
cp .env.example .env
```

Set these server-only values in `.env`:

```dotenv
DATABASE_URL=postgresql://postgres:password@localhost:5432/sidequest
OPENROUTER_API_KEY=your-key
OPENROUTER_MODEL=your-chosen-openrouter-model-id
BETTER_AUTH_SECRET=a-long-random-secret
BETTER_AUTH_URL=http://localhost:3000
# Optional, only for GitHub OAuth:
BETTER_AUTH_GITHUB_CLIENT_ID=your-github-oauth-client-id
BETTER_AUTH_GITHUB_CLIENT_SECRET=your-github-oauth-client-secret
# Optional, per negotiation:
SIDEQUEST_MAX_LLM_CALLS=40
SIDEQUEST_TOKEN_BUDGET=1280000
```

Select an OpenRouter model supporting **JSON mode**. The integration uses LangChain `ChatOpenAI`, OpenRouter's compatible `/api/v1` endpoint and a Zod-derived JSON schema, then validates the actual response with Zod. It does not require native tool calling. No provider/model is hardcoded into agent logic. Credentials have no `NEXT_PUBLIC_` counterpart. Memory review/edit/delete and profile operations work without an LLM key; model-backed operations require one.

The repository's existing `start-database.sh` can create a local database when Docker is running. For a **new empty database**:

```sh
pnpm db:migrate
pnpm db:checkpoints
pnpm db:seed
pnpm dev
```

The initial migration includes the unchanged existing auth/post tables and new `sq_*` tables. **If you already created tables with `db:push`, baseline that database against the initial migration or use a new development database before running migrations.** The migration is not an automatic conversion of an untracked existing database. Do not drop existing auth/user data to resolve a migration conflict. Subsequent schema changes use `pnpm db:generate` then `pnpm db:migrate`. Drizzle's old `sidequest_*` filter excluded the actual existing tables; it has been removed.

`db:checkpoints` applies LangGraph's own checkpoint migrations. Application tables remain the authoritative source for plans, decisions, transcripts and memory. The former `*:frontend` commands now alias the full application commands and require the same backend setup; they no longer disable validation or supply an ephemeral auth secret. Use a Node runtime with connection pooling; these workflows are not intended for the Edge runtime. Better Auth email/password login is connected to the login screen. GitHub OAuth remains available when both optional GitHub credentials are configured; its callback derives from `BETTER_AUTH_URL` rather than a hardcoded localhost URL.

## Use the connected frontend

Open the app after migrations, checkpoint setup and seeding. Sign up at `/login`, choose at least two interests and availability, and review the matching controls. New accounts start with SideQuest-wide matching enabled. During signup or in Settings, you can limit matching to your planning circle or turn matching off. Onboarding writes separate memories with source provenance and converts the selected periods into exact dates for the next two weeks. Use Settings to change those dates or set a hard budget ceiling. Matching requires discovery, sharing and availability.

Scout conversations and memories survive reloads and new logins. Memory edits save explicitly; deleting a memory can optionally erase its source conversation. The People screen lists only mutually permitted, opted-in people and their public names; it does not publish private memories or calendar details. For development, the eight clearly named synthetic users belong to `synthetic-campus`. A real account can select that circle in Settings to negotiate with the seeded demonstration Scouts.

Use the Home request box, a catalog activity's "Ask Scout to coordinate" action, or a person's "Ask Scout" action to start a negotiation. Plans show live status, a real addressed transcript, proposal terms and each human's approval count. Every participant approves from their own authenticated account. A time-change form takes local dated times and converts them to UTC; the revised proposal loses prior approvals. Open panels and plan lists poll for approvals and changes from other users, including changes to previously confirmed plans. Model failures show a failed state and a revision/retry path rather than a fabricated agreement.

## Run the demonstration

No credentials, Docker or database service are needed for the deterministic local demo:

```sh
pnpm demo:local
```

It applies the actual SQL migrations to embedded PostgreSQL (PGlite), seeds synthetic participants, runs both LangGraph workflows and prints the persisted transcript. Scripted model responses demonstrate inquiry → event consultation → proposal → counteroffer → agent acceptance. The result pauses at `AWAITING_APPROVAL`. The script then clearly simulates explicit approval by each **synthetic** human, confirming only after the third approval. This demonstrates orchestration and validation, not real model intelligence.

For a persistent PostgreSQL demo after migrations:

```sh
pnpm demo
# Opt in to billable, actual model-backed negotiation:
pnpm demo -- --real
# Embedded database with actual model responses (load environment first):
pnpm exec tsx --env-file=.env scripts/demo.ts --embedded --real
```

Real models can reject, request clarification, exhaust limits or fail validation; a demo never fabricates agreement to force success. Re-seeding refreshes the eight synthetic users' development availability and the five fictional catalog activities for the next Saturday. All emails use `example.invalid`, users are named Synthetic, and options explicitly describe themselves as fictional. These fixtures are not real venues, prices, tickets or reservations. User 8 has an incompatible budget/time window; users 1–3 can compromise on an evening indoor activity.

## Backend modules

- `src/server/db/`: unchanged auth definitions in `auth-schema.ts`; domain tables in `sidequest-schema.ts`; combined exports in `schema.ts`.
- `src/server/sidequest/scout.ts`: owned conversations, persisted messages, synchronous extraction before reply, retry keys.
- `memory.ts`: structured extraction → semantic-key reconciliation → durable records/revisions; contextual full-text retrieval and independent paginated human review.
- `personal-agent.ts`: receive → retrieve own memory/addressed mail/episodes → reason and choose an action → validate returned action. It never receives another user's memory or a database tool handle.
- `mailbox.ts`: persistent addressed messages and processing state, with membership checks.
- `events.ts`: deterministic feasibility filtering over catalog entries; the model ranks supplied activity IDs and published descriptions use catalog facts.
- `negotiation.ts`: LangGraph routing loop, durable pending turns, proposal versions, budgets, human pauses, revisions and transactional approvals.
- `constraints.ts`: deterministic permissions, hard constraints and canonical proposal hashing.
- `model.ts`: configurable server-side OpenRouter transport, bounded input/output, timeout, structured output validation and redacted telemetry.
- `src/server/api/routers/sidequest.ts`: protected Scout, memory, profile and SideQuest routers.

The coordination checkpoint holds only a negotiation ID and a control flag. Private prompt contexts are reconstructed from owned application records, rather than copied into long-lived checkpoints. A committed pending action can be applied after interruption without re-running the model. Domain turn numbers and unique constraints make replayed messages/proposals harmless. A transaction-scoped advisory lock serializes aggregate changes; a renewable run lease avoids two active schedulers. A crashed runner can be resumed after its three-minute lease expires. An interruption before the action is persisted may repeat a model call, but cannot create duplicate domain effects.

## Memory behavior and retention

Messages and memories are separate records. Extracted memories have category, stable semantic key, structured value, scope, confidence, explicit/inferred flag, source message/conversation, timestamps, expiry and active/superseded/deleted status. Revisions preserve links to superseded records without duplicating private text. Duplicate facts are reconciled, explicit evidence outranks inference, and tentative statements retain their confidence. Source evidence must be a literal substring of the user message. Secrets matching the server filter are rejected in addition to the model's extraction rules.

Temporary/session facts require an expiry; expired memories never enter retrieval or hard validation. Session memory is only retrieved in its source Scout conversation. Full-text retrieval uses a GIN index, owner/category/scope/recency filters, rank and a bounded context. Vague requests also receive a small recent-memory fallback, rather than the full history. Conversation history is bounded. Episodic context includes approved plans and revision requests; extracted experience/feedback memories are also searchable. Approval is recorded as approval, not as evidence that an activity happened.

For this prototype extraction runs inline. This makes corrections effective before the reply without relying on a background queue. A failed request keeps its source message and can be retried with the same `requestId`. Exact hard constraints use structured values (`maxCost` in KRW, group bounds, UTC windows, exclusions). An explicit high-confidence constraint without a usable structured value blocks proposals until clarified. Editing a hard constraint requires typed `constraints`, so an edit cannot silently remove enforcement.

Memory deletion scrubs the content/value across its entire key lineage and hashes the key. Empty deleted tombstones retain only the metadata needed to prevent source retries from recreating the fact. They are excluded from review and retrieval. If source transcripts are retained, that conversation is excluded from future model history to prevent quoted/echoed copies from reviving deleted memory. `memory.delete({ deleteSource: true })` additionally deletes the source conversation and all replies, cascading its associated memories/revisions. `scout.deleteConversation` deletes a whole owned conversation and its associated extracted records. There is no automatic age-based transcript purge in this prototype. Shared negotiation transcripts are a separate audit record; deleting a private memory does not retract information already shared in a group transcript.

## Frontend API contract

Every operation uses the existing authenticated Better Auth session. Ownership never comes from a client-supplied user ID. Calls below use the existing `api` client; use `.mutate`/`.query` for a vanilla tRPC proxy or the existing React hooks.

1. `profile.update({ discoverable, sharing, circle, openDiscovery, blockedUsers, constraints })` creates/updates the caller's profile. Discovery and limited negotiation sharing must both be enabled for matching. Social circles are self-declared labels. People in different circles can match when both have SideQuest-wide discovery enabled. Either person's block or exclusion forbids contact.
2. `profile.updateAvailability({ windows: [{ start: Date, end: Date }] })` replaces owned availability atomically. These are explicit dated intervals, not a recurring-calendar integration. Dates use UTC ISO in plans/constraints; local seed narratives use Asia/Seoul.
3. `scout.sendMessage({ requestId: crypto.randomUUID(), content, conversationId? })` persists a user message, extracts memory and returns `{ conversationId, message }`. Reuse the **same** request ID when retrying a failed/network-interrupted call. New conversations omit `conversationId`; persistent memories carry across them.
4. `memory.list({ limit?, afterId?, categories?, scopes? })` returns owned active records for human review, including expired records with their expiry visible. Pass the last record's ID as `afterId` for the next page. `memory.search({ query?, categories?, scopes?, conversationId?, since?, limit? })` excludes expired records. `memory.update({ id, content, constraints? })` explicitly supersedes a memory; `memory.delete({ id, deleteSource? })` scrubs it.
5. `sidequest.create({ requestId, intent, constraints: {} })` returns a quest. `sidequest.startNegotiation({ sidequestId, candidateIds? })` creates its membership/mailbox and returns an ID in `DISCOVERING`. Without IDs, the server discovers up to four permission-eligible candidates. This initial membership remains fixed for the negotiation; agents negotiate the activity and terms.
6. `sidequest.resumeNegotiation({ id })` drives the independent Scouts until agreement, a human question, failure or a budget limit. Start/resume is an explicit mutation, not a side effect of polling. It runs in the request process; if the request/process stops, invoke it again after any run lease expires. There is no always-on background worker.
7. Poll `sidequest.getNegotiation({ id })` and `sidequest.getMessages({ id, afterTurn: -1 })` every 1–2 seconds while a resume mutation is active. Track the highest returned turn to incrementally fetch messages. The response exposes status, public transcript/events, proposals and human approvals, without other users' private constraints or pending actions. `sidequest.get`/`list`, `scout.getConversation`/`listConversations` and `profile.get` support the remaining views.
8. Each signed-in participant calls `sidequest.approveProposal({ negotiationId, proposalId, hash })` for the exact displayed version. `rejectProposal` uses the same reference and ends the negotiation. No agent action can write a human approval. The final confirmation transaction revalidates all hard constraints and current permissions.
9. `sidequest.requestRevision({ negotiationId, requestId, instruction, constraints })` immediately updates **the caller's** session constraints, invalidates current approvals/acceptances and in-flight actions, and resumes the status to `NEGOTIATING`. Then call `resumeNegotiation`. Proposals include an immutable activity snapshot and bind the catalog terms into their hash; changed catalog prices or locations require renewed consent. A revision creates a new proposal/version/hash and every human must approve again. `AWAITING_USER_INPUT` is resumed through the same operation.

For “Actually, I can't do 3. Can we make it 6?”, the connected plan panel collects the user's instruction and exact dated time window. For example, 6–8 PM in Seoul on 21 November 2026 is:

```ts
await api.sidequest.requestRevision.mutate({
  negotiationId,
  requestId: crypto.randomUUID(),
  instruction: "Actually, I can't do 3. Can we make it 6?",
  constraints: {
    windows: [
      { start: "2026-11-21T09:00:00.000Z", end: "2026-11-21T11:00:00.000Z" },
    ],
  },
});
await api.sidequest.resumeNegotiation.mutate({ id: negotiationId });
```

Natural-language Scout chat does not implicitly authorize contacting people or revising an existing quest. Quest creation/revision uses these explicit operations. Session restrictions may narrow feasibility but cannot bypass hard profile budgets, availability, blocks or sharing permissions. Ordinary likes/dislikes remain soft preferences for each Scout to negotiate.

## Limits, failures and observability

Maximum five participants, twenty inter-agent messages and three substantive proposal versions per negotiation. Repeated identical messages/proposals terminate safely. Default budgets allow forty model invocations and 1,280,000 conservatively reserved tokens. Each call reserves 32,000 tokens before invocation: the transport caps total input to 30,000 UTF-8 bytes and output to 1,600 tokens. Reservations deliberately overestimate normal usage, remain consumed on errors/interruption, and include event-agent calls. Actual token usage and cost are logged separately when the provider returns them. Provider retries are disabled; timeout is thirty seconds and invalid JSON/schema output fails the negotiation safely.

Statuses: `DISCOVERING`, `NEGOTIATING`, `AWAITING_USER_INPUT`, `AWAITING_APPROVAL`, `CONFIRMED`, `FAILED`, `CANCELLED` (reserved; no cancellation endpoint yet). A model failure never implies consent. After resolving the cause, an explicit revision can reopen a failed negotiation if its original budgets/round limit allow it. Revisions do not reset budgets. No availability means no feasible proposal. The event tool searches a bounded catalog and proposes one-hour slots inside the permitted windows; it does not book or allocate shared venue inventory across quests.

Structured logs include model, returned usage/cost, invocation latency, turn/version/status, constraint failures and safe failure reasons. They exclude memory content, prompts, transcripts, private revision instructions, credentials and raw provider/database errors. Audit records in PostgreSQL retain the actual authorized transcript and decisions.

## Verification

```sh
pnpm test
pnpm typecheck
pnpm lint
pnpm demo:local
# Opt-in billable extraction/reply and real multi-Scout conversation tests:
pnpm test:smoke
```

Normal Vitest tests use scripted models and actual SQL migrations in PGlite. They cover multi-fact extraction, separate conversations, expiry/session scope, duplicate reconciliation, corrections, explicit precedence, deletion, search, ownership, injection boundary/action checks, model failures, addressed independent turns, counteroffers, catalog feasibility, hard constraints, exact-version approvals, revisions, in-flight invalidation, rejection, limits, leases, replay after interruption and protected tRPC callers. These tests check deterministic containment of adversarial inputs, not a proof that an LLM can never produce an inappropriate sentence.

The optional smoke tests run only when `RUN_OPENROUTER_SMOKE=1`, `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` are all set. Real-agent output need not converge; the test requires an actual exchange between independent Scouts and forbids automatic human confirmation.

PGlite serializes transactions and substitutes a no-op for advisory locks, so the offline suite does not prove native PostgreSQL concurrency. An additional opt-in native PostgreSQL test checks PostgresSaver recovery across connections, simultaneous approvals, and exactly one final confirmation. Use an isolated, migrated and seeded test database:

```sh
NATIVE_TEST_DATABASE_URL=postgresql://... pnpm test
```

Browser end-to-end tests use the real running Next.js app and authentication/database (not mocked HTTP routes). Install Chromium and start the app against an isolated migrated/seeded database, then run:

```sh
pnpm exec playwright install chromium
# Defaults to http://localhost:3100; override if your server uses another port.
PLAYWRIGHT_BASE_URL=http://localhost:3100 pnpm test:e2e
# Also run the two-person approval/revision test; this must match the app's database.
PLAYWRIGHT_DATABASE_URL=postgresql://... pnpm test:e2e
```

The first browser test covers real signup, onboarding, persistent memory edits, discovery, logout/login, session isolation and authenticated route guards. The second creates two isolated authenticated browser contexts and verifies that one person's approval cannot confirm a plan, both people receive confirmation through polling, and a revision revokes both approvals on both screens. That test uses scripted model decisions for its persisted proposal fixture; separate OpenRouter smoke tests and a manual live browser run exercise real model decisions.

On 17 November 2026, verification included 47 passing Vitest tests with native PostgreSQL enabled, two passing browser end-to-end tests, and both configured OpenRouter smoke checks (the extraction/reply check passed on retry after an invalid structured response was safely rejected). The manual live browser flow also reached an agreed proposal, recorded one human approval, then changed the time from 3 PM to 6 PM and displayed proposal v2 with zero stale approvals. `pnpm build`, type checking and full lint pass (lint reports non-blocking image/config warnings). The previously failing chart/toggle/highlighter lint issues have been fixed. Application code still runs extraction/negotiation in the request process; this prototype does not include an always-on worker or venue bookings.

Integration API references: [LangChain ChatOpenAI](https://docs.langchain.com/oss/javascript/integrations/chat/openai), [LangGraph persistence](https://docs.langchain.com/oss/javascript/langgraph/persistence), and [OpenRouter LangChain integration](https://openrouter.ai/docs/guides/community/langchain). The installed package declarations were also checked for the APIs used here
