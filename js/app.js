const STORAGE_KEY = "lechemin_waypoints_v1";

const SAMPLE_STAGES = [
  { city: "Bangkok", countryCode: "TH", lat: 13.7563, lng: 100.5018, date: "2024-01-05", note: "Arrivée en Asie, premiers pas dans le chaos joyeux de Bangkok.", photo: "" },
  { city: "Chiang Mai", countryCode: "TH", lat: 18.7883, lng: 98.9853, date: "2024-01-14", note: "Temples dans la montagne et marché de nuit.", photo: "" },
  { city: "Luang Prabang", countryCode: "LA", lat: 19.8845, lng: 102.1348, date: "2024-01-25", note: "Cérémonie des moines au lever du jour.", photo: "" },
  { city: "Hanoï", countryCode: "VN", lat: 21.0278, lng: 105.8342, date: "2024-02-03", note: "Vieux quartier et café à l'œuf.", photo: "" },
  { city: "Baie d'Ha Long", countryCode: "VN", lat: 20.9101, lng: 107.1839, date: "2024-02-08", note: "Nuit sur un bateau au milieu des rochers karstiques.", photo: "" },
  { city: "Siem Reap", countryCode: "KH", lat: 13.3671, lng: 103.8448, date: "2024-02-18", note: "Lever de soleil sur Angkor Wat.", photo: "" },
  { city: "Tokyo", countryCode: "JP", lat: 35.6762, lng: 139.6503, date: "2024-03-10", note: "Dernière étape, entre néons et sanctuaires.", photo: "" },
];

let map;
let markers = new Map(); // id -> L.Marker
let pathLine = null;
let showPath = true;
let editingId = null;
let pendingLatLng = null;

function loadStages() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn("Impossible de lire les étapes sauvegardées", e);
  }
  const seeded = SAMPLE_STAGES.map((s) => ({ id: crypto.randomUUID(), ...s }));
  saveStages(seeded);
  return seeded;
}

function saveStages(stages) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stages));
}

let stages = loadStages();

function getCountry(code) {
  return COUNTRIES.find((c) => c.code === code) || { code, name: code, flag: "🏳️" };
}

function sortedStages() {
  return [...stages].sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date.localeCompare(b.date);
  });
}

function flagDivIcon(flagEmoji) {
  return L.divIcon({
    className: "",
    html: `<div class="flag-pin"><div class="pin-shape"></div><div class="pin-emoji">${flagEmoji}</div></div>`,
    iconSize: [34, 42],
    iconAnchor: [17, 42],
    popupAnchor: [0, -38],
  });
}

function popupHtml(stage) {
  const country = getCountry(stage.countryCode);
  const dateStr = stage.date
    ? new Date(stage.date + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : "Date inconnue";
  const photo = stage.photo ? `<img class="popup-photo" src="${escapeHtml(stage.photo)}" alt="${escapeHtml(stage.city)}" />` : "";
  const note = stage.note ? `<div class="popup-note">${escapeHtml(stage.note)}</div>` : "";
  return `
    <div class="popup-title">${country.flag} ${escapeHtml(stage.city)}</div>
    <div class="popup-country">${escapeHtml(country.name)}</div>
    <div class="popup-date">${dateStr}</div>
    ${photo}
    ${note}
    <button class="popup-edit" data-edit-id="${stage.id}">Modifier</button>
  `;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function renderMarkers() {
  markers.forEach((m) => map.removeLayer(m));
  markers.clear();

  stages.forEach((stage) => {
    const country = getCountry(stage.countryCode);
    const marker = L.marker([stage.lat, stage.lng], { icon: flagDivIcon(country.flag) }).addTo(map);
    marker.bindPopup(popupHtml(stage));
    marker.on("popupopen", (e) => {
      const btn = e.popup.getElement().querySelector("[data-edit-id]");
      if (btn) btn.addEventListener("click", () => openModal(stage.id));
    });
    markers.set(stage.id, marker);
  });

  renderPath();
}

function renderPath() {
  if (pathLine) {
    map.removeLayer(pathLine);
    pathLine = null;
  }
  if (!showPath) return;
  const ordered = sortedStages();
  if (ordered.length < 2) return;
  const latlngs = ordered.map((s) => [s.lat, s.lng]);
  pathLine = L.polyline(latlngs, {
    color: "#ff6b4a",
    weight: 2,
    dashArray: "6 8",
    opacity: 0.8,
  }).addTo(map);
}

function renderSidebar() {
  const list = document.getElementById("stage-list");
  const ordered = sortedStages();
  document.getElementById("stage-count").textContent =
    ordered.length + (ordered.length > 1 ? " étapes" : " étape");

  if (ordered.length === 0) {
    list.innerHTML = `<div class="empty-state">Aucune étape pour l'instant.<br/>Cliquez sur la carte ou recherchez une ville pour commencer votre chemin.</div>`;
    return;
  }

  list.innerHTML = "";
  ordered.forEach((stage, idx) => {
    const country = getCountry(stage.countryCode);
    const li = document.createElement("li");
    li.className = "stage-item";
    const dateStr = stage.date
      ? new Date(stage.date + "T00:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
      : "";
    li.innerHTML = `
      <span class="stage-index">${idx + 1}</span>
      <span class="stage-flag">${country.flag}</span>
      <div class="stage-info">
        <div class="stage-city">${escapeHtml(stage.city)}</div>
        <div class="stage-country">${escapeHtml(country.name)}</div>
        ${dateStr ? `<div class="stage-date">${dateStr}</div>` : ""}
        ${stage.note ? `<div class="stage-note">${escapeHtml(stage.note)}</div>` : ""}
      </div>
    `;
    li.addEventListener("click", () => {
      map.flyTo([stage.lat, stage.lng], 10, { duration: 0.6 });
      const marker = markers.get(stage.id);
      if (marker) marker.openPopup();
    });
    list.appendChild(li);
  });
}

function refreshAll() {
  saveStages(stages);
  renderMarkers();
  renderSidebar();
}

// ---------- Modale d'ajout / édition ----------

function populateCountrySelect() {
  const select = document.getElementById("field-country");
  select.innerHTML = COUNTRIES.map(
    (c) => `<option value="${c.code}">${c.flag} ${c.name}</option>`
  ).join("");
}

function openModal(stageId, latlng) {
  editingId = stageId || null;
  pendingLatLng = latlng || null;
  const form = document.getElementById("stage-form");
  form.reset();
  document.getElementById("btn-delete-stage").classList.toggle("hidden", !editingId);

  if (editingId) {
    const stage = stages.find((s) => s.id === editingId);
    document.getElementById("modal-title").textContent = "Modifier l'étape";
    document.getElementById("field-city").value = stage.city;
    document.getElementById("field-country").value = stage.countryCode;
    document.getElementById("field-date").value = stage.date || "";
    document.getElementById("field-note").value = stage.note || "";
    document.getElementById("field-photo").value = stage.photo || "";
  } else {
    document.getElementById("modal-title").textContent = "Ajouter une étape";
    document.getElementById("field-country").value = "TH";
  }

  document.getElementById("modal-overlay").classList.remove("hidden");
  document.getElementById("field-city").focus();
}

function closeModal() {
  document.getElementById("modal-overlay").classList.add("hidden");
  editingId = null;
  pendingLatLng = null;
}

function handleFormSubmit(e) {
  e.preventDefault();
  const city = document.getElementById("field-city").value.trim();
  const countryCode = document.getElementById("field-country").value;
  const date = document.getElementById("field-date").value;
  const note = document.getElementById("field-note").value.trim();
  const photo = document.getElementById("field-photo").value.trim();
  if (!city) return;

  if (editingId) {
    const stage = stages.find((s) => s.id === editingId);
    Object.assign(stage, { city, countryCode, date, note, photo });
  } else {
    const latlng = pendingLatLng || map.getCenter();
    stages.push({
      id: crypto.randomUUID(),
      city,
      countryCode,
      date,
      note,
      photo,
      lat: latlng.lat,
      lng: latlng.lng,
    });
  }
  closeModal();
  refreshAll();
}

function handleDeleteStage() {
  if (!editingId) return;
  if (!confirm("Supprimer cette étape du chemin ?")) return;
  stages = stages.filter((s) => s.id !== editingId);
  closeModal();
  refreshAll();
}

// ---------- Recherche de ville (Nominatim / OpenStreetMap) ----------

let searchTimeout = null;
let searchResultsData = [];

async function searchCity(query) {
  if (!query || query.length < 2) {
    document.getElementById("search-results").classList.add("hidden");
    return;
  }
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    const data = await res.json();
    searchResultsData = data;
    renderSearchResults(data);
  } catch (err) {
    console.warn("Recherche indisponible", err);
  }
}

function renderSearchResults(results) {
  const ul = document.getElementById("search-results");
  if (!results.length) {
    ul.classList.add("hidden");
    ul.innerHTML = "";
    return;
  }
  ul.innerHTML = results
    .map((r, i) => `<li data-idx="${i}">${escapeHtml(r.display_name)}</li>`)
    .join("");
  ul.classList.remove("hidden");
  ul.querySelectorAll("li").forEach((li) => {
    li.addEventListener("click", () => {
      const r = searchResultsData[li.dataset.idx];
      const latlng = { lat: parseFloat(r.lat), lng: parseFloat(r.lon) };
      map.flyTo([latlng.lat, latlng.lng], 9, { duration: 0.6 });
      ul.classList.add("hidden");
      document.getElementById("city-search").value = "";
      const cityGuess = (r.address && (r.address.city || r.address.town || r.address.village || r.address.state)) || r.display_name.split(",")[0];
      openModal(null, latlng);
      document.getElementById("field-city").value = cityGuess;
      const countryName = r.address && r.address.country;
      const match = COUNTRIES.find((c) => c.name.toLowerCase() === (countryName || "").toLowerCase());
      if (match) document.getElementById("field-country").value = match.code;
    });
  });
}

// ---------- Export / Import ----------

function exportStages() {
  const blob = new Blob([JSON.stringify(stages, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "le-chemin.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

function importStages(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data)) throw new Error("Format invalide");
      stages = data.map((s) => ({ id: s.id || crypto.randomUUID(), ...s }));
      refreshAll();
      if (stages.length) {
        const last = stages[stages.length - 1];
        map.flyTo([last.lat, last.lng], 6);
      }
    } catch (err) {
      alert("Fichier JSON invalide.");
    }
  };
  reader.readAsText(file);
}

// ---------- Initialisation ----------

function initMap() {
  map = L.map("map", { worldCopyJump: true }).setView([20, 100], 4);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 19,
  }).addTo(map);

  map.on("click", (e) => {
    openModal(null, e.latlng);
  });
}

function initEvents() {
  document.getElementById("stage-form").addEventListener("submit", handleFormSubmit);
  document.getElementById("btn-cancel").addEventListener("click", closeModal);
  document.getElementById("btn-delete-stage").addEventListener("click", handleDeleteStage);
  document.getElementById("modal-overlay").addEventListener("click", (e) => {
    if (e.target.id === "modal-overlay") closeModal();
  });

  document.getElementById("btn-toggle-path").addEventListener("click", () => {
    showPath = !showPath;
    renderPath();
  });

  document.getElementById("btn-export").addEventListener("click", exportStages);
  document.getElementById("btn-import").addEventListener("click", () =>
    document.getElementById("import-file").click()
  );
  document.getElementById("import-file").addEventListener("change", (e) => {
    if (e.target.files[0]) importStages(e.target.files[0]);
    e.target.value = "";
  });
  document.getElementById("btn-clear").addEventListener("click", () => {
    if (!confirm("Supprimer toutes les étapes du chemin ? Cette action est irréversible.")) return;
    stages = [];
    refreshAll();
  });

  const searchInput = document.getElementById("city-search");
  searchInput.addEventListener("input", (e) => {
    clearTimeout(searchTimeout);
    const q = e.target.value;
    searchTimeout = setTimeout(() => searchCity(q), 350);
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-box")) {
      document.getElementById("search-results").classList.add("hidden");
    }
  });
}

populateCountrySelect();
initMap();
initEvents();
refreshAll();
