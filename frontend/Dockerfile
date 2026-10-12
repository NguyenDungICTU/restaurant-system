FROM node:20-bookworm-slim AS build

WORKDIR /app

COPY package*.json ./

# Vite 8 uses Rolldown native bindings. Install the Linux/glibc binding
# explicitly so npm optional-dependency resolution cannot omit it.
RUN npm ci --include=optional     && npm install --no-save --include=optional @rolldown/binding-linux-x64-gnu@1.2.9

COPY . .

ARG VITE_API_BASE_URL=
ARG VITE_WS_BASE_URL=

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_WS_BASE_URL=$VITE_WS_BASE_URL

RUN npm run build


FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
