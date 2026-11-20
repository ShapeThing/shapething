# Build context is the monorepo root (see docker-compose.yml).
# The proxy has no runtime dependencies and Node runs its TypeScript as is (type stripping), so
# the image is Node plus the source: no install or build step, which a small server can't afford
# for the monorepo's lockfile.
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY apps/cors.shapething.com/package.json ./
COPY apps/cors.shapething.com/src ./src

ENV PORT=8080
EXPOSE 8080
CMD ["node", "src/index.ts"]
