# Build stage
FROM node:23-alpine AS build-stage
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine
# Copy built assets from builder
COPY --from=build-stage /app/dist /usr/share/nginx/html
# Copy custom Nginx SPA routing configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
