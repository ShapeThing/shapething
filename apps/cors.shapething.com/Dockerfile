# Build context is the monorepo root (see docker-compose.yml).
FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
COPY apps/cors.shapething.com/package.json ./apps/cors.shapething.com/
RUN pnpm install --frozen-lockfile --ignore-scripts --filter @shapething/cors
COPY apps/cors.shapething.com/tsconfig.json ./apps/cors.shapething.com/
COPY apps/cors.shapething.com/src ./apps/cors.shapething.com/src
RUN pnpm --filter @shapething/cors run build

# The server has no runtime dependencies, so only the compiled output is needed.
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY apps/cors.shapething.com/package.json ./
COPY --from=build /repo/apps/cors.shapething.com/dist ./dist

ENV PORT=8080
EXPOSE 8080
CMD ["node", "dist/index.js"]
