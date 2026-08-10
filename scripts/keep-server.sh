#!/bin/bash
cd /home/z/my-project
PORT=3000
while true; do
  if ! lsof -i :${PORT} >/dev/null 2>&1; then
    echo "[$(date)] Starting server..." >> /tmp/server-restart.log
    node .next/standalone/server.js &
    SERVER_PID=$!
    echo "[$(date)] Started PID $SERVER_PID" >> /tmp/server-restart.log
    sleep 5
    if kill -0 $SERVER_PID 2>/dev/null; then
      echo "[$(date)] Server $SERVER_PID is alive" >> /tmp/server-restart.log
    else
      echo "[$(date)] Server $SERVER_PID died" >> /tmp/server-restart.log
    fi
  fi
  sleep 3
done
