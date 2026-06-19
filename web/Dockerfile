# Dependencies
FROM node:24-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
# npm install (not ci): the lockfile is generated on Windows and lacks the
# Linux-musl optional native deps (Tailwind oxide, @emnapi/*) that ci requires.
RUN npm install --no-audit --no-fund

# Build (uses the committed generated types/routes; no gen:api needed)
FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . ./
RUN npm run build

# Dev stage — Next dev server with hot reload (used by docker-compose.dev.yml)
FROM node:24-alpine AS dev
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm install --no-audit --no-fund
COPY . ./
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "-H", "0.0.0.0"]

# Runtime — Next.js standalone output
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
