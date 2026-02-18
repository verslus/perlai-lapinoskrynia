FROM node:22-slim
WORKDIR /app

COPY package.json package-lock.json ./
RUN apt-get update -y && apt-get install -y openssl ca-certificates wget gnupg && \
    install -d /usr/share/postgresql-common/pgdg && \
    wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.gpg && \
    echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.gpg] http://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list && \
    apt-get update -y && apt-get install -y postgresql-client-16 && \
    rm -rf /var/lib/apt/lists/*
RUN npm ci

COPY . .
RUN npm run prisma:generate && npm run build

EXPOSE 3000
CMD ["sh", "-c", "npx prisma db push && npm run seed && npm run start"]
