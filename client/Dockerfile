# NEC Innovation Lab web — build the React app, serve it with nginx
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# "/api" = same origin: nginx below forwards /api to the API container (no CORS needed)
ARG VITE_API_URL=/api
ARG VITE_COLLEGE_DOMAIN=nandhaengg.org
ENV VITE_API_URL=$VITE_API_URL VITE_COLLEGE_DOMAIN=$VITE_COLLEGE_DOMAIN
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY nginx-security-headers.inc /etc/nginx/security-headers.inc
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
