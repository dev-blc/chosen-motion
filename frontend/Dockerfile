# Build stage
FROM node:20-alpine as build-stage

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Vite embeds these at build time; Railway injects service variables as build args.
ARG VITE_API_URL
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_API_URL=$VITE_API_URL \
    VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

RUN npm run build

# Production stage
FROM nginx:stable-alpine as production-stage

COPY --from=build-stage /app/dist /usr/share/nginx/html

# SPA routing; listen port is substituted at runtime for Railway's PORT variable.
RUN echo 'server { \
    listen 3000; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["sh", "-c", "sed -i \"s/listen 3000/listen ${PORT:-3000}/\" /etc/nginx/conf.d/default.conf && exec nginx -g 'daemon off;'"]
