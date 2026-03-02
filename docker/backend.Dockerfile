FROM node:22-alpine AS app

WORKDIR /app

COPY package*.json ./
COPY tsconfig.base.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm ci

COPY apps/backend apps/backend
COPY packages/shared packages/shared

RUN npm run build -w @vm-manager/shared && npm run build -w @vm-manager/backend

EXPOSE 4000

CMD ["npm", "run", "start", "-w", "@vm-manager/backend"]
