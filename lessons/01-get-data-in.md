# Lesson 01: Get Data In With `inputs.conf`

## Goal

Learn how a file monitor input turns an operating-system file into Splunk events.

## Login Details

Use these credentials for every Splunk web UI in this lab:

- username: `admin`
- password: `{{SPLUNK_PASSWORD}}`

Lab URLs:

- Cockpit: <http://learn.localtest.me:3000>
- Indexer/search UI: <http://learn.localtest.me:3000/splunk/>
- Deployment server UI: <http://learn.localtest.me:3000/deployment/>
- Heavy forwarder UI: <http://learn.localtest.me:3000/heavy/>

## Files

- `splunk/deployment-apps/TA_linux_file_inputs/default/inputs.conf`
- `scripts/generate_logs.py`
- `data/sample-logs/app.log`

> Tip: click the **File Example** card in the architecture pane to open the related files and live `btool` output in Lab CLI.

The universal forwarder mounts `data/sample-logs` as `/var/log/lab`. The deployment server sends this input to the universal forwarder:

```ini
[monitor:///var/log/lab/app.log]
disabled = 0
index = lab_file
sourcetype = lab:app
host_segment = 3
followTail = 0
```

## Exercise

### Step 1: Start and inspect the source

1. Start the lab.
2. Wait for `data/sample-logs/app.log` to appear.

### Step 2: Search the dedicated index

Search:

   ```spl
   index=lab_file sourcetype=lab:app
   ```

### Step 3: Make a metadata change

Change `sourcetype = lab:app` to `sourcetype = lab:renamed`, then reload the deployment server:

   ```sh
   docker compose exec deployment-server /opt/splunk/bin/splunk reload deploy-server
   ```

Restart the universal forwarder:

   ```sh
   docker compose restart universal-forwarder
   ```

Search both sourcetypes and observe the change.

| Metadata field | Lab value | Where it is set |
|---|---|---|
| `index` | `lab_file` | `inputs.conf` |
| `source` | `/var/log/lab/app.log` | monitor stanza path |
| `sourcetype` | `lab:app` | `inputs.conf` |

## What To Learn

- `inputs.conf` defines what data to collect.
- File monitor stanzas use the path in the stanza name.
- `index`, `sourcetype`, and `host` metadata are decided before the event is indexed.
- Deployment changes are not magic; clients must receive the app and often restart.

