# Pinned by digest as well as tag: a tag can be re-pushed, a digest cannot. Dependabot
# (docker ecosystem) keeps both up to date.
FROM node:26.12.1-trixie-slim@sha256:94816674c62774da0d099a947bf4613b9e1972a2733abd0d0cd80e795f8411d0 AS build

RUN apt-get update \
  && apt-get install -y --no-install-recommends dumb-init \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

COPY package*.json /usr/src/app/

RUN npm ci --ignore-scripts

COPY ./templates /usr/src/app/templates

RUN npx @tailwindcss/cli -i ./templates/css/custom.css -o ./public/css/styles.css --minify
RUN npm run js:build
RUN npm prune --omit=dev

FROM node:26.12.1-trixie-slim@sha256:94816674c62774da0d099a947bf4613b9e1972a2733abd0d0cd80e795f8411d0

RUN apt-get update \
  && apt-get upgrade -y \
  && rm -rf /var/lib/apt/lists/* \
  && rm -rf /usr/local/lib/node_modules/npm \
       /usr/local/lib/node_modules/corepack \
       /opt/yarn-v* \
       /usr/local/bin/npm /usr/local/bin/npx \
       /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg

COPY --from=build /usr/bin/dumb-init /usr/bin/dumb-init

USER node

WORKDIR /usr/src/app

COPY --chown=node:node --from=build /usr/src/app/node_modules /usr/src/app/node_modules
# Needed by @fastify/autoload, not by Node: since 22.12 Node detects ESM from the syntax
# and the .js files run with no "type" at all. autoload, though, walks up looking for a
# package.json to read the "type"; finding none it loads plugins with require() instead
# of import(), and any autoloaded file without an `export default` reaches
# fastify.register as a plain object: "Plugin must be a function or a promise".
COPY --chown=node:node ./package.json /usr/src/app/package.json
COPY --chown=node:node ./src /usr/src/app/src
COPY --chown=node:node ./templates /usr/src/app/templates
COPY --chown=node:node ./public /usr/src/app/public
COPY --chown=node:node --from=build /usr/src/app/public/css/styles.css /usr/src/app/public/css/styles.css
COPY --chown=node:node --from=build /usr/src/app/public/js /usr/src/app/public/js

# Shown in the footer (see GIT_COMMIT_HASH in src/core/plugins/env.js):
#   docker build --build-arg GIT_COMMIT_HASH=$(git rev-parse HEAD) .
ARG GIT_COMMIT_HASH
ENV GIT_COMMIT_HASH=${GIT_COMMIT_HASH}

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

# The runtime image has neither curl nor npm, so the probe is Node itself (global fetch).
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + process.env.PORT + '/health').then((res) => process.exit(res.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["dumb-init", "node", "--disable-sigusr1" ,"src/server.js"]
