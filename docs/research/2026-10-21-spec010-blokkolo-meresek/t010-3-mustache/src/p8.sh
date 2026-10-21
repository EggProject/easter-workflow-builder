cd "$(dirname "$0")"
for combo in "stock nolistener notraps" "stock listener traps" "spec nolistener notraps" "spec listener traps" "strict nolistener notraps" "strict listener traps"; do
  echo "===== node p8-run.mjs $combo ====="
  node p8-run.mjs $combo 2>&1
  echo "kilépési kód: ${PIPESTATUS[0]}"
done
