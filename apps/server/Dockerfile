FROM node:20-alpine AS base

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY packages ./packages
COPY apps/server ./apps/server

RUN pnpm install --frozen-lockfile

RUN pnpm --filter @space-sim/server db:generate
RUN pnpm --filter @space-sim/server build

EXPOSE 4000

CMD ["pnpm", "--filter", "@space-sim/server", "start"]
