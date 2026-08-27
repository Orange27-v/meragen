FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
COPY packages/studio packages/studio
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -S meerah && adduser -S meerah -G meerah

COPY --from=build /app/node_modules node_modules
COPY --from=build /app/packages packages
COPY --from=build /app/.next .next
COPY --from=build /app/public public
COPY --from=build /app/package.json next.config.mjs ./

USER meerah
EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000"]
