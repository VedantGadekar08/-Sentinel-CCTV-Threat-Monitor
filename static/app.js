const $ = (id) => document.getElementById(id);
const esc = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );

async function request(url, options = {}) {
  let response;
  try {
    const apiOrigin =
      location.protocol === "file:" ? "http://127.0.0.1:8000" : "";
    response = await fetch(`${apiOrigin}${url}`, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
  } catch {
    const help =
      location.protocol === "file:"
        ? " You opened the HTML file directly; use the local server link shown on the page."
        : " Start the backend and open http://127.0.0.1:8000.";
    setConnection(false, help);
    throw new Error(`Cannot reach the project API.${help}`);
  }
  if (!response.ok) {
    setConnection(true);
    const body = await response
      .clone()
      .json()
      .catch(async () => ({ detail: await response.text() }));
    throw new Error(
      `${body.detail || body.message || response.statusText || "Request failed"} (HTTP ${response.status})`,
    );
  }
  setConnection(true);
  return response.status === 204 ? null : response.json();
}

function setConnection(online, help = "") {
  const status = $("backend-status");
  const banner = $("connection-alert");
  if (!status || !banner) return;
  status.innerHTML = online
    ? "<i></i> Server connected"
    : "<i></i> Server disconnected";
  status.classList.toggle("offline", !online);
  $("rail-dot").classList.toggle("offline", !online);
  $("rail-status").textContent = online
    ? "Java API connected"
    : "API unavailable";
  banner.hidden = online;
  if (help) $("connection-help").textContent = help.trim();
}

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 3200);
}

function time(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function safeSource(value) {
  return String(value).replace(
    /([a-z][a-z0-9+.-]*:\/\/)([^/@]+)@/i,
    "$1••••••@",
  );
}

let cameraCache = [];
let incidentCache = [];
let refreshVersion = 0;
async function refresh() {
  const version = ++refreshVersion;
  const [cameras, incidents] = await Promise.all([
    request("/api/cameras"),
    request("/api/incidents"),
  ]);
  if (version !== refreshVersion) return;
  cameraCache = cameras;
  incidentCache = incidents;
  $("camera-total").textContent = cameras.length;
  $("pending-total").textContent = incidents.filter(
    (x) => x.status === "pending",
  ).length;
  $("confirmed-total").textContent = incidents.filter(
    (x) =>
      x.status === "confirmed" &&
      new Date(x.created_at).toDateString() === new Date().toDateString(),
  ).length;
  $("nav-count").textContent = incidents.filter(
    (x) => x.status === "pending",
  ).length;
  $("incident-count").textContent =
    `${incidents.length} EVENT${incidents.length === 1 ? "" : "S"}`;

  renderIncidents();

  $("camera-list").innerHTML = cameras.length
    ? cameras
        .map(
          (c) => `
    <div class="camera-item">
      <div class="camera-copy"><span class="camera-symbol">▣</span><div><b>${esc(c.name)}</b><small title="${esc(safeSource(c.source))}">${esc(safeSource(c.source))}</small></div></div>
      <button class="remove" title="Remove ${esc(c.name)}" aria-label="Remove ${esc(c.name)}" data-camera="${c.id}">×</button>
    </div>`,
        )
        .join("")
    : '<div class="camera-empty"><span>▣</span><b>No sources yet</b><p>Add a camera source to associate it with demo alerts.</p></div>';

  const selectedCamera = $("alert-camera").value;
  $("alert-camera").innerHTML =
    '<option value="">Demo source (unassigned)</option>' +
    cameras
      .map((c) => `<option value="${c.id}">${esc(c.name)}</option>`)
      .join("");
  if (cameras.some((c) => String(c.id) === selectedCamera))
    $("alert-camera").value = selectedCamera;
}

function renderIncidents() {
  const query = $("incident-search").value.trim().toLocaleLowerCase();
  const filter = $("incident-filter").value;
  const visible = incidentCache.filter(
    (x) =>
      (filter === "all" || x.status === filter) &&
      (!query ||
        `${x.category} ${x.camera_name} ${x.status}`
          .toLocaleLowerCase()
          .includes(query)),
  );
  $("empty-incidents").style.display = visible.length ? "none" : "block";
  $("empty-incidents").querySelector("p").textContent = incidentCache.length
    ? "No incidents match your search or filter."
    : "Create a demo alert to explore the review workflow.";
  $("incident-rows").innerHTML = visible
    .map(
      (x) => `
    <tr>
      <td data-label="Event"><span class="event-dot"></span>${esc(x.category)}</td>
      <td data-label="Camera">${esc(x.camera_name)}</td>
      <td data-label="Time">${time(x.created_at)}</td>
      <td data-label="Status"><span class="tag ${x.status === "confirmed" ? "tag-green" : x.status === "false_alarm" ? "tag-gray" : ""}">${esc(x.status.replace("_", " "))}</span></td>
      <td data-label="Review" class="review-cell">${
        x.status === "pending"
          ? `<button class="review-btn confirm-btn" data-id="${x.id}" data-status="confirmed">Confirm</button><button class="review-btn false-btn" data-id="${x.id}" data-status="false_alarm">False alarm</button>`
          : '<span class="reviewed-label">Reviewed</span>'
      }</td>
    </tr>`,
    )
    .join("");
}

async function withBusy(button, pendingLabel, action) {
  if (button.disabled) return;
  const oldLabel = button.textContent;
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  button.textContent = pendingLabel;
  try {
    await action();
  } finally {
    button.disabled = false;
    button.removeAttribute("aria-busy");
    button.textContent = oldLabel;
  }
}

function openDialog() {
  $("alert-dialog").showModal();
}
function closeDialog() {
  $("alert-dialog").close();
}

$("camera-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('[type="submit"]');
  const data = Object.fromEntries(new FormData(form));
  try {
    await withBusy(button, "Saving…", async () => {
      await request("/api/cameras", {
        method: "POST",
        body: JSON.stringify(data),
      });
      form.reset();
      await refresh();
    });
    toast("Camera source registered");
  } catch (error) {
    toast(error.message);
  }
});

$("demo-alert").addEventListener("click", openDialog);
$("close-dialog").addEventListener("click", closeDialog);
$("cancel-dialog").addEventListener("click", closeDialog);
$("alert-dialog").addEventListener("click", (event) => {
  if (event.target === $("alert-dialog")) closeDialog();
});
$("alert-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('[type="submit"]');
  const values = Object.fromEntries(new FormData(form));
  const camera_id = values.camera_id ? Number(values.camera_id) : null;
  try {
    await withBusy(button, "Creating…", async () => {
      await request("/api/incidents", {
        method: "POST",
        body: JSON.stringify({ category: values.category, camera_id }),
      });
      closeDialog();
      await refresh();
    });
    toast("Sample alert added to the review queue");
  } catch (error) {
    toast(error.message);
  }
});

$("incident-filter").addEventListener("change", renderIncidents);
$("incident-search").addEventListener("input", renderIncidents);
$("run-demo").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  try {
    await withBusy(button, "Preparing demo…", async () => {
      await request("/api/incidents/demo", { method: "POST" });
      $("incident-filter").value = "all";
      await refresh();
      location.hash = "#incidents";
    });
    toast("3 sample alerts are ready for review.");
  } catch (error) {
    toast(error.message);
  }
});

document.addEventListener("click", async (event) => {
  const reviewButton = event.target.closest("[data-id][data-status]");
  if (reviewButton) {
    const row = reviewButton.closest("tr");
    row?.querySelectorAll("button").forEach((button) => {
      button.disabled = true;
    });
    try {
      await request(
        `/api/incidents/${reviewButton.dataset.id}?status=${reviewButton.dataset.status}`,
        { method: "PATCH" },
      );
      await refresh();
      toast(
        reviewButton.dataset.status === "confirmed"
          ? "Incident confirmed"
          : "Marked as false alarm",
      );
    } catch (error) {
      if (row?.isConnected)
        row.querySelectorAll("button").forEach((button) => {
          button.disabled = false;
        });
      toast(error.message);
    }
    return;
  }

  const removeButton = event.target.closest("[data-camera]");
  if (removeButton) {
    const entry = cameraCache.find(
      (camera) => String(camera.id) === removeButton.dataset.camera,
    );
    if (!confirm(`Remove camera source “${entry?.name ?? "this source"}”?`))
      return;
    removeButton.disabled = true;
    try {
      await request(`/api/cameras/${removeButton.dataset.camera}`, {
        method: "DELETE",
      });
      await refresh();
      toast("Camera source removed");
    } catch (error) {
      removeButton.disabled = false;
      toast(error.message);
    }
  }
});

function updateNavigation() {
  const hash = location.hash || "#overview";
  document
    .querySelectorAll(".nav")
    .forEach((link) =>
      link.classList.toggle("active", link.getAttribute("href") === hash),
    );
}
window.addEventListener("hashchange", updateNavigation);
function showGuide() {
  location.hash = "#demo-guide";
  $("demo-guide").scrollIntoView({ behavior: "smooth", block: "start" });
}
$("open-guide").addEventListener("click", showGuide);
document
  .querySelector('.nav[href="#demo-guide"]')
  .addEventListener("click", () => setTimeout(showGuide, 0));
$("retry-connection").addEventListener("click", () =>
  refresh()
    .then(() => toast("Connected to the project server"))
    .catch((error) => toast(error.message)),
);

updateNavigation();
refresh().catch((error) => toast(`Could not load dashboard: ${error.message}`));
