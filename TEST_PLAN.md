# Test Plan

This project should be developed test-first where practical. Each new lesson or
lab feature should start with a failing test that describes the learner-visible
behavior.

## Test Layers

### 1. Web Unit And Regression Tests

Run from `web/`:

```sh
npm test
```

Current coverage:

- Lesson API lists only Markdown lessons.
- Lesson API renders Markdown to HTML.
- Browser lesson app replaces `Loading lessons...` with the first lesson.
- Host-based Splunk proxy runs before static lesson assets.
- Command API rejects commands outside the allow-list.

These tests should catch common cockpit regressions before Docker/Splunk is
involved.

### 2. Compose And Script Static Checks

Run from the repository root:

```sh
docker compose config --quiet
python3 -m py_compile scripts/generate_logs.py scripts/validate_lab.py
```

These checks catch malformed Compose config and Python syntax errors.

### 3. Lab Integration Validation

Run after `docker compose up -d`:

```sh
python3 scripts/validate_lab.py
```

Expected output:

```text
PASS all expected Docker services are running
PASS indexer management API is ready
PASS lab events are searchable
```

### 4. Browser Smoke Checks

Open:

- `http://localhost:3000`
- `http://splunk.localhost:3000`
- `http://deployment.localhost:3000`
- `http://heavy.localhost:3000`

Expected behavior:

- The cockpit loads lessons without staying on `Loading lessons...`.
- The Splunk tabs show Splunk login pages or active sessions.
- The `Lab CLI` tab can run `Run full lab validation`.

## TDD Workflow

For each feature:

1. Write or update a test describing the expected learner-visible behavior.
2. Run the test and confirm it fails for the right reason.
3. Implement the smallest change that makes it pass.
4. Run the full local test set.
5. Rebuild affected containers and run the integration validator.

## Security Checks

- Do not add a general shell endpoint to the web service.
- Keep browser CLI commands allow-listed.
- Redact local Splunk passwords from command output.
- Do not commit `.env`.
- Do not expose `localhost:3000` beyond the local machine because it can access
  selected Docker/Splunk lab commands.
