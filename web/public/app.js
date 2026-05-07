const lessonList = document.querySelector("#lesson-list");
const lessonContent = document.querySelector("#lesson-content");
const commandList = document.querySelector("#command-list");
const commandOutput = document.querySelector("#command-output");
const labStatusStrip = document.querySelector("#lab-status-strip");
const mcpToolList = document.querySelector("#mcp-tool-list");
const mcpToolForm = document.querySelector("#mcp-tool-form");
const mcpResult = document.querySelector("#mcp-result");
const mcpRunButton = document.querySelector("#mcp-run-tool");
const themeMode = document.querySelector("#theme-mode");
const statusSummaryText = document.querySelector("#status-summary-text");
const statusLastUpdated = document.querySelector("#status-last-updated");
const statusDetailList = document.querySelector("#status-detail-list");
const guideProgress = document.querySelector("#guide-progress");

let activeMcpTool = null;
const guideSections = [
  "start-here",
  "lab-topology",
  "data-sources",
  "forwarding-paths",
  "mcp-ask",
  "deployment-server",
  "parsing-masking",
  "status",
  "docs-skills",
];
const guideWorkspaceDefaults = new Map([
  ["start-here", "splunk"],
  ["lab-topology", "terminal"],
]);

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || `Request failed with ${response.status}`);
  }
  return body;
}

function applyTheme(mode) {
  const selected = mode || "system";
  document.documentElement.dataset.theme = selected;
  if (themeMode) {
    themeMode.value = selected;
  }
}

function initializeTheme() {
  const storage = window.localStorage;
  const stored = storage.getItem("learn-splunk-theme") || "system";
  applyTheme(stored);
  themeMode?.addEventListener("change", () => {
    storage.setItem("learn-splunk-theme", themeMode.value);
    applyTheme(themeMode.value);
  });
}

function activateGuideSection(sectionId) {
  const index = guideSections.indexOf(sectionId);
  if (index === -1) {
    return;
  }

  document.querySelectorAll(".guide-nav-item[data-section]").forEach((item) => {
    item.classList.toggle("active", item.dataset.section === sectionId);
  });
  document.querySelectorAll(".guide-section").forEach((section) => {
    section.classList.toggle("active", section.dataset.section === sectionId);
  });
  const workspaceView = guideWorkspaceDefaults.get(sectionId);
  if (workspaceView) {
    activateView(workspaceView);
  }
  if (guideProgress) {
    guideProgress.textContent = `Step ${index + 1} of ${guideSections.length}`;
  }
  document.querySelectorAll("[data-guide-prev]").forEach((button) => {
    button.disabled = index === 0;
  });
  document.querySelectorAll("[data-guide-next]").forEach((button) => {
    button.disabled = index === guideSections.length - 1;
  });

}

function initializeGuideNavigation() {
  document.querySelectorAll(".guide-nav-item[data-section]:not(.locked)").forEach((item) => {
    item.addEventListener("click", () => activateGuideSection(item.dataset.section));
  });
  document.querySelectorAll("[data-guide-prev]").forEach((button) => {
    button.addEventListener("click", () => {
      const active = document.querySelector(".guide-nav-item.active[data-section]")?.dataset.section || guideSections[0];
      const index = Math.max(0, guideSections.indexOf(active) - 1);
      activateGuideSection(guideSections[index]);
    });
  });
  document.querySelectorAll("[data-guide-next]").forEach((button) => {
    button.addEventListener("click", () => {
      const active = document.querySelector(".guide-nav-item.active[data-section]")?.dataset.section || guideSections[0];
      const index = Math.min(guideSections.length - 1, guideSections.indexOf(active) + 1);
      activateGuideSection(guideSections[index]);
    });
  });
  activateGuideSection(guideSections[0]);
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

  document.querySelectorAll(".data-source-card, .topology-command-card").forEach((card) => {
    const commandId = card.dataset.command;
    const label = commandLabels.get(commandId) || card.textContent.trim();
    const openCommand = () => {
      activateView("terminal");
      runCommand(commandId, label);
    };
    card.addEventListener("click", openCommand);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openCommand();
      }
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
  if (!labStatusStrip && !statusDetailList) {
    return;
  }

  try {
    const { services } = await requestJson("/api/lab/status");
    const healthyCount = services.filter((service) => service.status === "ok").length;
    const unhealthyServices = services.filter((service) => service.status !== "ok");
    const updated = new Date().toLocaleTimeString();
    if (labStatusStrip) {
      if (unhealthyServices.length === 0) {
        labStatusStrip.replaceChildren();
      } else {
        const warning = document.createElement("span");
        warning.className = "status-badge degraded";
        warning.textContent = `Lab warning: ${unhealthyServices.length} container${unhealthyServices.length === 1 ? "" : "s"} need attention`;
        warning.title = unhealthyServices.map((service) => `${service.name}: ${service.status}`).join(", ");
        labStatusStrip.replaceChildren(warning);
      }
    }
    if (statusSummaryText) {
      statusSummaryText.textContent = `${healthyCount}/${services.length} services healthy`;
    }
    if (statusLastUpdated) {
      statusLastUpdated.textContent = `Live · Updated ${updated}`;
    }
    statusDetailList?.replaceChildren(
      ...services.map((service) => {
        const item = document.createElement("article");
        item.className = `status-detail-card ${service.status}`;
        const latency = service.latencyMs === null || service.latencyMs === undefined ? "n/a" : `${service.latencyMs}ms`;
        const title = document.createElement("strong");
        title.textContent = service.name;
        const status = document.createElement("p");
        status.textContent = `Status: ${service.status}`;
        const details = document.createElement("small");
        const container = service.containerStatus
          ? `Container: ${service.containerStatus}${service.health ? ` (${service.health})` : ""}`
          : "Container: n/a";
        details.textContent = `${container} · HTTP: ${service.httpStatus || "n/a"} · Latency: ${latency}${service.message ? ` · ${service.message}` : ""}`;
        item.append(title, status, details);
        return item;
      }),
    );
  } catch (error) {
    const item = document.createElement("span");
    item.className = "status-badge down";
    item.textContent = "Lab warning: status unavailable";
    item.title = error.message;
    labStatusStrip?.replaceChildren(item);
    if (statusSummaryText) {
      statusSummaryText.textContent = "Status unavailable";
    }
    if (statusLastUpdated) {
      statusLastUpdated.textContent = error.message;
    }
    if (statusDetailList) {
      const item = document.createElement("article");
      item.className = "status-detail-card down";
      const title = document.createElement("strong");
      title.textContent = "Status API";
      const message = document.createElement("p");
      message.textContent = error.message;
      item.append(title, message);
      statusDetailList.replaceChildren(item);
    }
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
        const name = document.createElement("strong");
        name.textContent = tool.name;
        const description = document.createElement("small");
        description.textContent = tool.description || "";
        button.append(name, description);
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

document.querySelectorAll(".setup-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".setup-tab").forEach((item) => item.classList.toggle("active", item === tab));
    document.querySelectorAll(".setup-panel").forEach((panel) => {
      panel.classList.toggle("active", panel.dataset.setupPanel === tab.dataset.setupTab);
    });
  });
});

initializeTheme();
initializeGuideNavigation();
loadLabStatus();
const statusInterval = setInterval(loadLabStatus, 30_000);
if (typeof statusInterval.unref === "function") {
  statusInterval.unref();
}
loadMcpExplorer();
