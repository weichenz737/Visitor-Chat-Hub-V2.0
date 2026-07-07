#!/usr/bin/env bash
set -euo pipefail
cd /opt/customer-service-chat

JWT="$(openssl rand -hex 32)"
DBPASS="$(openssl rand -hex 16)"
BASE="http://39.97.240.31"

cat > .env.aliyun <<EOF
PUBLIC_BASE_URL=${BASE}
POSTGRES_PASSWORD=${DBPASS}
JWT_SECRET=${JWT}
CORS_ORIGINS=${BASE}:5173,${BASE}:5174,${BASE}:5175,${BASE}:5176,${BASE}:5177
EOF

set -a
# shellcheck disable=SC1091
source ./.env.aliyun
set +a

docker-compose -f docker-compose.aliyun.yml pull
docker-compose -f docker-compose.aliyun.yml up -d

echo "DEPLOY_STARTED"
