# Polyhouse OS - one container: API + built web app on port 4000
FROM node:20-alpine AS web
WORKDIR /app
COPY client/package*.json client/
RUN npm --prefix client ci --include=dev
COPY client client
RUN npm --prefix client run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=4000
COPY server/package*.json server/
RUN npm --prefix server ci --omit=dev
COPY server server
COPY --from=web /app/client/dist client/dist
RUN mkdir -p server/uploads && chown -R node:node server/uploads
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s CMD wget -qO- http://localhost:4000/api/health || exit 1
CMD ["node", "server/src/index.js"]
