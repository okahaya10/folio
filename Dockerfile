# Sakura VPS image. Builds with the Cloudflare-free config
# (vite.vps.config.ts) so the output is a plain Node.js server
# (vinext's built-in prod server — see node_modules/vinext/dist/server/
# prod-server.js), not a Cloudflare Workers bundle.
#
# NOTE: written without a local Docker install to test against (see
# CLAUDE_CODE_HANDOFF.md / chat history) — the plain-Node build itself
# was verified locally (`vinext build --config vite.vps.config.ts` +
# `vinext start`), but this Dockerfile has not been run. Build and
# smoke-test it before relying on it for a real deploy.

FROM node:22-slim AS build
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm exec vinext build --config vite.vps.config.ts

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Keep full node_modules (not pruned to --prod) — the server bundle's
# externalized imports (postgres, bcryptjs, next-auth, pdf-lib, ...)
# need to resolve at runtime and vinext's externalization boundary
# wasn't verified without a real build+run cycle in a Node-only
# environment. Optimize this once the app is actually running.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./package.json

EXPOSE 3000
CMD ["node", "node_modules/vinext/dist/cli.js", "start", "--port", "3000", "--hostname", "0.0.0.0"]
