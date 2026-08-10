FROM node:18-alpine AS builder

WORKDIR /app

# Install build tools needed for node-gyp and emscripten
RUN apk add --no-cache bash build-base python3 make g++ git curl \
    && git clone https://github.com/emscripten-core/emsdk.git /opt/emsdk \
    && cd /opt/emsdk \
    && ./emsdk install 3.1.51 \
    && ./emsdk activate 3.1.51

ENV PATH="/opt/emsdk:/opt/emsdk/upstream/emscripten:${PATH}"
COPY . .

# Install dependencies (workspaces will be honored)
RUN yarn install --frozen-lockfile

# Build frontend and shared packages
RUN yarn build

# Build backend API
RUN yarn build:api

# ---------------------------------------------------------------------------
# Stage 2: Production
# ---------------------------------------------------------------------------
FROM node:20-alpine AS production

WORKDIR /app

# Copy the necessary config files
COPY --from=builder /app/package.json /app/yarn.lock ./

# Copy packages and node_modules from the builder stage
# We keep node_modules to preserve the yarn workspace symlinks
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/node_modules ./node_modules

# Copy the built frontend into a public directory
COPY --from=builder /app/pomaiwhiteboard-app/build /app/public

EXPOSE 3010

ENV FRONTEND_STATIC_PATH=/app/public
ENV NODE_ENV=production

# Start the backend server (which now also serves the frontend)
CMD ["node", "packages/api/dist/presentation/server.js"]
