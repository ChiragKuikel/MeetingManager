# --- deps: install once, shared by dev and build stages ---
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- dev: nodemon + ts-node, source mounted as a volume by docker-compose.override.yml ---
FROM deps AS dev
COPY . .
EXPOSE 3001
CMD ["npm", "run", "dev"]

# --- build: compile TypeScript ---
FROM deps AS build
COPY . .
RUN npm run build

# --- prod: minimal runtime image ---
FROM node:20-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 3001
CMD ["node", "dist/app.js"]
