FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig.base.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm ci

COPY apps/frontend apps/frontend
COPY packages/shared packages/shared

RUN npm run build -w @lxc-manager/shared && npm run build -w @lxc-manager/frontend

FROM nginx:1.27-alpine

COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html
COPY docker/nginx.frontend.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
