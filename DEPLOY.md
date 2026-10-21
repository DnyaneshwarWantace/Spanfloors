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

Copy the local database to the server (content, blog, media records, settings):

```bash
# on your Mac
docker compose --env-file docker.env exec -T db pg_dump -U spanfloors -d spanfloors | gzip > spanfloors.sql.gz
scp spanfloors.sql.gz user@SERVER:~/spanfloors/
# on the server
gunzip -c spanfloors.sql.gz | docker compose -f docker-compose.prod.yml exec -T db psql -U spanfloors -d spanfloors
```

Media files in `storage/uploads/` come with the git repository for now (later: S3/R2).

Create the admin login on the server if needed:

```bash
docker compose -f docker-compose.prod.yml exec app node -e "1"   # check the app container is up
```

(Admin accounts are copied with the database dump above.)

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
