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

1. Start the lab.
2. Wait for `data/sample-logs/app.log` to appear.
3. Search:

   ```spl
   index=lab_file sourcetype=lab:app
   ```

4. Change `sourcetype = lab:app` to `sourcetype = lab:renamed`.
5. Reload the deployment server:

   ```sh
   docker compose exec deployment-server /opt/splunk/bin/splunk reload deploy-server
   ```

6. Restart the universal forwarder:

   ```sh
   docker compose restart universal-forwarder
   ```

7. Search both sourcetypes and observe the change.

## What To Learn

- `inputs.conf` defines what data to collect.
- File monitor stanzas use the path in the stanza name.
- `index`, `sourcetype`, and `host` metadata are decided before the event is indexed.
- Deployment changes are not magic; clients must receive the app and often restart.

