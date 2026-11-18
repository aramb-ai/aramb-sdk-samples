# Support desk

A small, complete web app on the aramb Node SDK ([`@aramb-ai/sdk`](https://www.npmjs.com/package/@aramb-ai/sdk)):
a support desk for small companies.

- People sign in with **the app's own login** (Google, plus an email-only dev login for local work).
- They pick the **Support** or **Billing** agent and chat, with replies **streamed** into the page.
- A **company admin** sees credits used per person and for the whole company in a chosen month, sees each person's
  conversations, and can remove a person.

It has no database of its own: people, companies, conversations and usage all come from aramb through the SDK.

## Quick start

You need Node 22 or later and an aramb builder key.

```sh
git clone https://github.com/aramb-ai/aramb-sdk-samples.git
cd aramb-sdk-samples/support-desk
npm ci
cp .env.example .env.local     # .env.local is ignored by git
# edit .env.local: ARAMB_KEY, AUTH_SECRET (`npx auth secret`), and either Google
# (AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET) or ALLOW_DEV_LOGIN=1 for local work
npm run setup                  # creates and publishes the two agents, writes their ids to .env.local
npm run dev                    # http://localhost:3000
```

To try the admin dashboard locally, set `ALLOW_DEV_LOGIN=1` and `ADMIN_EMAILS=ada@acme.test`, then sign in as
`ada@acme.test` and, in another browser, as `bob@acme.test`.

## Configuration

| Variable | Meaning |
|---|---|
| `ARAMB_KEY` | Your builder key. Read only on the server; never sent to the browser. |
| `ARAMB_BASE_URL` | The aramb gateway. Default `https://api.aramb.ai/gw`. |
| `AUTH_SECRET` | Secret that signs the login cookie (Auth.js). |
| `AUTH_TRUST_HOST` / `AUTH_URL` | Needed by Auth.js for `next start` outside Vercel: `AUTH_TRUST_HOST=true` behind a proxy you trust, or `AUTH_URL` set to the app's public URL. |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Google sign-in. Leave empty to turn Google off. |
| `ALLOW_DEV_LOGIN` | `1` adds an email-only login with no password. |
| `ADMIN_EMAILS` | Comma-separated emails of company admins. |
| `SUPPORT_AGENT_ID`, `BILLING_AGENT_ID` | Written by `npm run setup`. |

**The dev login is for local work only.** `ALLOW_DEV_LOGIN=1` is accepted only when `NODE_ENV` is `development` or
`test`. With any other `NODE_ENV` (unset, `production`, `staging`, …) `next dev`, `next build` and `next start` refuse
to start and say why.

## How it maps onto aramb

| In the app | In aramb (SDK) |
|---|---|
| A signed-in person | One end-user. `subTenant` is `u_g_<Google account id>` or, for the dev login, `u_d_<first 32 hex chars of sha256(lowercased email)>`. Only `[a-z0-9_]`. |
| On every sign-in | `endUsers.upsert(subTenant, { displayName, groupId })` |
| A company (the email domain, e.g. `acme.test`) | A group whose `externalRef` (and name) is the domain (`groups.list` / `groups.create`). People on public mail domains (gmail.com, outlook.com, …) get no group and can't be admins. |
| A chat message | One short-lived `session({ agentId, subTenant, conversationId })` per request; `stream()` is relayed to the browser as Server-Sent Events. |
| Chat history on reload | `getConversationMessages(conversationId, { agentId, subTenant })` |
| Greeting and starter questions | `getAgent(agentId)` |
| Dashboard | `getUsage({ groupBy: 'endUser' \| 'group', groupId, since, until })` for the chosen month (credits). |
| A person's conversations | `listConversations({ subTenant })` (across both agents) |
| Remove a person | `endUsers.delete(subTenant)`; the page shows `deleting` until `deleted`. |
| Agents | `npm run setup` calls `createAgent({ ..., publish: true })`. |

The app's server holds the builder key and is the only thing that talks to aramb. The browser talks only to the
app's own routes under `app/api/`.

An admin is a person listed in `ADMIN_EMAILS` whose email is on a company domain. Their company is the group of
their domain. They see and remove only people in that group; any other person is a 404.

**Cost of the group lookup.** The SDK has no lookup of a group by name or `externalRef`, so every sign-in (and every
admin page) pages through `groups.list` to find the company. That is fine for a sample with a few companies; with
many, keep a domain → group id map in your own store or cache it.

Every SDK error is shown as a plain message with its request id (quote it when you ask for help). The full list is in
`lib/errors.ts`.

## Streaming and hosting

Each message is one Session that lives for one request, so the app runs the same on one server, several, or
serverless, with no in-memory state. Long replies need a host that allows streaming responses of a few minutes.
If the browser goes away mid-reply, the app closes the Session; the agent may still finish its turn, and the reply
then appears from history on reload.

## Scripts

| Script | Does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run setup` | Create and publish the agents (keeps existing ones), write their ids to `.env.local` |
| `npm test` | Unit tests (Vitest) |
| `npm run lint` | ESLint; also rejects deep SDK imports and hand-written calls to aramb URLs |
| `npm run typecheck` | TypeScript |
| `npm run scan:bundle` | After a build, fail if the client bundle mentions an API key or its variable |

## Layout

```
app/          pages and API routes (Next.js App Router)
components/   client components (chat, remove button, error notice)
lib/          server logic: SDK client, sign-in, admin scope, usage, chat relay, error messages
scripts/      setup.ts
tests/        unit tests and the bundle scan
```
