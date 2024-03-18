# syntax = docker/dockerfile:1

# Adjust NODE_VERSION as desired
ARG NODE_VERSION=20.10.0
FROM node:${NODE_VERSION}-slim as base

LABEL fly_launch_runtime="Node.js"

# Node.js app lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV="production"

# Throw-away build stage to reduce size of final image
FROM base as build

# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install -y build-essential pkg-config python-is-python3

# Copy application code
COPY --link . .

# Install node modules
RUN npm install --include=dev -w rolodex

# Build application
RUN --mount=type=secret,id=VITE_NETWORK \
    --mount=type=secret,id=VITE_GOOGLE_CLIENT_ID \
    VITE_NETWORK="$(cat /run/secrets/VITE_NETWORK)" \
    VITE_GOOGLE_CLIENT_ID="$(cat /run/secrets/VITE_GOOGLE_CLIENT_ID)" npm run build -w rolodex

# Remove development dependencies
RUN npm prune --omit=dev

# Final stage for app image
FROM base

# Copy built application
COPY --from=build /app /app

# Start the server by default, this can be overwritten at runtime
EXPOSE 3000
CMD [ "npm", "run", "server", "-w", "rolodex" ]
