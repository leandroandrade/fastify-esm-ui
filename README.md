# fastify-esm-ui

Template for REST APIs with a server-rendered web UI, built on Fastify (ES modules), EJS, Tailwind CSS v4 and Alpine.js (CSP build). Secure defaults, ready to copy into a new project.

Requires **Node.js 26** (see `.nvmrc`); the Docker image and the CI run on the same version.

## Features

- 🚀 **Fastify 5** with a plugin architecture loaded by `@fastify/autoload` (`src/core` for infrastructure, `src/business` for the application)
- 📄 **EJS templates** with a layout, per-page scripts and standalone 404/500 pages
- 🎨 **Tailwind CSS v4** with reusable components (`.btn-*`, `.card`, `.alert-*`, `.nav-link`)
- 🌗 **Light/dark theme** that follows the OS until the user picks one, applied before first paint with no flash of the wrong theme
- ⚡ **Alpine.js, CSP build**: no `unsafe-eval` and no `unsafe-inline` in the Content-Security-Policy
- 🔔 **Toast notifications** through `Alpine.notificadores()`, including server-side messages (`errorMsg`)
- 🔎 **SEO**: canonical link, Open Graph/Twitter tags with a 1200×630 image, JSON-LD, `robots.txt` and `sitemap.xml` generated from `PUBLIC_URL`
- 📚 **Swagger UI** at `/docs`, enabled by `DOCS_ENABLED` (off by default)
- ❤️ **Health check** at `/health`, used by the Docker `HEALTHCHECK`
- 🧾 **Audit log**: one log line per POST/PUT/PATCH/DELETE, refused ones included
- 🧩 **EJS partials** for the shared `<head>`, logo and error page
- 🧪 **Tests**: Node.js test runner plus Playwright (Chromium and Firefox), with a test that fails on any console error or CSP violation

## Security defaults

| Area | Default |
| --- | --- |
| Headers | Helmet with a strict CSP (`script-src 'self'`, `style-src 'self'`, `frame-ancestors 'none'`), HSTS, `no-referrer` |
| CSRF | `Sec-Fetch-Site`/`Origin` validation on every unsafe method, on every path |
| Rate limit | 100 req/min per IP on `onRequest`, IPv6 grouped by /64, also applied to 404s |
| Client IP | `TRUSTED_PROXY_IPS` (addresses/CIDRs), validated at boot; empty = trust nobody |
| Input | Global sanitization of query/params/body (invisible characters, NFKC, prototype pollution keys) |
| Errors | Only errors declared for the client (`@fastify/error`, `httpErrors`) reach it; everything else is generic |
| Request id | `x-correlation-id` reused only when it looks like an id |
| Static files | Dotfiles are never served |
| API docs | `/docs` only exists when `DOCS_ENABLED=true` |
| Audit | Mutating requests logged with status, IP, Origin, Referer and Sec-Fetch-Site (query strings stripped) |
| Docker | `.dockerignore` allowlist (`.env` never reaches the build), non-root user, no npm in the runtime image, base image pinned by digest |
| Supply chain | `.npmrc` with `ignore-scripts=true` and `min-release-age=7` |

The reasoning behind each default is in [CLAUDE.md](CLAUDE.md) and in the comments of each plugin.

## Get started

```shell
npm install
npm run e2e:setup        # Playwright browsers, needed only for the e2e tests
cp .env.example .env
npm run dev
```

`npm run dev` builds Tailwind CSS, copies Alpine.js (CSP build) to `public/js` and starts the server watching `./src`.

## Available Scripts

```shell
npm run dev            # Build assets and start with --watch
npm start              # Start production server
npm run build          # Build Tailwind CSS and copy Alpine.js to public/js
npm test               # Run all tests (unit, integration and e2e on Chromium)
npm run test:firefox   # Run the e2e tests on Firefox
npm run test:only      # Run tests marked with test.only
npm run test:single    # Run a single test file
npm run test:coverage  # Run tests with coverage report
npm run lint           # Run ESLint
npm run lint:fix       # Fix ESLint errors automatically
npm run e2e:setup      # Install the Playwright browsers
```

## Environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `HOST` | `0.0.0.0` | Bind address |
| `LOG_LEVEL` | `info` | Pino log level |
| `PUBLIC_URL` | `http://localhost:3000` | Public origin used for canonical links, Open Graph, robots.txt and sitemap.xml |
| `TRUSTED_ORIGINS` | *(empty)* | Cross-site origins allowed to send unsafe methods |
| `TRUSTED_PROXY_IPS` | *(empty)* | Addresses/CIDRs of the proxy in front of the app |
| `TRUSTED_PROXY_DEBUG` | `false` | Logs the connection peer of every request, to discover the proxy range |
| `DOCS_ENABLED` | `false` | Registers Swagger UI at `/docs` (`.env.example` turns it on for development) |
| `GIT_COMMIT_HASH` | `dev` | Commit shown in the footer (Docker build argument) |

## Accessing the Application

```
http://localhost:3000/             # Web interface
http://localhost:3000/api          # API base URL
http://localhost:3000/docs         # API documentation (Swagger, with DOCS_ENABLED=true)
http://localhost:3000/health       # Health check
```

Sample requests are in [`http/localhost.http`](http/localhost.http).

## Docker

```shell
docker build --build-arg GIT_COMMIT_HASH=$(git rev-parse HEAD) -t fastify-esm-ui .
docker compose up -d --build     # http://localhost:8080
docker compose down
```

## Structure of project

```
.
├── src
│   ├── app.js                       # Application factory
│   ├── server.js                    # Server startup and graceful shutdown
│   ├── configs.js                   # Fastify options (trust proxy, request id, AJV, timeouts)
│   ├── business                     # Application layer
│   │   ├── decorators               # Fastify instance decorators
│   │   ├── repositories             # Data access layer
│   │   ├── routes                   # API routes (prefix: /api)
│   │   ├── swagger                  # OpenAPI specification
│   │   └── views                    # Page routes
│   └── core
│       └── plugins
│           ├── env.js               # Environment variables (@fastify/env)
│           ├── health.js            # /health
│           ├── audit-log.js         # Audit trail of mutating requests
│           ├── helmet.js            # Security headers and CSP
│           ├── sec-fetch-validation.js  # CSRF protection
│           ├── rate-limit.js        # Rate limiting
│           ├── sanitize.js          # Input sanitization
│           ├── trust-proxy-diagnostic.js  # Proxy range discovery and drift warning
│           ├── error-handler.js     # Error handling (API + views)
│           ├── not-found.js         # 404 handler (API + views)
│           ├── view.js              # EJS and default view context (SEO)
│           ├── robots.js            # /robots.txt
│           ├── sitemap.js           # /sitemap.xml
│           ├── static.js            # /public/*
│           ├── swagger.js           # /docs
│           └── ...                  # cookie, formbody, sensible, schema, api-request
├── templates                        # EJS layout, pages, partials/ and Tailwind entry (css/custom.css)
├── public                           # Static assets (built CSS, Alpine, page scripts)
└── tests                            # Unit, integration and e2e (Playwright) tests
```
