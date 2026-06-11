FROM node:22-alpine AS build
WORKDIR /app
COPY apps/api/package.json apps/api/package-lock.json* ./
RUN npm install
COPY apps/api .
RUN npx prisma generate && npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/dist dist
COPY --from=build /app/prisma prisma
COPY --from=build /app/package.json .
EXPOSE 3001
# Aplica migracoes e sobe a API
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
