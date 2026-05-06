# Lesson 03: `outputs.conf` And `props.conf`

## Goal

Understand which configuration belongs where in a forwarding path.

## Login Details

Use these credentials for every Splunk web UI in this lab:

- username: `admin`
- password: `{{SPLUNK_PASSWORD}}`

Lab URLs:

- Cockpit: <http://learn.localtest.me:3000>
- Indexer/search UI: <http://learn.localtest.me:3000/splunk/>
- Deployment server UI: <http://learn.localtest.me:3000/deployment/>
- Heavy forwarder UI: <http://learn.localtest.me:3000/heavy/>

## `outputs.conf`

> Routing rule of thumb: `inputs.conf` decides what is collected, `outputs.conf` decides where it goes next, and `props.conf` decides how events are parsed.

Forwarders use `outputs.conf` to decide where to send data:

```ini
[tcpout]
defaultGroup = lab_indexers

[tcpout:lab_indexers]
server = splunk-indexer:9997
```

In this lab, the deployment server sends that file from:

```text
splunk/deployment-apps/TA_common_outputs/default/outputs.conf
```

## `props.conf`

`props.conf` controls parsing behavior such as event breaking and timestamp extraction.

This lab has parsing settings in two places on purpose:

- `splunk/indexer/apps/lab_index/default/props.conf`
- `splunk/deployment-apps/TA_heavy_forwarder_parsing/default/props.conf`

The indexer copy applies to events parsed at the indexer. The heavy-forwarder copy is for lessons where the heavy forwarder receives and parses data before forwarding it onward.

## Exercise

Open the **Lab CLI** pane and run:

- **Show active UF outputs.conf**
- **Show indexer/search props.conf for lab:app**
- **Show heavy forwarder props.conf for lab:app**

The equivalent CLI commands are shown below for reference.

Inspect active output settings on the universal forwarder:

```sh
docker compose exec universal-forwarder /opt/splunkforwarder/bin/splunk btool outputs list --debug
```

Inspect parsing settings on the indexer:

```sh
docker compose exec splunk-indexer /opt/splunk/bin/splunk btool props list lab:app --debug
```

Inspect parsing settings available on the heavy forwarder:

```sh
docker compose exec heavy-forwarder /opt/splunk/bin/splunk btool props list lab:app --debug
```

Search:

```spl
index=lab_file sourcetype=lab:app
```

Look at `_time`, `host`, `source`, and `sourcetype`.

| File | Primary question it answers |
|---|---|
| `inputs.conf` | What should Splunk collect or listen to? |
| `outputs.conf` | Where should a forwarder send data? |
| `props.conf` | How should events be broken, timestamped, and typed? |
| `transforms.conf` | Should fields or raw event text be rewritten before storage? |

## What To Learn

- `outputs.conf` is a forwarding/routing concern.
- `inputs.conf` is a collection concern.
- `props.conf` is a parsing concern.
- Universal forwarders have limited parsing capability.
- Heavy forwarders can parse, transform, route, and optionally index locally.

