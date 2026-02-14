#!/usr/bin/env bash

set -euo pipefail

SIGNING_DIR=".signing/android"
KEYSTORE_PATH="${SIGNING_DIR}/freeohn-release-key.jks"
PROPERTIES_PATH="${SIGNING_DIR}/keystore.properties"
KEY_ALIAS="freeohn_release"

mkdir -p "${SIGNING_DIR}"

if [ -f "${KEYSTORE_PATH}" ] || [ -f "${PROPERTIES_PATH}" ]; then
  echo "Release keystore already exists in ${SIGNING_DIR}. Remove it first if you want to regenerate."
  exit 1
fi

STORE_PASS="$(openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | head -c 24)"

keytool -genkeypair -v \
  -storetype PKCS12 \
  -keystore "${KEYSTORE_PATH}" \
  -alias "${KEY_ALIAS}" \
  -keyalg RSA \
  -keysize 2048 \
  -validity 9125 \
  -storepass "${STORE_PASS}" \
  -dname "CN=Freeohn, OU=Engineering, O=Freeohn, L=Nairobi, ST=Nairobi, C=KE"

cat > "${PROPERTIES_PATH}" <<EOF
MYAPP_UPLOAD_STORE_FILE=../keystores/freeohn-release-key.jks
MYAPP_UPLOAD_KEY_ALIAS=${KEY_ALIAS}
MYAPP_UPLOAD_STORE_PASSWORD=${STORE_PASS}
MYAPP_UPLOAD_KEY_PASSWORD=${STORE_PASS}
EOF

chmod 600 "${PROPERTIES_PATH}"

echo "Release keystore created:"
echo "  ${KEYSTORE_PATH}"
echo "  ${PROPERTIES_PATH}"
