#!/usr/bin/env bash
set -euo pipefail
cd /opt/customer-service-chat

set -a
# shellcheck disable=SC1091
source ./.env.aliyun
set +a

rm -f .deps-ready

docker-compose -f docker-compose.aliyun.yml down
docker volume rm customerservicechat_node_modules 2>/dev/null || true

docker-compose -f docker-compose.aliyun.yml up -d postgres redis
sleep 5
docker-compose -f docker-compose.aliyun.yml up -d backend

echo "Waiting for backend npm install..."
for i in $(seq 1 90); do
  if [ -f /opt/customer-service-chat/.deps-ready ]; then
    echo "Dependencies ready"
    break
  fi
  sleep 5
done

docker-compose -f docker-compose.aliyun.yml up -d user-web agent-web admin-web tenant-admin-web sdk
echo "REDEPLOY_STARTED"
