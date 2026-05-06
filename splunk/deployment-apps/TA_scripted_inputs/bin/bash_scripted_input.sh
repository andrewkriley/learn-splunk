#!/bin/sh
timestamp="$(date -u '+%Y-%m-%dT%H:%M:%S.000+0000')"
request_id="$(awk 'BEGIN { srand(); printf "scripted-bash-%06d", int(rand() * 1000000) }')"
printf 'ts=%s scripted_input=bash event={"language":"bash","status":"ok","request_id":"%s"}\n' "$timestamp" "$request_id"

