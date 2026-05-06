# Lesson 02: Deployment Apps And Server Classes

## Goal

Learn how the deployment server maps groups of clients to apps.

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

- `splunk/deployment-server/serverclass.conf`
- `splunk/deployment-apps/TA_common_outputs/default/outputs.conf`
- `splunk/deployment-apps/TA_linux_file_inputs/default/inputs.conf`
- `splunk/deployment-apps/TA_heavy_forwarder_parsing/default/props.conf`

## Mental Model

> Tip: use the **Show deployment apps and server classes** Lab CLI command before editing files. It prints the deployed apps and the `serverclass.conf` relationship in one place.

A deployment app is a directory under:

```text
$SPLUNK_HOME/etc/deployment-apps
```

When deployed, that app appears on clients under:

```text
$SPLUNK_HOME/etc/apps
```

A server class answers two questions:

1. Which clients match?
2. Which apps should those clients receive?

This lab uses:

```ini
[serverClass:all_forwarders]
whitelist.0 = *forwarder*

[serverClass:all_forwarders:app:TA_common_outputs]
restartSplunkd = true
```

That sends `TA_common_outputs` to both the universal forwarder and heavy forwarder.

## Exercise

### Step 1: List server classes

List server classes on the deployment server:

```sh
docker compose exec deployment-server /opt/splunk/bin/splunk btool serverclass list --debug
```

### Step 2: Check deployed apps on the client

Check which apps landed on the universal forwarder:

```sh
docker compose exec universal-forwarder ls /opt/splunkforwarder/etc/apps
```

| Deployment concept | Lab example |
|---|---|
| Server class | `all_forwarders`, `direct_universal_forwarders`, `via_heavy_universal_forwarders` |
| Deployment app | `TA_common_outputs`, `TA_linux_file_inputs`, `TA_outputs_to_heavy` |
| Client match | forwarder hostnames matched by `whitelist.*` |

## What To Learn

- Server classes can group by hostname patterns.
- One app can be assigned to many server classes.
- One client can match many server classes.
- Removing a managed app from the deployment server can remove it from clients.

