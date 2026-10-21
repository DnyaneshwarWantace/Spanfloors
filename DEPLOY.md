# Deploying the Span Floors website

One server runs everything with Docker: the website, PostgreSQL, Caddy (automatic HTTPS) and a small jobs container (lead retries to Twenty every 5 minutes, nightly database backups kept 14 days).

## 1. Server

- Ubuntu 22.04/24.04, 2 GB RAM or more, ~40 GB disk (AWS Lightsail/EC2 in `ap-south-1` recommended).
- Open ports 22 (SSH), 80 and 443.
- Install Docker: `curl -fsSL https://get.docker.com | sh`

## 2. DNS

Point the domain at the server's public IP (A record), e.g. `staging.spanfloors.com`. For go-live later: `www.spanfloors.com`, and `blog.spanfloors.com` (old blog links then 301 to `/blog/…`).

## 3. Code and settings

```bash
git clone https://github.com/DnyaneshwarWantace/Spanfloors.git spanfloors && cd spanfloors
cp .env.production.example .env.production
nano .env.production        # fill in domain, secrets (openssl rand -base64 32), Twenty key
```

`APP_SECRET` encrypts the API keys saved in the admin — set it once and never change it afterwards.

## 4. Start

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml logs -f app     # "database migrations up to date" then "Ready"
```

HTTPS certificates are issued automatically by Caddy on the first request (DNS must already point here).

## 5. Data (first deploy only)

The repository includes `deploy/seed/spanfloors-seed.sql.gz`: all pages, blog posts, media records, product extras and site settings (no users, logins or secrets). After the app has started once (step 4 creates the tables):

```bash
gunzip -c deploy/seed/spanfloors-seed.sql.gz | docker compose -f docker-compose.prod.yml exec -T db psql -U spanfloors -d spanfloors
```

Create the admin login (use a strong password, at least 10 characters):

```bash
docker compose -f docker-compose.prod.yml exec app sh -c \
  'NODE_PATH=/opt/migrate/node_modules node scripts/create-admin.mjs --email admin@spanfloors.com --name "Span Floors" --password "CHOOSE-A-STRONG-PASSWORD"'
```

Media files in `storage/uploads/` come with the git repository for now (later: S3/R2).

## 6. Updating

```bash
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Database migrations run automatically on start.

## 7. Backups

Nightly dumps land in `./backups/` on the server (14 days kept). Restore:

```bash
gunzip -c backups/spanfloors-YYYY-MM-DD.sql.gz | docker compose -f docker-compose.prod.yml exec -T db psql -U spanfloors -d spanfloors
```
