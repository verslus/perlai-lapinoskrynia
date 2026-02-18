# Testu App (MVP)

Psichologinių testų platforma pagal pateiktą koncepciją: 3 rolės (`client`, `consultant`, `admin`), konsultanto inicijuotas portalas, ataskaitos, feedback, audit ir duomenų trynimas.

## Stack

- Next.js 15 + TypeScript
- Prisma + PostgreSQL
- JWT sesijos cookie
- Docker / docker-compose

## Greitas startas

1. Nukopijuok `.env.example` į `.env`.
2. Paleisk DB: `docker compose up -d db`.
3. Įdiek paketus: `npm install`.
4. Sukurk DB struktūrą: `npx prisma db push`.
5. Seed: `npm run seed`.
6. Startas: `npm run dev`.

## Prisijungimai po seed

- Admin: `admin@testu.lt`
- Konsultantas: `konsultantas@testu.lt`
- Slaptažodis: `ChangeMe123!` (pasikeisk)

## Pagrindiniai srautai

- `/login` - consultant/admin login
- `/consultant` - kliento nuorodos kūrimas + statusai
- `/p/<token>` - kliento portalas (sutikimas, testas, ataskaita, feedback, delete)
- `/admin` - analitika + import/export

## Admin import formatas

`POST /api/admin/import` body:

```json
{
  "slug": "miegas-116",
  "version": 2,
  "language": "lt",
  "title": "Miego testas",
  "description": "Trumpas aprašymas",
  "questions": [
    { "order": 1, "text": "Klausimas...", "dimension": "sleep_hygiene", "isReverse": false }
  ]
}
```

## Backup į Cloudflare R2

- Komanda: `npm run backup:r2`
- Reikalinga `.env`: `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`
- Hetzner cron pavyzdys (kasdien 02:30):

```bash
30 2 * * * cd /opt/testu-app && /usr/bin/npm run backup:r2 >> /var/log/testu-backup.log 2>&1
```

## Deploy į Hetzner

```bash
git clone <repo>
cd testu-app
cp .env.example .env
# sutvarkyti .env

docker compose up -d --build
```

