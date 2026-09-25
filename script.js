import { Decoder, Stream } from 'https://cdn.jsdelivr.net/npm/@garmin/fitsdk@21.141.0/+esm';

const DELIMITER = "***";

let map;
let currentTrackLayer = null;
let activityDatabase = {}; 
let fitCache = {}; 

document.addEventListener("DOMContentLoaded", () => {
  map = L.map('map').setView([48.5376, 9.2842], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(map);

  loadData();
  initResizers();
});

function formatTime(seconds) {
  const numSec = Number(seconds);
  if (isNaN(numSec) || numSec <= 0) return "0:00:00";
  const hrs = Math.floor(numSec / 3600);
  const mins = Math.floor((numSec % 3600) / 60);
  const secs = Math.floor(numSec % 60);
  
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function normalizeTimeString(timeStr) {
  if (!timeStr || timeStr === '--' || timeStr === '--:--' || timeStr === '--:--:--') {
    return "0:00:00";
  }
  const parts = timeStr.split(':');
  if (parts.length === 2) {
    return `00:${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  } else if (parts.length === 3) {
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:${parts[2].padStart(2, '0')}`;
  }
  return timeStr;
}

function extractDateFromFilename(filename) {
  const match = filename.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return "--.--.--";
  const [, year, month, day] = match;
  return `${day}.${month}.${year.slice(-2)}`;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function semicirclesToDegrees(semicircles) {
  return semicircles * (180 / 2147483648);
}

function cssEscape(str) {
  return str.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function formatDecimal(val, decimals = 2) {
  if (val === null || val === undefined || val === '--') return val;
  const num = parseFloat(String(val).replace(',', '.'));
  if (isNaN(num)) return val;
  return num.toFixed(decimals).replace('.', ',');
}

function getBikeClass(bikeName) {
  const cleanName = (bikeName || "").trim().toLowerCase();
  if (cleanName === '#exceed') return 'bike-exceed';
  if (cleanName === '#terra') return 'bike-terra';
  if (cleanName === '#slx99') return 'bike-slx99';
  if (cleanName === '#c62o') return 'bike-c62o';
  return 'bike-default';
}

function renderStatsOnlyHtml(dist, ascent, time, speed, fileId) {
  const safeId = cssEscape(fileId);

  const distVal = dist !== '--' ? formatDecimal(dist, 2) : '--';
  const ascentVal = ascent !== '--' ? ascent : '--';
  
  let timeVal = "0:00:00";
  if (time && time !== '--') {
    if (!isNaN(time)) {
      timeVal = formatTime(Number(time));
    } else {
      timeVal = normalizeTimeString(time);
    }
  }

  const speedVal = speed !== '--' ? formatDecimal(speed, 1) : '--';

  return `
    <div class="stat-cell" id="dist-${safeId}" title="Distanz">
      <span class="stat-val">${distVal}</span>
      <span class="stat-unit">km</span>
    </div>
    <div class="stat-cell" id="ascent-${safeId}" title="Höhenmeter">
      <span class="stat-val">${ascentVal}</span>
      <span class="stat-unit">hm</span>
    </div>
    <div class="stat-cell" id="time-${safeId}" title="Fahrzeit">
      <span class="stat-val">${timeVal}</span>
      <span class="stat-unit">h</span>
    </div>
    <div class="stat-cell" id="speed-${safeId}" title="Durchschnittsgeschwindigkeit">
      <span class="stat-val">${speedVal}</span>
      <span class="stat-unit">km/h</span>
    </div>
  `;
}

async function loadData() {
  await loadCSVDatabase();
  await loadFileList();
}

async function loadCSVDatabase() {
  activityDatabase = {};
  try {
    const response = await fetch('fitdb.csv');
    if (!response.ok) return;

    const csvContent = await response.text();
    const lines = csvContent.split(/\r?\n/);

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      const cols = line.split(DELIMITER).map(col => col.trim().replace(/^"(.*)"$/, '$1'));
      const filename = cols[0];

      if (filename) {
        activityDatabase[filename] = {
          rad: cols[1] || "",
          name: cols[2] || "",
          dist: cols[3] || "",
          ascent: cols[4] || "",
          time: cols[5] || "",
          speed: cols[6] || ""
        };
      }
    }
  } catch (err) {
    console.warn("Keine fitdb.csv gefunden oder Fehler beim Laden.");
  }
}

async function loadFileList() {
  const status = document.getElementById("status");
  status.innerText = "Lade Dateiliste...";

  try {
    const response = await fetch('/api/files');
    if (!response.ok) throw new Error("Konnte Dateiliste nicht vom Server laden.");

    const fitFiles = await response.json();
    const list = document.getElementById("fitFileList");
    
    // Tabellenkopf als erstes Element einfügen (bleibt dank sticky oben fixiert)
    list.innerHTML = `
      <li class="file-list-header">
        <div>Datum</div>
        <div>#bike</div>
        <div>Aktivitätsname</div>
        <div></div>
        <div class="header-right">Distanz</div>
        <div class="header-right">Anstieg</div>
        <div class="header-right">Fahrzeit</div>
        <div class="header-right">Tempo</div>
      </li>
    `;

    status.innerText = `${fitFiles.length} Aktivitäten`;

    for (const fileName of fitFiles) {
      let dbEntry = activityDatabase[fileName] || { rad: "", name: "", dist: "", ascent: "", time: "", speed: "" };
      const displayName = dbEntry.name || fileName;
      const bikeName = dbEntry.rad || "#---";
      const displayDate = extractDateFromFilename(fileName);

      const li = document.createElement("li");
      const safeId = cssEscape(fileName);

      const hasCsvStats = dbEntry.dist && dbEntry.dist !== '--' &&
                          dbEntry.ascent && dbEntry.ascent !== '--' &&
                          dbEntry.time && dbEntry.time !== '--:--' && dbEntry.time !== '--:--:--' && dbEntry.time !== '--' &&
                          dbEntry.speed && dbEntry.speed !== '--';

      const displayBike = bikeName || "#---";
      const colorClass = getBikeClass(displayBike);
      const badgeHtml = `<div class="bike-badge ${colorClass}" title="Radart bearbeiten">${escapeHtml(displayBike)}</div>`;

      const statsOnlyInner = hasCsvStats 
        ? renderStatsOnlyHtml(dbEntry.dist, dbEntry.ascent, dbEntry.time, dbEntry.speed, fileName)
        : renderStatsOnlyHtml("--", "--", "0:00:00", "--", fileName);

      li.innerHTML = `
        <div class="activity-date" title="Datum">${escapeHtml(displayDate)}</div>
        ${badgeHtml}
        <div class="activity-title" title="${escapeHtml(displayName)}">${escapeHtml(displayName)}</div>
        <button class="edit-btn" title="Namen bearbeiten">✎</button>
        ${statsOnlyInner}
      `;

      li.onclick = (e) => {
        if (!e.target.classList.contains('edit-btn') && !e.target.classList.contains('name-input') && !e.target.classList.contains('bike-badge') && !e.target.classList.contains('bike-input')) {
          selectAndDisplayFitTrack(fileName, li);
        }
      };

      const editBtn = li.querySelector('.edit-btn');
      editBtn.onclick = (e) => {
        e.stopPropagation();
        const currentName = dbEntry.name || fileName;
        const titleDiv = li.querySelector('.activity-title');
        if (!titleDiv) return;
        
        const input = document.createElement("input");
        input.type = "text";
        input.className = "name-input";
        input.value = currentName;

        titleDiv.replaceWith(input);
        input.focus();
        input.select();

        const saveNewName = () => {
          const newName = input.value.trim() || fileName;
          dbEntry.name = newName;
          
          const newTitleDiv = document.createElement("div");
          newTitleDiv.className = "activity-title";
          newTitleDiv.title = newName;
          newTitleDiv.textContent = newName;
          input.replaceWith(newTitleDiv);

          fetch('/api/update_csv', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: fileName, name: newName })
          }).catch(err => console.error("Konnte Aktivitätsnamen nicht speichern:", err));
        };

        input.onblur = saveNewName;
        input.onkeydown = (keyEvt) => {
          if (keyEvt.key === 'Enter') input.blur();
          else if (keyEvt.key === 'Escape') { input.value = currentName; input.blur(); }
        };
      };

      li.addEventListener('click', (e) => {
        if (e.target.classList.contains('bike-badge')) {
          e.stopPropagation();
          const currentBike = dbEntry.rad || "#---";

          const bikeInput = document.createElement("input");
          bikeInput.type = "text";
          bikeInput.className = "bike-input";
          bikeInput.value = currentBike === "#---" ? "" : currentBike;
          bikeInput.placeholder = "#---";

          e.target.replaceWith(bikeInput);
          bikeInput.focus();
          bikeInput.select();

          const saveNewBike = () => {
            const newBike = bikeInput.value.trim() || "#---";
            dbEntry.rad = newBike;

            const newBadge = document.createElement("div");
            const colorClass = getBikeClass(newBike);
            newBadge.className = `bike-badge ${colorClass}`;
            newBadge.title = "Radart bearbeiten";
            newBadge.textContent = newBike;
            bikeInput.replaceWith(newBadge);

            fetch('/api/update_csv', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ filename: fileName, rad: newBike })
            }).catch(err => console.error("Konnte Radart nicht speichern:", err));
          };

          bikeInput.onblur = saveNewBike;
          bikeInput.onkeydown = (keyEvt) => {
            if (keyEvt.key === 'Enter') bikeInput.blur();
            else if (keyEvt.key === 'Escape') { bikeInput.value = currentBike; bikeInput.blur(); }
          };
        }
      });

      list.appendChild(li);

      if (!hasCsvStats) {
        fetchAndParseSession(fileName).then(data => {
          const distCell = document.getElementById(`dist-${safeId}`);
          const ascentCell = document.getElementById(`ascent-${safeId}`);
          const timeCell = document.getElementById(`time-${safeId}`);
          const speedCell = document.getElementById(`speed-${safeId}`);

          if (data && data.stats && distCell && ascentCell && timeCell && speedCell) {
            const s = data.stats;
            distCell.querySelector('.stat-val').textContent = formatDecimal(s.distKm, 2);
            ascentCell.querySelector('.stat-val').textContent = s.ascentM;
            timeCell.querySelector('.stat-val').textContent = s.timeFormatted;
            speedCell.querySelector('.stat-val').textContent = formatDecimal(s.avgSpeedKmH, 1);
            
            fetch('/api/update_csv', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                filename: fileName,
                dist: s.distKm,
                ascent: s.ascentM,
                time: s.timeFormatted,
                speed: s.avgSpeedKmH
              })
            }).catch(err => console.error("Konnte CSV nicht aktualisieren:", err));

          } else if (distCell) {
            distCell.querySelector('.stat-val').textContent = "Err";
          }
        });
      }
    }
  } catch (err) {
    status.innerText = `Fehler: ${err.message}`;
  }
}

async function fetchAndParseSession(fileName) {
  if (fitCache[fileName]) return fitCache[fileName];

  try {    const fetchResp = await fetch(`/archiv_fit/${encodeURIComponent(fileName)}`);    if (!fetchResp.ok) return null; 

    const arrayBuffer = await fetchResp.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const stream = Stream.fromBuffer(bytes);
    const decoder = new Decoder(stream);

    const { messages } = decoder.read();
    let stats = { distKm: "--", ascentM: "--", timeFormatted: "0:00:00", avgSpeedKmH: "--" };

    if (messages && messages.sessionMesgs && messages.sessionMesgs.length > 0) {
      const session = messages.sessionMesgs[0];
      stats.distKm = session.totalDistance ? (session.totalDistance / 1000).toFixed(2) : "--";
      stats.ascentM = session.totalAscent !== undefined ? Math.round(session.totalAscent) : "--";
      stats.timeFormatted = formatTime(session.totalTimerTime);
      stats.avgSpeedKmH = session.avgSpeed ? (session.avgSpeed * 3.6).toFixed(1) : "--";
    }

    fitCache[fileName] = { messages, stats };
    return fitCache[fileName];
  } catch (e) {
    console.error("Fehler beim Verarbeiten von", fileName, e);
    return null;
  }
}

async function selectAndDisplayFitTrack(fileName, element) {
  document.querySelectorAll("#fitFileList li").forEach(el => el.classList.remove("active"));
  element.classList.add("active");
  
  const status = document.getElementById("status");
  status.innerText = `Lade Track: ${fileName}...`;

  const data = await fetchAndParseSession(fileName);
  if (!data || !data.messages) {
    status.innerText = `Fehler beim Laden von ${fileName}`;
    return;
  }

  const messages = data.messages;
  const trackLatLngs = [];

  if (messages && messages.recordMesgs) {
    messages.recordMesgs.forEach(record => {
      if (record.positionLat !== undefined && record.positionLong !== undefined) {
        const lat = semicirclesToDegrees(record.positionLat);
        const lon = semicirclesToDegrees(record.positionLong);
        if (lat !== 0 && lon !== 0) {
          trackLatLngs.push([lat, lon]);
        }
      }
    });
  }

  if (currentTrackLayer) map.removeLayer(currentTrackLayer);

  if (trackLatLngs.length > 0) {
    currentTrackLayer = L.polyline(trackLatLngs, { color: '#ff00b7', weight: 4, opacity: 0.85 }).addTo(map);
    map.fitBounds(currentTrackLayer.getBounds(), { padding: [30, 30] });
    status.innerText = `Aktivität: ${fileName}`;
  } else {
    status.innerText = `Keine GPS-Punkte in ${fileName}.`;
  }
}

function initResizers() {
  const resizerV = document.getElementById("dragMeV");
  const topPanel = document.querySelector(".top-panel");

  let y = 0;
  let topHeight = 0;

  const mouseDownV = function (e) {
    y = e.clientY;
    topHeight = topPanel.getBoundingClientRect().height;
    document.addEventListener("mousemove", mouseMoveV);
    document.addEventListener("mouseup", mouseUpV);
    resizerV.classList.add("active");
  };

  const mouseMoveV = function (e) {
    const dy = e.clientY - y;
    const newHeight = topHeight + dy;
    if (newHeight > 150 && newHeight < window.innerHeight - 150) {
      topPanel.style.flex = `0 0 ${newHeight}px`;
    }
  };

  const mouseUpV = function () {
    resizerV.classList.remove("active");
    document.removeEventListener("mousemove", mouseMoveV);
    document.removeEventListener("mouseup", mouseUpV);
    if (map) map.invalidateSize();
  };

  if (resizerV) resizerV.addEventListener("mousedown", mouseDownV);

  const resizerH = document.getElementById("dragMeH");
  const mapPanel = document.querySelector(".map-panel");

  let x = 0;
  let mapWidth = 0;

  const mouseDownH = function (e) {
    x = e.clientX;
    mapWidth = mapPanel.getBoundingClientRect().width;
    document.addEventListener("mousemove", mouseMoveH);
    document.addEventListener("mouseup", mouseUpH);
    resizerH.classList.add("active");
  };

  const mouseMoveH = function (e) {
    const dx = e.clientX - x;
    const newWidth = mapWidth + dx;
    if (newWidth > 200 && window.innerWidth - newWidth > 200) {
      mapPanel.style.flex = `0 0 ${newWidth}px`;
    }
  };

  const mouseUpH = function () {
    resizerH.classList.remove("active");
    document.removeEventListener("mousemove", mouseMoveH);
    document.removeEventListener("mouseup", mouseUpH);
    if (map) map.invalidateSize();
  };

  if (resizerH) resizerH.addEventListener("mousedown", mouseDownH);
}