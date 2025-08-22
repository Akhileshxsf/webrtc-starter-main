#!/bin/bash
while getopts ":duration:mode:" opt; do
  case $opt in
    duration) DURATION="$OPTARG" ;;
    mode) MODE="$OPTARG" ;;
  esac
done

export MODE=$MODE

./start.sh

# Open browser (Windows example; adjust for your OS)
start chrome "https://10.10.51.148:8181?bench=$DURATION&mode=$MODE"

sleep $((DURATION + 5))

echo "Bench complete. Check metrics.json"