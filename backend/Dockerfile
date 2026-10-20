FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache dumb-init

# ── Dependencies (production only) ───────────────────────────────────────────
FROM base AS deps
COPY package.json ./
COPY backend/package.json ./backend/
COPY shared/package.json ./shared/
RUN npm install --workspace=backend --workspace=shared --omit=dev && npm cache clean --force

# ── Build ─────────────────────────────────────────────────────────────────────
FROM base AS build
COPY package.json ./
COPY backend/package.json ./backend/
COPY shared/package.json ./shared/
RUN npm install --workspace=backend --workspace=shared
COPY shared/ ./shared/
COPY backend/ ./backend/
RUN npm run build --workspace=shared
WORKDIR /app/backend
RUN npx prisma generate
RUN npm run build

# ── Production image ──────────────────────────────────────────────────────────
FROM base AS production
ENV NODE_ENV=production

RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001
USER nestjs

COPY --from=deps  --chown=nestjs:nodejs /app/node_modules      ./node_modules
COPY --from=build --chown=nestjs:nodejs /app/shared/dist       ./shared/dist
COPY --from=build --chown=nestjs:nodejs /app/shared/package.json ./shared/package.json
COPY --from=build --chown=nestjs:nodejs /app/backend/dist      ./backend/dist
COPY --from=build --chown=nestjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build --chown=nestjs:nodejs /app/backend/prisma    ./backend/prisma

WORKDIR /app/backend
EXPOSE 3000
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main"]
