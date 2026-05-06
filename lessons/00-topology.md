# Lesson 00: Topology

## Goal

Understand the moving parts before changing configuration.

## Login Details

Use these credentials for every Splunk web UI in this lab:

- username: `admin`
- password: `{{SPLUNK_PASSWORD}}`

Lab URLs:

- Cockpit: <http://learn.localtest.me:3000>
- Indexer/search UI: <http://learn.localtest.me:3000/splunk/>
- Deployment server UI: <http://learn.localtest.me:3000/deployment/>
- Heavy forwarder UI: <http://learn.localtest.me:3000/heavy/>

The lab starts all components at once so you can see the complete data path:

```text
sample-log-source
  writes /var/log/lab/app.log
        |
        v
universal-forwarder
  receives inputs.conf and outputs.conf from deployment-server
        |
        v
splunk-indexer:9997
  receives, parses, indexes, and searches events
```

The heavy forwarder also runs in the lab. It is configured as a deployment client and forwards to the indexer. Later lessons use it to compare universal-forwarder and heavy-forwarder behavior.

## Components

- `splunk-indexer`: Splunk Enterprise receiver and search UI.
- `deployment-server`: Splunk Enterprise deployment server, called agent management in newer docs.
- `heavy-forwarder`: Full Splunk Enterprise instance with forwarding enabled.
- `universal-forwarder`: Lightweight forwarder with no web UI.
- `sample-log-source`: Python container that writes sample application logs.

## Inspect

Run:

```sh
docker compose ps
```

Then open Splunk Web at <http://localhost:8000> and search:

```spl
index=_internal
```

You should see internal logs from multiple Splunk hosts.

## What To Learn

- A forwarder sends data.
- A receiver accepts data, usually on port `9997`.
- A deployment server distributes configuration and apps to deployment clients.
- Splunk configuration lives in layered app directories, not in one global file.

