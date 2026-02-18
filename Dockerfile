FROM node:22-slim
WORKDIR /app

COPY package.json package-lock.json ./
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN npm ci

COPY . .
RUN npm run prisma:generate && npm run build

EXPOSE 3000
CMD ["sh", "-c", "npx prisma db push && npm run seed && npm run start"]
