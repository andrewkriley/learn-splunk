const lessonList = document.querySelector("#lesson-list");
const lessonContent = document.querySelector("#lesson-content");
const commandList = document.querySelector("#command-list");
const commandOutput = document.querySelector("#command-output");

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
