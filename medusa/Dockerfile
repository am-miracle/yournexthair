FROM node:22-slim AS build
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

COPY . .

# The admin dashboard bakes these in at build time.
ARG BACKEND_URL
ARG STOREFRONT_URL
# medusa-config requires these to load; the real values are only read at runtime.
RUN JWT_SECRET=build-only COOKIE_SECRET=build-only pnpm build

RUN cp pnpm-lock.yaml .npmrc .medusa/server/ \
  && cd .medusa/server \
  && pnpm install --frozen-lockfile --prod

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.medusa/server ./

EXPOSE 9000
CMD ["sh", "-c", "npx medusa db:migrate && npx medusa start"]
