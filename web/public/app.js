const lessonList = document.querySelector("#lesson-list");
const lessonContent = document.querySelector("#lesson-content");
const commandList = document.querySelector("#command-list");
const commandOutput = document.querySelector("#command-output");
const labStatusStrip = document.querySelector("#lab-status-strip");
const mcpToolList = document.querySelector("#mcp-tool-list");
const mcpToolForm = document.querySelector("#mcp-tool-form");
const mcpResult = document.querySelector("#mcp-result");
const mcpRunButton = document.querySelector("#mcp-run-tool");

let activeMcpTool = null;

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || `Request failed with ${response.status}`);
  }
  return body;
}

async function loadLessons() {
  const { lessons } = await requestJson("/api/lessons");
  lessonList.replaceChildren(
    ...lessons.map((lesson, index) => {
      const button = document.createElement("button");
      button.textContent = lesson.file.replace(".md", "");
      button.className = "lesson-button";
      button.addEventListener("click", () => loadLesson(lesson.id, button));
      if (index === 0) {
        queueMicrotask(() => button.click());
      }
      return button;
    }),
  );
}

async function loadLesson(id, activeButton) {
  document
    .querySelectorAll(".lesson-button")
    .forEach((button) => button.classList.toggle("active", button === activeButton));

  const lesson = await requestJson(`/api/lessons/${id}`);
  lessonContent.innerHTML = lesson.html;
  enhanceLessonContent();
}

function enhanceLessonContent() {
  lessonContent.querySelectorAll("pre").forEach((pre, index) => {
    if (pre.parentElement?.classList.contains("guide-code-block")) {
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "guide-code-block";
    const header = document.createElement("div");
    header.className = "guide-code-header";
    const label = document.createElement("span");
    label.textContent = pre.querySelector("code")?.className.replace("language-", "") || `snippet ${index + 1}`;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "copy-btn";
    button.textContent = "Copy";
    button.addEventListener("click", async () => {
      await navigator.clipboard.writeText(pre.textContent.trim());
      button.textContent = "Copied";
      button.classList.add("copied");
      setTimeout(() => {
        button.textContent = "Copy";
        button.classList.remove("copied");
      }, 1500);
    });

    header.append(label, button);
    pre.replaceWith(wrapper);
    wrapper.append(header, pre);
  });
}

async function loadCommands() {
  const { commands } = await requestJson("/api/commands");
  const commandLabels = new Map(commands.map((command) => [command.id, command.label]));
  commandList.replaceChildren(
    ...commands.map((command) => {
      const button = document.createElement("button");
      button.textContent = command.label;
      button.addEventListener("click", () => runCommand(command.id, command.label));
      return button;
    }),
  );

  document.querySelectorAll(".data-source-card").forEach((card) => {
    const commandId = card.dataset.command;
    const label = commandLabels.get(commandId) || card.textContent.trim();
    card.addEventListener("click", () => {
      activateView("terminal");
      runCommand(commandId, label);
    });
  });
}

async function runCommand(id, label) {
  commandOutput.textContent = `Running: ${label}\n`;
  try {
    const result = await requestJson(`/api/commands/${id}`, { method: "POST" });
    commandOutput.textContent = formatCommandResult(result);
  } catch (error) {
    commandOutput.textContent = `Command failed: ${error.message}`;
  }
}

function formatCommandResult(result) {
  const status = result.ok ? "PASS" : `FAIL exit ${result.exitCode}`;
  return [
    status,
    "",
    result.stdout ? `stdout:\n${result.stdout}` : "",
    result.stderr ? `stderr:\n${result.stderr}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function activateView(view) {
  document.querySelectorAll(".tab").forEach((item) => {
    item.classList.toggle("active", item.dataset.view === view);
  });
  document.querySelectorAll(".workspace-frame").forEach((frame) => {
    frame.classList.toggle("active", frame.id === `view-${view}`);
  });
}

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => activateView(tab.dataset.view));
});

loadLessons().catch((error) => {
  lessonContent.textContent = `Could not load lessons: ${error.message}`;
});

loadCommands().catch((error) => {
  commandOutput.textContent = `Could not load commands: ${error.message}`;
});

async function loadLabStatus() {
  if (!labStatusStrip) {
    return;
  }

  try {
    const { services } = await requestJson("/api/lab/status");
    labStatusStrip.replaceChildren(
      ...services.map((service) => {
        const item = document.createElement("span");
        item.className = `status-badge ${service.status}`;
        item.textContent = `${service.name}: ${service.status}`;
        item.title = service.latencyMs ? `${service.latencyMs}ms` : service.message || "";
        return item;
      }),
    );
  } catch (error) {
    const item = document.createElement("span");
    item.className = "status-badge down";
    item.textContent = "Status unavailable";
    item.title = error.message;
    labStatusStrip.replaceChildren(item);
  }
}

function inputForProperty(name, schema, value = "") {
  const wrapper = document.createElement("label");
  wrapper.className = "mcp-field";
  const title = document.createElement("span");
  title.textContent = name;
  const input = schema.type === "boolean" ? document.createElement("select") : document.createElement("textarea");
  input.name = name;
  input.dataset.type = schema.type || "string";
  if (schema.type === "boolean") {
    input.innerHTML = '<option value="false">false</option><option value="true">true</option>';
  } else {
    input.rows = name === "query" ? 3 : 1;
    input.value = value || schema.default || "";
  }
  const hint = document.createElement("small");
  hint.textContent = schema.description || "";
  wrapper.append(title, input, hint);
  return wrapper;
}

function renderMcpTool(tool) {
  activeMcpTool = tool;
  const properties = tool.inputSchema?.properties || {};
  mcpToolForm.replaceChildren(
    ...Object.entries(properties).map(([name, schema]) => inputForProperty(name, schema)),
  );
  mcpRunButton.disabled = false;
  mcpResult.textContent = `Ready to run ${tool.name}.`;
}

function collectMcpArguments() {
  const args = {};
  mcpToolForm.querySelectorAll("[name]").forEach((field) => {
    const rawValue = field.value;
    if (rawValue === "") {
      return;
    }
    if (field.dataset.type === "number") {
      args[field.name] = Number(rawValue);
    } else if (field.dataset.type === "boolean") {
      args[field.name] = rawValue === "true";
    } else {
      args[field.name] = rawValue;
    }
  });
  return args;
}

async function loadMcpExplorer() {
  if (!mcpToolList) {
    return;
  }

  try {
    const { tools } = await requestJson("/api/mcp/tools");
    mcpToolList.replaceChildren(
      ...tools.map((tool, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "mcp-tool-item";
        button.innerHTML = `<strong>${tool.name}</strong><small>${tool.description || ""}</small>`;
        button.addEventListener("click", () => {
          mcpToolList.querySelectorAll(".mcp-tool-item").forEach((item) => item.classList.remove("active"));
          button.classList.add("active");
          renderMcpTool(tool);
        });
        if (index === 0) {
          queueMicrotask(() => button.click());
        }
        return button;
      }),
    );
  } catch (error) {
    mcpToolList.textContent = `Could not load MCP tools: ${error.message}`;
  }
}

mcpRunButton?.addEventListener("click", async () => {
  if (!activeMcpTool) {
    return;
  }
  mcpResult.textContent = `Running ${activeMcpTool.name}...`;
  try {
    const result = await requestJson("/api/mcp/tools/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: activeMcpTool.name, arguments: collectMcpArguments() }),
    });
    mcpResult.textContent = JSON.stringify(result, null, 2);
  } catch (error) {
    mcpResult.textContent = `MCP call failed: ${error.message}`;
  }
});

document.querySelectorAll("[data-mcp-query]").forEach((button) => {
  button.addEventListener("click", () => {
    const queryField = mcpToolForm?.querySelector('[name="query"]');
    if (queryField) {
      queryField.value = button.dataset.mcpQuery;
    }
  });
});

loadLabStatus();
const statusInterval = setInterval(loadLabStatus, 30_000);
if (typeof statusInterval.unref === "function") {
  statusInterval.unref();
}
loadMcpExplorer();
