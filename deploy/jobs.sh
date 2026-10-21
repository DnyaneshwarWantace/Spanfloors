#!/bin/sh
# Runs inside the "jobs" container.
echo "jobs: started"
last_backup=""
while true; do
  # Retry website leads that haven't reached Twenty yet.
  wget -q -O /dev/null --header="Authorization: Bearer ${CRON_SECRET}" http://app:3000/api/cron/sync-leads/ || echo "jobs: lead sync call failed"

  # Nightly backup at ~02:30 server time, keep 14 days.
  today=$(date +%Y-%m-%d)
  if [ "$(date +%H%M)" -ge 0230 ] && [ "$last_backup" != "$today" ]; then
    if pg_dump -h db -U spanfloors -d spanfloors | gzip > "/backups/spanfloors-$today.sql.gz"; then
      echo "jobs: backup written for $today"
      last_backup="$today"
      find /backups -name 'spanfloors-*.sql.gz' -mtime +14 -delete
    else
      echo "jobs: backup FAILED"
    fi
  fi
  sleep 300
done
