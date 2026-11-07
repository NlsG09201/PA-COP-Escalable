#!/usr/bin/env bash
set -euo pipefail

case "${MONGO_APP_USERNAME:-}" in
  ''|*[!a-zA-Z0-9_]* ) echo "Invalid Mongo application username" >&2; exit 1 ;;
esac
if [[ ${#MONGO_APP_USERNAME} -lt 3 || ${#MONGO_APP_USERNAME} -gt 32 ]]; then
  echo "Invalid Mongo application username length" >&2
  exit 1
fi
if [[ ! "${MONGO_APP_PASSWORD:-}" =~ ^[a-fA-F0-9]{32,128}$ ]]; then
  echo "Mongo application password must be 32-128 hexadecimal characters" >&2
  exit 1
fi

root_uri="mongodb://${MONGO_ROOT_USERNAME}:${MONGO_ROOT_PASSWORD}@mongodb:27017/admin?authSource=admin"
for _ in $(seq 1 60); do
  if mongosh "$root_uri" --quiet --eval 'try { quit(rs.status().ok ? 0 : 1) } catch (e) { try { rs.initiate({_id:"rs0",members:[{_id:0,host:"mongodb:27017"}]}); quit(0) } catch (initError) { quit(1) } }'; then
    break
  fi
  sleep 1
done

mongosh "$root_uri" --quiet --eval 'quit(db.hello().isWritablePrimary ? 0 : 1)' || {
  echo "Mongo replica set did not become primary" >&2
  exit 1
}
export MONGO_APP_USERNAME MONGO_APP_PASSWORD
mongosh "$root_uri" --quiet --file /scripts/create-app-user.js
echo "Mongo replica set ready; least-privilege application user configured"
