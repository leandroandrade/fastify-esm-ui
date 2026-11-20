# CLAUDE.md

## Standard Workflow

1. Think through the problem, read the codebase for relevant files.
2. Plan with a todo list to check off as you go.
3. Always check skills to support the solution.
4. Before beginning, check in with me to verify the plan.
5. Work through todo items, giving a high-level explanation of each change.
6. Keep every change as simple as possible — minimal code impact.
7. Every change should have a test associated with it.

## Project Overview

Template for Fastify (ESM) applications with a server-rendered web UI: EJS, Tailwind CSS v4 and the CSP build of Alpine.js. Runs on **Node.js 26** only (`.nvmrc`, `engines`, Dockerfile and CI agree); Node 26 features may be used freely. New projects start from a copy of this repository, so every default here is a default for all of them — security defaults especially.

## Development Commands

```bash
npm install            # Install dependencies (install scripts are off, see .npmrc)
npm run e2e:setup      # Download the Playwright browsers (once)
npm run dev            # Build assets, then run with --watch on src/
npm start              # Production server
npm run build          # Tailwind CSS + copy Alpine (CSP build) to public/js
npm test               # Run all tests (unit, integration, e2e)
npm run test:firefox   # E2E tests on Firefox
npm run test:coverage  # Tests with coverage
npm run test:single path/to/test.js  # Single test file
npm run test:only      # Only test.only marked tests
npm run lint           # Linting
npm run lint:fix       # Auto-fix lint
```

## Architecture

- **Fastify** with plugin-based architecture, auto-loaded by `@fastify/autoload`.
  - `src/core/plugins/`: infrastructure (env, view, static, helmet, rate-limit, sanitize, sec-fetch-validation, error-handler, not-found, trust-proxy-diagnostic, audit-log, health, robots, sitemap, swagger...).
  - `src/business/`: decorators, routes (prefixed with `/api`), repositories, views.
- `src/configs.js` holds the Fastify server options (trust proxy, request id, AJV, timeouts, body limit).
- Environment variables are declared in `src/core/plugins/env.js` (`@fastify/env`); copy `.env.example` to `.env`. `TRUSTED_PROXY_IPS` and `LOG_LEVEL` are read in `src/configs.js` because they are needed before plugins load.

## Security Defaults — do not loosen without a reason written next to the change

### CSP and Alpine

- The CSP (`src/core/plugins/helmet.js`) has no `'unsafe-eval'` and no `'unsafe-inline'`. It is possible because the pages run `@alpinejs/csp`.
- Only `/docs` (Swagger UI) gets `style-src 'unsafe-inline'`, through `transformStaticCSP` in `src/core/plugins/swagger.js`. That hook lives in swagger-ui's encapsulated context; never move the relaxation into helmet.
- `tests/business/e2e/home-page.test.js` fails on any console error, CSP violation or Alpine warning. Keep it green when adding UI.

### CSRF

`src/core/plugins/sec-fetch-validation.js` is a global `onRequest` hook that validates `Sec-Fetch-Site`/`Origin`/`Referer` for every unsafe method on **every path** (not only `/api/*`). Blocks answer one generic 403 (`SEC_FETCH_VALIDATION_ERROR`); the reason stays in the log. A non-browser client that must POST belongs in `TRUSTED_ORIGINS`, which is empty by default.

### Rate limiting and client IP

- `TRUSTED_PROXY_IPS` (addresses/CIDRs, comma-separated) decides whether `req.ip` is the caller or a value the caller wrote in `X-Forwarded-For`. Empty = trust nobody. A hop count is refused at boot (Fastify 5.12.1 ignores numeric `trustProxy`). Never use `trustProxy: true`.
- `TRUSTED_PROXY_DEBUG=true` logs the connection peer of every request to discover the edge range; `trust-proxy-diagnostic.js` warns once per process when the range drifts.
- The limiter runs on `onRequest` (so it counts attempts that a `preHandler` rejects). **Never** give it an `allowList` of literal addresses or a custom `keyGenerator` — the first is spoofable through `X-Forwarded-For`, the second loses the IPv6 /64 grouping.
- The not-found handler has its own limiter: it is not a route, so the global one does not reach it.
- Tighter budgets per route: spread `fastify.rateLimitStrict` or `fastify.rateLimitDestrutivo` into the route options.

### Input sanitization

`src/core/plugins/sanitize.js` rewrites `req.query`, `req.params` and `req.body` in a global `preValidation` hook (so `minLength`/`maxLength` apply to the cleaned value): folds whitespace controls, deletes invisible/format characters, NFKC, collapses spaces, drops `__proto__`/`constructor`/`prototype`. Streams and Buffers pass untouched. Test through a real request — Fastify's `req.query` is a null-prototype object that is itself a prototype.

### Error responses

`src/core/plugins/error-handler.js` only sends a message to the client when the error was declared for it: `@fastify/error` (`createError`) or `fastify.httpErrors.*` (`expose: true`). Anything else (driver errors with `code`, `ENOENT`, `TypeError`) gets a generic message and its detail goes to the log only. Use `createError` for domain errors.

### Audit log

`src/core/plugins/audit-log.js` writes one `info` line per POST/PUT/PATCH/DELETE in `onResponse`, so requests refused by the CSRF check or the rate limiter are recorded too. It keeps method, path, route, status, IP, Origin, Referer, Sec-Fetch-Site, response time and `req.user.sub` when an auth plugin sets it. Query strings are stripped from the path and the Referer — never log them, they carry tokens and personal data.

### API docs and health

- `/docs` is registered only with `DOCS_ENABLED=true` (default off; `.env.example` and `.env.test` turn it on). Views get `docsEnabled` to hide the links.
- `/health` answers `{ status: 'ok' }` and nothing else. A readiness check for a database goes there, answering 503 on failure. It is not exempt from the rate limit.

### Other

- `x-correlation-id` becomes the request id only if it matches `/^[A-Za-z0-9-]{8,64}$/`.
- `@fastify/static` ignores dotfiles (404, not 403).
- `bodyLimit` is 1 MiB; raise it per route for uploads.
- `.dockerignore` is an allowlist: a new `COPY` needs a line there. `.npmrc` sets `ignore-scripts` and `min-release-age`.

## UI/UX Guidelines

- Clean, minimalist design. Tailwind CSS v4 (`templates/css/custom.css`) with reusable components (`.btn-*`, `.card`, `.alert-*`, `.nav-link`).
- Dark mode is driven by `data-theme` on `<html>` (`@custom-variant dark`), set before paint by `public/js/theme-init.js` and toggled by `Alpine.store('theme')`. Standalone pages (404/500) load `theme-init.js` themselves.
- **CSP build of Alpine**: template expressions go through Alpine's own parser, which rejects — with only a console warning — template literals, arrow functions, `new`, `typeof`, statement sequences, globals (`Math`, `Date`, `JSON`, `setTimeout`, `window`) and `x-html`. Keep expressions to property access, method calls, operators and ternaries; anything else becomes a method or getter in `Alpine.data`. Bind `:style` to an object, never a string.
- One JS file per page, registered with `Alpine.data('<name>', ...)` inside an `alpine:init` listener, and passed by the view as `scripts: ['<file>.js']`.
- Do not use `window` directly in front-end JS:
  - Shared state: `Alpine.store('<name>', { ... })`.
  - Shared helpers: factories on the `Alpine` global (e.g. `Alpine.notificadores()`), spread inside the component.
  - Cross-component events: `this.$dispatch('<event>', detail)`, listened with `@event.window`.
- Server-side messages: pass `errorMsg` to the view; the layout shows it in the toast stack.
- Every public page passes `title`, `description` and `canonicalPath` (and `ogImage` when it has its own), and is listed in `src/core/plugins/sitemap.js`. Page title pattern: `Fastify ESM | <Seção>`.
- Shared markup lives in `templates/partials/` (`head.ejs`, `logo.ejs`, `error-page.ejs`), included with an explicit extension: `<%- include('partials/logo.ejs', { logoClass: 'h-7 w-7' }) %>`. A new standalone page includes `partials/head.ejs` so it gets the theme script and stylesheet.
- Accessibility: buttons have `type`, icon-only controls have `aria-label`, decorative SVGs have `aria-hidden="true"`, the current nav link has `aria-current="page"`.

## Code Guidelines

- Prioritize clarity and simplicity, avoid unnecessary abstractions.
- Always use curly braces on `if` statements.
- Do not declare callback functions inline as parameters. Assign them to a separate variable first.
- If a function receives an object, declare the object beforehand and then pass it to the function.
- Use Fastify's logger (`fastify.log` / `req.log`); do not rename it to `logger`.
- Logs inside plugins must be prefixed with the plugin name (e.g. `rate-limit-plugin: ...`).
- Boolean-returning functions use the `is` prefix; extract compound conditions into named boolean variables.
- Blank lines between methods; blank line before a meaningful `return` when the body has more than two lines.

### Fastify

- Inline named handlers: `fastify.get('/', schema, async function getData(req, reply) { ... })`.
- Every route has a JSON Schema; errors use `$ref: 'error#'`.
- Reusable utilities are decorators (`fastify.decorate`), not `utils/` modules.
- Plugins that decorate are wrapped in `fastify-plugin` with an explicit `name` and declared `dependencies`.
- A plugin never imports a function from another plugin's file; share through a decorator.
- Never use `fastify.httpErrors.*` inside a repository — 4xx decisions belong to the route.

### API Response Convention

- Single record: `{ result: { ... } }`
- List: `{ results: [ ... ] }`

## Testing Strategy

- Node.js built-in test runner; Playwright for e2e (Chromium by default, Firefox with `npm run test:firefox`).
- `tests/shared/helper.js`: `withApp(t)` builds an app and closes it after the test; `withEnv(t, name, value)` sets an env var for one test (call it **before** `withApp`).
- `tests/shared/e2e-helper.js`: `iniciarServidor(t)` listens on a random port; `abrirNavegador(t, options)` opens a browser closed after the test. Never use fixed ports.
- Single test case: change `test` to `test.only`, run `npm run test:only`, revert after passing.
