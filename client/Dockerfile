# --- Dependencies base
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./

# Use npm ci for reproducible installs in CI
RUN npm ci

# --- Test stage
FROM deps AS test
WORKDIR /app
COPY . .
ENV CI=true
# If you use yarn/pnpm, replace accordingly
CMD ["npm", "test", "--", "--ci", "--watchAll=false"]

# --- Build stage
FROM deps AS builder
WORKDIR /app
COPY . .
RUN npm run build

# --- Production image (nginx serving the static build)
FROM nginx:alpine AS prod
# Expose 80 because nginx serves on 80 by default (change only if your nginx.conf listens on 3000)
EXPOSE 3000

COPY ./nginx/default.conf /etc/nginx/conf.d/default.conf

COPY --from=builder /app/build /usr/share/nginx/html

CMD ["nginx", "-g", "daemon off;"]