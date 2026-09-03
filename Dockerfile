# PWA statis (Vite + React) — build lalu disajikan lewat nginx.
# VITE_* di-bake saat build (client-side only, tidak ada server env runtime).

FROM node:22-alpine AS build
RUN npm install -g pnpm
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN pnpm install --frozen-lockfile
COPY . .
ARG VITE_SECURE_SALT_LITE
ARG VITE_SECURE_SALT_PRO
ARG VITE_API_URL
ARG VITE_ADMIN_WA
ENV VITE_SECURE_SALT_LITE=$VITE_SECURE_SALT_LITE \
    VITE_SECURE_SALT_PRO=$VITE_SECURE_SALT_PRO \
    VITE_API_URL=$VITE_API_URL \
    VITE_ADMIN_WA=$VITE_ADMIN_WA
RUN pnpm build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
