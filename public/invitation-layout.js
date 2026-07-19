(function () {
  "use strict";

  const KEYS = ["name", "adults", "kids", "notes", "yes", "no", "submit", "countdown"];
  const DEFAULT_LAYOUT = {
    name: { top: 74.1, left: 11.5, width: 42, height: 1.65, rotation: -15, fill: "transparent" },
    adults: { top: 76.2, left: 38.6, width: 14, height: 1.15, rotation: -15, fill: "transparent" },
    kids: { top: 77.45, left: 40, width: 14, height: 1.15, rotation: -15, fill: "transparent" },
    notes: { top: 74, left: 57, width: 41, height: 2.8, rotation: -15, fill: "transparent" },
    yes: { top: 73.6, left: 55.8, width: 6.7, height: 1.2, rotation: 0 },
    no: { top: 72.12, left: 77.5, width: 6.7, height: 1.2, rotation: 0 },
    submit: { top: 75.15, left: 77, width: 20, height: 1.9, rotation: -15, fill: "transparent" },
    countdown: { top: 92, left: 5.97, width: 80, height: 8, rotation: 0 },
  };
  const MINIMUM_SIZE = {
    name: { width: 8, height: 0.7 },
    adults: { width: 5, height: 0.7 },
    kids: { width: 5, height: 0.7 },
    notes: { width: 8, height: 0.7 },
    yes: { width: 3, height: 0.55 },
    no: { width: 3, height: 0.55 },
    submit: { width: 5, height: 0.7 },
    countdown: { width: 25, height: 4 },
  };
  const MAXIMUM_HEIGHT = { name: 18, adults: 18, kids: 18, notes: 18, yes: 18, no: 18, submit: 18, countdown: 14 };
  const LABELS = { name: "Name", adults: "Adults", kids: "Kids", notes: "Additional info", yes: "Yes", no: "No", submit: "Submit", countdown: "Countdown card" };

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
    const usesPreviousCardLayout = !input.adults && !input.kids;
    const legacyTransparent = input.name?.fill === "transparent" && input.notes?.fill === "transparent";
    return Object.fromEntries(KEYS.map((key) => {
      const fallback = DEFAULT_LAYOUT[key];
      const candidate = usesPreviousCardLayout && key !== "countdown"
        ? {}
        : input[key] && typeof input[key] === "object" ? input[key] : {};
      const usesPreviousCountdownDefault = key === "countdown"
        && [83.614, 84.614, 89.5, 90.25, 91.25].includes(number(candidate.top, Number.NaN))
        && (number(candidate.left, Number.NaN) === 4.61 || number(candidate.left, Number.NaN) === 10 || number(candidate.left, Number.NaN) === 11.36)
        && number(candidate.width, Number.NaN) === 80
        && number(candidate.height, Number.NaN) === 8;
      const source = usesPreviousCountdownDefault ? {} : candidate;
      const rawHeight = number(source.height, fallback.height);
      const height = key === "countdown" && rawHeight > MAXIMUM_HEIGHT[key] ? fallback.height : rawHeight;
      const box = {
        top: rounded(clamp(number(source.top, fallback.top), 0, 98.5)),
        left: rounded(clamp(number(source.left, fallback.left), -10, 105)),
        width: rounded(clamp(number(source.width, fallback.width), MINIMUM_SIZE[key].width, 110)),
        height: rounded(clamp(height, MINIMUM_SIZE[key].height, MAXIMUM_HEIGHT[key])),
        rotation: rounded(clamp(number(source.rotation, fallback.rotation), -45, 45)),
      };
      if (key === "name" || key === "adults" || key === "kids" || key === "notes" || key === "submit") {
        box.fill = source.fill === "transparent"
          || (source.fill === undefined && fallback.fill === "transparent")
          || (key === "submit" && source.fill === undefined && legacyTransparent)
          ? "transparent"
          : "yellow";
      }
      return [key, box];
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
      form.style.setProperty(`--rsvp-${key}-rotation`, `${box.rotation}deg`);
      if (key === "name" || key === "adults" || key === "kids" || key === "notes" || key === "submit") {
        const transparent = box.fill === "transparent";
        form.style.setProperty(`--rsvp-${key}-background`, transparent ? "transparent" : "rgba(255, 212, 0, 0.58)");
        form.style.setProperty(`--rsvp-${key}-border`, transparent ? "transparent" : "#ffd400");
        form.style.setProperty(`--rsvp-${key}-shadow`, transparent ? "none" : "0 0 0 2px rgba(255, 255, 255, 0.72)");
        form.style.setProperty(`--rsvp-${key}-focus-background`, transparent ? "rgba(255, 255, 255, 0.18)" : "rgba(255, 226, 70, 0.76)");
        form.style.setProperty(`--rsvp-${key}-focus-border`, transparent ? "rgba(36, 59, 49, 0.58)" : "#ffb000");
        form.style.setProperty(`--rsvp-${key}-focus-shadow`, transparent ? "0 0 0 2px rgba(255, 255, 255, 0.65)" : "0 0 0 3px rgba(255, 176, 0, 0.32)");
      }
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
    const fillButtons = new Map();

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
        box.style.transform = value.rotation ? `rotate(${value.rotation}deg)` : "none";
      });
      fillButtons.forEach((button, fill) => {
        const selected = layout.name.fill === fill && layout.adults.fill === fill && layout.kids.fill === fill && layout.notes.fill === fill && layout.submit.fill === fill;
        button.classList.toggle("is-active", selected);
        button.setAttribute("aria-pressed", String(selected));
      });
    }

    const countdown = options.countdown || null;

    function update(nextLayout) {
      layout = applyLayout(form, nextLayout);
      if (countdown) applyLayout(countdown, nextLayout);
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

    function setControlFill(fill) {
      update({
        ...layout,
        name: { ...layout.name, fill },
        adults: { ...layout.adults, fill },
        kids: { ...layout.kids, fill },
        notes: { ...layout.notes, fill },
        submit: { ...layout.submit, fill },
      });
      setStatus(fill === "transparent" ? "Fields and Submit are transparent" : "Fields and Submit are yellow", false);
      void persist();
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
      const angle = start.rotation * Math.PI / 180;
      const cosine = Math.cos(angle);
      const sine = Math.sin(angle);
      const centerX = formBounds.left + (start.left + start.width / 2) / 100 * formBounds.width;
      const centerY = formBounds.top + (start.top + start.height / 2) / 100 * formBounds.height;
      const startPointerAngle = Math.atan2(startY - centerY, startX - centerX);

      function move(moveEvent) {
        moveEvent.preventDefault();
        const pixelX = moveEvent.clientX - startX;
        const pixelY = moveEvent.clientY - startY;
        const next = { ...start };

        if (handle === "rotate") {
          const pointerAngle = Math.atan2(moveEvent.clientY - centerY, moveEvent.clientX - centerX);
          const rotationDelta = (pointerAngle - startPointerAngle) * 180 / Math.PI;
          next.rotation = start.rotation + rotationDelta;
          if (moveEvent.shiftKey) next.rotation = Math.round(next.rotation / 5) * 5;
        } else if (!handle) {
          next.left = start.left + pixelX / formBounds.width * 100;
          next.top = start.top + pixelY / formBounds.height * 100;
        } else {
          const localX = pixelX * cosine + pixelY * sine;
          const localY = -pixelX * sine + pixelY * cosine;
          const widthDelta = localX / formBounds.width * 100;
          const heightDelta = localY / formBounds.height * 100;
          if (handle.includes("e")) next.width = clamp(start.width + widthDelta, MINIMUM_SIZE[key].width, 110);
          if (handle.includes("w")) next.width = clamp(start.width - widthDelta, MINIMUM_SIZE[key].width, 110);
          if (handle.includes("s")) next.height = clamp(start.height + heightDelta, MINIMUM_SIZE[key].height, 18);
          if (handle.includes("n")) next.height = clamp(start.height - heightDelta, MINIMUM_SIZE[key].height, 18);

          const localCenterShiftX = handle.includes("e")
            ? (next.width - start.width) / 2
            : handle.includes("w") ? -(next.width - start.width) / 2 : 0;
          const localCenterShiftY = handle.includes("s")
            ? (next.height - start.height) / 2
            : handle.includes("n") ? -(next.height - start.height) / 2 : 0;
          const localCenterShiftXpx = localCenterShiftX / 100 * formBounds.width;
          const localCenterShiftYpx = localCenterShiftY / 100 * formBounds.height;
          const globalCenterShiftXpx = localCenterShiftXpx * cosine - localCenterShiftYpx * sine;
          const globalCenterShiftYpx = localCenterShiftXpx * sine + localCenterShiftYpx * cosine;
          const centerPercentX = start.left + start.width / 2 + globalCenterShiftXpx / formBounds.width * 100;
          const centerPercentY = start.top + start.height / 2 + globalCenterShiftYpx / formBounds.height * 100;
          next.left = centerPercentX - next.width / 2;
          next.top = centerPercentY - next.height / 2;
        }

        update({ ...layout, [key]: next });
        setStatus(handle === "rotate" ? `Angle ${layout[key].rotation.toFixed(1)}°` : "Unsaved changes", false);
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
      box.setAttribute("aria-label", `Move, resize, or rotate ${LABELS[key]}`);

      const label = document.createElement("span");
      label.className = "rsvp-layout-editor-label";
      label.textContent = LABELS[key];
      box.append(label);

      ["nw", "n", "ne", "e", "se", "s", "sw", "w", "rotate"].forEach((handleName) => {
        const handle = document.createElement("button");
        handle.type = "button";
        handle.className = "rsvp-layout-editor-handle";
        handle.dataset.handle = handleName;
        handle.setAttribute("aria-label", handleName === "rotate"
          ? `Rotate ${LABELS[key]}`
          : `Resize ${LABELS[key]} from ${handleName.toUpperCase()}`);
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
      statusElement.className = "rsvp-layout-editor-status";
      statusElement.textContent = "Move, resize from any edge, or rotate";
      const fillPicker = document.createElement("div");
      fillPicker.className = "rsvp-layout-fill-picker";
      fillPicker.setAttribute("role", "group");
      fillPicker.setAttribute("aria-label", "Fields and Submit appearance");
      [["yellow", "Yellow"], ["transparent", "Transparent"]].forEach(([fill, label]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.addEventListener("click", () => setControlFill(fill));
        fillPicker.append(button);
        fillButtons.set(fill, button);
      });
      const reset = document.createElement("button");
      reset.type = "button";
      reset.textContent = "Reset";
      reset.addEventListener("click", () => {
        if (!window.confirm("Reset all RSVP controls to their original positions?")) return;
        update(DEFAULT_LAYOUT);
        void persist();
      });
      toolbar.append(statusElement, fillPicker, reset);
      document.body.append(toolbar);

      KEYS.forEach(createEditorBox);
      renderEditorBoxes();
    }

    update(DEFAULT_LAYOUT);
    return { load, startEditor, getLayout: () => layout };
  }

  window.InvitezLayout = { createRsvpLayoutController, DEFAULT_RSVP_LAYOUT: DEFAULT_LAYOUT };
})();
