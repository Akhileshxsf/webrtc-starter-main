#!/bin/bash
MODE=${MODE:-wasm}
if [ "$1" = "--ngrok" ]; then
  export NGROK_AUTH_TOKEN=31aPcL9aBVu9Da1nJGFjzTxMO0a_75sY9p2fWzhiwAYibvkv6
fi
if [ "$MODE" = "server" ]; then
  docker-compose up --build
else
  npm start
fi