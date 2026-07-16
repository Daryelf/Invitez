(function () {
  "use strict";

  const KEYS = ["name", "notes", "yes", "no", "submit"];
  const DEFAULT_LAYOUT = {
    name: { top: 74.8, left: 14, width: 40, height: 1.6 },
    notes: { top: 77.55, left: 19, width: 61, height: 1.6 },
    yes: { top: 73.6, left: 55.8, width: 6.7, height: 1.2 },
    no: { top: 72.12, left: 77.5, width: 6.7, height: 1.2 },
    submit: { top: 74.8, left: 83.5, width: 24, height: 1.8 },
  };
  const MINIMUM_SIZE = {
    name: { width: 8, height: 0.7 },
    notes: { width: 8, height: 0.7 },
    yes: { width: 3, height: 0.55 },
    no: { width: 3, height: 0.55 },
    submit: { width: 5, height: 0.7 },
  };
  const LABELS = { name: "Name", notes: "Additional info", yes: "Yes", no: "No", submit: "Submit" };
  const ROTATIONS = { name: -15, notes: -15, yes: 0, no: 0, submit: -15 };

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function number(value, fallback) {
    const next = Number(value);
    return Number.isFinite(next) ? next : fallback;
  }

  function rounded(value) {
    return Math.round(value * 1000) / 1000;
  }

  function normalizeLayout(value) {
    const input = value && typeof value === "object" ? value : {};
    return Object.fromEntries(KEYS.map((key) => {
      const fallback = DEFAULT_LAYOUT[key];
      const candidate = input[key] && typeof input[key] === "object" ? input[key] : {};
      return [key, {
        top: rounded(clamp(number(candidate.top, fallback.top), 0, 98.5)),
        left: rounded(clamp(number(candidate.left, fallback.left), -10, 105)),
        width: rounded(clamp(number(candidate.width, fallback.width), MINIMUM_SIZE[key].width, 110)),
        height: rounded(clamp(number(candidate.height, fallback.height), MINIMUM_SIZE[key].height, 18)),
      }];
    }));
  }

  function applyLayout(form, value) {
    const layout = normalizeLayout(value);
    KEYS.forEach((key) => {
      const box = layout[key];
      form.style.setProperty(`--rsvp-${key}-top`, `${box.top}%`);
      form.style.setProperty(`--rsvp-${key}-left`, `${box.left}%`);
      form.style.setProperty(`--rsvp-${key}-width`, `${box.width}%`);
      form.style.setProperty(`--rsvp-${key}-height`, `${box.height}%`);
    });
    return layout;
  }

  function createRsvpLayoutController(options) {
    const form = options.form;
    const apiOrigin = options.apiOrigin || window.location.origin;
    let layout = normalizeLayout(DEFAULT_LAYOUT);
    let editorStarted = false;
    let statusElement = null;
    let saveTimer = 0;
    const editorBoxes = new Map();

    function setStatus(message, error) {
      if (!statusElement) return;
      statusElement.textContent = message;
      statusElement.style.color = error ? "#ffd1d8" : "#fff";
    }

    function renderEditorBoxes() {
      editorBoxes.forEach((box, key) => {
        const value = layout[key];
        box.style.top = `${value.top}%`;
        box.style.left = `${value.left}%`;
        box.style.width = `${value.width}%`;
        box.style.height = `${value.height}%`;
        box.style.transform = ROTATIONS[key] ? `rotate(${ROTATIONS[key]}deg)` : "none";
      });
    }

    function update(nextLayout) {
      layout = applyLayout(form, nextLayout);
      renderEditorBoxes();
    }

    async function load() {
      try {
        const response = await fetch(`${apiOrigin}/api/invitation-layout`, { cache: "no-store" });
        if (!response.ok) throw new Error("Layout unavailable");
        const result = await response.json();
        update(result.layout);
      } catch {
        update(DEFAULT_LAYOUT);
      }
      return layout;
    }

    async function persist() {
      window.clearTimeout(saveTimer);
      setStatus("Saving…", false);
      try {
        const response = await fetch("/api/admin/layout", {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ layout }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not save");
        update(result.layout);
        setStatus("Saved", false);
      } catch {
        setStatus("Not saved — sign in again", true);
      }
    }

    function scheduleSave() {
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(() => { void persist(); }, 260);
    }

    function beginPointerEdit(event, key, handle, box) {
      if (event.button !== undefined && event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      editorBoxes.forEach((candidate) => candidate.classList.remove("is-active"));
      box.classList.add("is-active");
      box.focus({ preventScroll: true });

      const start = { ...layout[key] };
      const formBounds = form.getBoundingClientRect();
      const startX = event.clientX;
      const startY = event.clientY;
      const angle = (ROTATIONS[key] || 0) * Math.PI / 180;
      const cosine = Math.cos(angle);
      const sine = Math.sin(angle);

      function move(moveEvent) {
        moveEvent.preventDefault();
        const pixelX = moveEvent.clientX - startX;
        const pixelY = moveEvent.clientY - startY;
        const next = { ...start };

        if (!handle) {
          next.left = start.left + pixelX / formBounds.width * 100;
          next.top = start.top + pixelY / formBounds.height * 100;
        } else {
          const localX = pixelX * cosine + pixelY * sine;
          const localY = -pixelX * sine + pixelY * cosine;
          const widthDelta = localX / formBounds.width * 100;
          const heightDelta = localY / formBounds.height * 100;
          if (handle.includes("e")) next.width = start.width + widthDelta;
          if (handle.includes("s")) next.height = start.height + heightDelta;
          if (handle.includes("w")) {
            next.left = start.left + widthDelta;
            next.width = start.width - widthDelta;
          }
          if (handle.includes("n")) {
            next.top = start.top + heightDelta;
            next.height = start.height - heightDelta;
          }
        }

        update({ ...layout, [key]: next });
        setStatus("Unsaved changes", false);
      }

      function end() {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", end);
        window.removeEventListener("pointercancel", end);
        void persist();
      }

      window.addEventListener("pointermove", move, { passive: false });
      window.addEventListener("pointerup", end);
      window.addEventListener("pointercancel", end);
    }

    function createEditorBox(key) {
      const box = document.createElement("div");
      box.className = "rsvp-layout-editor-box";
      box.dataset.key = key;
      box.tabIndex = 0;
      box.setAttribute("role", "button");
      box.setAttribute("aria-label", `Move or resize ${LABELS[key]}`);

      const label = document.createElement("span");
      label.className = "rsvp-layout-editor-label";
      label.textContent = LABELS[key];
      box.append(label);

      ["nw", "ne", "sw", "se"].forEach((handleName) => {
        const handle = document.createElement("button");
        handle.type = "button";
        handle.className = "rsvp-layout-editor-handle";
        handle.dataset.handle = handleName;
        handle.setAttribute("aria-label", `Resize ${LABELS[key]} from ${handleName.toUpperCase()}`);
        handle.addEventListener("pointerdown", (event) => beginPointerEdit(event, key, handleName, box));
        box.append(handle);
      });

      box.addEventListener("pointerdown", (event) => {
        if (event.target.closest("[data-handle]")) return;
        beginPointerEdit(event, key, "", box);
      });
      box.addEventListener("keydown", (event) => {
        const amount = event.shiftKey ? 0.5 : 0.12;
        const next = { ...layout[key] };
        if (event.key === "ArrowUp") next.top -= amount;
        else if (event.key === "ArrowDown") next.top += amount;
        else if (event.key === "ArrowLeft") next.left -= amount;
        else if (event.key === "ArrowRight") next.left += amount;
        else return;
        event.preventDefault();
        update({ ...layout, [key]: next });
        setStatus("Unsaved changes", false);
        scheduleSave();
      });
      form.append(box);
      editorBoxes.set(key, box);
    }

    function startEditor() {
      if (editorStarted) return;
      editorStarted = true;
      document.body.classList.add("layout-editor-active");
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
      }, true);

      const toolbar = document.createElement("div");
      toolbar.className = "rsvp-layout-editor-toolbar";
      statusElement = document.createElement("span");
      statusElement.textContent = "Drag a box or pull a corner";
      const reset = document.createElement("button");
      reset.type = "button";
      reset.textContent = "Reset";
      reset.addEventListener("click", () => {
        if (!window.confirm("Reset all RSVP controls to their original positions?")) return;
        update(DEFAULT_LAYOUT);
        void persist();
      });
      toolbar.append(statusElement, reset);
      document.body.append(toolbar);

      KEYS.forEach(createEditorBox);
      renderEditorBoxes();
    }

    update(DEFAULT_LAYOUT);
    return { load, startEditor, getLayout: () => layout };
  }

  window.InvitezLayout = { createRsvpLayoutController, DEFAULT_RSVP_LAYOUT: DEFAULT_LAYOUT };
})();
