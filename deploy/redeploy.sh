#!/usr/bin/env bash
set -euo pipefail
cd /opt/customer-service-chat

set -a
# shellcheck disable=SC1091
source ./.env.aliyun
set +a

docker-compose -f docker-compose.aliyun.yml down
docker volume rm customerservicechat_node_modules 2>/dev/null || true

docker-compose -f docker-compose.aliyun.yml up -d
echo "REDEPLOY_STARTED"
