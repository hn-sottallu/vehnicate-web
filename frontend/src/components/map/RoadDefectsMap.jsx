import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import * as h3 from "h3-js";
import { createClient } from "@supabase/supabase-js";

// ─── Supabase config ──────────────────────────────────────────────────────────
const SUPABASE_URL = "https://yickjqlccukcgdnagzav.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpY2tqcWxjY3VrY2dkbmFnemF2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzEzNDIxNiwiZXhwIjoyMDg4NzEwMjE2fQ.1X5rcMZkzamNvnsplCEPyNfQhhbPeSnvJdgGGmRHwpw";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const H3_RES = 8;
const CITIES = ["Chennai", "Surat", "Bangalore", "Mumbai", "Hyderabad"];
// Clone first item at end so the scroll from last→first looks continuous
const CITIES_LOOP = [...CITIES, CITIES[0]];

// ─── Color ramp ───────────────────────────────────────────────────────────────
// ─── Color ramp (for events only) ────────────────────────────────────────────
function getEventColor(param) {
  param = Math.max(0, Math.min(1, param));
  if (param < 0.3) {
    const x = Math.pow(param / 0.3, 2);
    return `rgb(0,${Math.round(120 + 135 * x)},0)`;
  } else if (param < 0.5) {
    const x = Math.pow((param - 0.3) / 0.2, 2);
    return `rgb(255,${Math.round(140 - 90 * x)},0)`;
  } else {
    const x = Math.pow((param - 0.5) / 0.5, 2);
    return `rgb(255,${Math.round(50 * (1 - x))},0)`;
  }
}

// ─── H3 helpers ───────────────────────────────────────────────────────────────
function boundsToH3Cells(bounds) {
  const polygon = [
    [bounds.getNorth(), bounds.getWest()],
    [bounds.getNorth(), bounds.getEast()],
    [bounds.getSouth(), bounds.getEast()],
    [bounds.getSouth(), bounds.getWest()],
    [bounds.getNorth(), bounds.getWest()],
  ];

  return h3.polygonToCells(polygon, H3_RES);
}

// ─── Supabase fetchers ────────────────────────────────────────────────────────
async function fetchEventsForCells(cells, cachedCells) {
  const toFetch = cells.filter((c) => !cachedCells.has(c));
  if (!toFetch.length) return [];
  const { data, error } = await supabase
    .from("roaddefects")
    .select("id, tripid, h3_index, path, parameter, start_timestamp, end_timestamp")
    .in("h3_index", toFetch);
  if (error) { console.error("[supabase] roaddefects:", error); return []; }
  return data || [];
}

async function fetchImagesForEvents(eventIds) {
  if (!eventIds.length) return {};
  const { data, error } = await supabase
    .from("images")
    .select("event_id, image_url")
    .in("event_id", eventIds);
  if (error) { console.error("[supabase] images:", error); return {}; }
  const map = {};
  for (const row of data || []) {
    if (!map[row.event_id]) map[row.event_id] = [];
    map[row.event_id].push(row.image_url);
  }
  return map;
}

// ─── Popup HTML (click → images) ─────────────────────────────────────────────
function buildImagePopupHTML(events, imageMap) {
  let html = `<div style="font-family:monospace;max-width:500px;">`;
  for (const ev of events) {
    const imgs = imageMap[ev.id] || [];
    const start = new Date(ev.start_timestamp).toLocaleString("en-IN", {
      dateStyle: "medium", timeStyle: "short",
    });
    const color = getEventColor(ev.parameter);
    html += `
      <div style="border-left:3px solid ${color};padding:8px 12px;
        margin-bottom:10px;background:rgba(255,255,255,0.04);border-radius:0 6px 6px 0;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="font-size:11px;color:#ccc;">${start}</span>
          <span style="font-size:12px;font-weight:700;color:${color};
            background:rgba(0,0,0,0.3);padding:2px 8px;border-radius:99px;">
            ⬡ ${ev.parameter.toFixed(3)}
          </span>
        </div>`;
    if (imgs.length > 0) {
      html += `
        <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:6px;
          scrollbar-width:thin;scrollbar-color:#fff transparent;">`;
      for (const url of imgs.slice(0, 8)) {
        html += `<img src="${url}" style="height:120px;border-radius:6px;flex-shrink:0;
          object-fit:cover;cursor:pointer;" onclick="window.open('${url}','_blank')"/>`;
      }
      html += `</div>`;
    } else {
      html += `<div style="font-size:11px;color:#555;font-style:italic;">No images</div>`;
    }
    html += `</div>`;
  }
  return html + `</div>`;
}
// ─── Hover tooltip HTML ───────────────────────────────────────────────────────
function buildHoverHTML(events) {
  const avgParam = events.reduce((s, e) => s + e.parameter, 0) / events.length;
  const color = getEventColor(avgParam);
  const start = new Date(events[0].start_timestamp).toLocaleString("en-IN", {
    dateStyle: "medium", timeStyle: "short",
  });
  return `
    <div style="font-family:monospace;font-size:12px;min-width:180px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <span style="color:#ccc;font-weight:600;">Event ID</span>
        <span style="color:#fff;">${events[0].id}</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <span style="color:#ccc;font-weight:600;">Parameter</span>
        <span style="font-weight:700;color:${color};">${avgParam.toFixed(3)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:${events.length > 1 ? '6px' : '0'};">
        <span style="color:#ccc;font-weight:600;">Time</span>
        <span style="color:#fff;">${start}</span>
      </div>
      ${events.length > 1 ? `
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="color:#ccc;font-weight:600;">Combined events</span>
        <span style="color:#a855f7;font-weight:700;">${events.length}</span>
      </div>` : ''}
    </div>`;
}
// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Ledger&display=swap');

  /* ── Outer container fills whatever parent gives it ── */
  #rdm-container {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }

  /* ── Map fills the container completely ── */
  #rdm-map {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  /* ── Watermark ── */
  #rdm-watermark {
    position: absolute;
    bottom: 40px;
    right: 50px;
    font-family: 'Ledger', serif;
    font-size: 24px;
    color: white;
    letter-spacing: 1px;
    pointer-events: none;
    z-index: 1000;
  }

  /* ── Road Explorer Badge ── */
  #rdm-badge {
    position: absolute;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    padding: 10px 24px;
    border-radius: 22px;
    background: rgba(255, 254, 254, 0.4);
    backdrop-filter: blur(16px);
    z-index: 1000;
    pointer-events: none;
    white-space: nowrap;
  }
  #rdm-badge span {
    font-size: 16px;
    font-weight: 600;
    background: linear-gradient(135deg, #a855f7, #ec4899);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  /* ── Search wrapper — desktop: top left, mobile: below badge ── */
  #rdm-search-wrap {
    position: absolute;
    top: 20px;
    left: 20px;
    width: 340px;
    z-index: 1000;
  }

  @media (max-width: 640px) {
    #rdm-search-wrap {
      top: 80px;
      left: 50%;
      transform: translateX(-50%);
      width: calc(100vw - 40px);
      max-width: 340px;
    }
    #rdm-watermark {
      font-size: 14px;
      bottom: 12px;
      right: 12px;
    }
    #rdm-badge {
      padding: 8px 18px;
    }
    #rdm-badge span {
      font-size: 14px;
    }
    .leaflet-popup {
      max-width: 92vw !important;
    }
    .leaflet-popup-content-wrapper {
      max-width: 92vw !important;
    }
    .leaflet-popup-content {
      margin: 10px !important;
    }
  }

  #rdm-search-box {
    width: 100%;
    height: 48px;
    display: flex;
    align-items: center;
    padding-left: 58px;
    padding-right: 16px;
    background: rgba(255,255,255,0.12);
    backdrop-filter: blur(18px);
    border-radius: 20px;
    position: relative;
    box-shadow: 0 8px 30px rgba(0,0,0,0.25);
  }

  /* Gradient border */
  #rdm-search-box::before {
    content: "";
    position: absolute;
    inset: -2px;
    border-radius: 22px;
    background: linear-gradient(135deg, #a855f7, #ec4899);
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    pointer-events: none;
    z-index: 0;
  }

  /* Logo */
  #rdm-search-box::after {
    content: "";
    position: absolute;
    left: 5px;
    width: 46px;
    height: 46px;
    background: url('/hn-logo.png') no-repeat center;
    background-size: contain;
    border-radius: 14px;
    z-index: 1;
  }

  #rdm-search-input {
    width: 100%;
    border: none;
    outline: none;
    background: transparent;
    color: white;
    font-size: 14px;
    font-weight: 500;
    caret-color: #a855f7;
    position: relative;
    z-index: 2;
  }

  /* Animated placeholder */
  #rdm-placeholder {
    position: absolute;
    left: 58px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 14px;
    color: rgba(255,255,255,0.55);
    pointer-events: none;
    display: flex;
    gap: 5px;
    align-items: center;
    white-space: nowrap;
    z-index: 1;
  }

  #rdm-city-rotator {
    height: 20px;
    overflow: hidden;
  }

  /*
    Pure CSS infinite scroll — no JS needed.
    6 items (5 cities + clone of first) × 20px = 120px total height.
    Each city shows for 2.5s, smooth scroll takes 0.6s.
    Total = 6 × 3.1s ≈ 18.6s per full cycle.
    Keyframes: pause at each city, then smoothly scroll to next.
  */
  #rdm-city-inner {
    display: flex;
    flex-direction: column;
    animation: rdm-scroll 18.6s infinite;
  }

  @keyframes rdm-scroll {
    0%         { transform: translateY(0px); }
    13.4%      { transform: translateY(0px); }
    16.7%      { transform: translateY(-20px); }
    29.9%      { transform: translateY(-20px); }
    33.2%      { transform: translateY(-40px); }
    46.4%      { transform: translateY(-40px); }
    49.7%      { transform: translateY(-60px); }
    62.9%      { transform: translateY(-60px); }
    66.2%      { transform: translateY(-80px); }
    79.4%      { transform: translateY(-80px); }
    82.7%      { transform: translateY(-100px); }
    96.1%      { transform: translateY(-100px); }
    96.2%      { transform: translateY(0px); }
    100%       { transform: translateY(0px); }
  }

  #rdm-city-inner span {
    height: 20px;
    line-height: 20px;
    display: block;
  }

  /* Dropdown */
  #rdm-dropdown {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    right: 0;
    background: rgba(10,10,18,0.94);
    backdrop-filter: blur(16px);
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 8px 25px rgba(0,0,0,0.5);
    border: 1px solid rgba(255,255,255,0.08);
  }

  .rdm-result {
    padding: 11px 18px;
    color: rgba(255,255,255,0.8);
    font-size: 13px;
    cursor: pointer;
    transition: background 0.2s;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .rdm-result:hover {
    background: rgba(168,85,247,0.15);
    color: white;
  }

  /* ── Refresh button ── */
  #rdm-refresh {
    position: absolute;
    top: 20px;
    right: 20px;
    z-index: 1000;
    height: 42px;
    padding: 0 16px;
    border-radius: 22px;
    background: rgba(0,0,0,0.4);
    backdrop-filter: blur(16px);
    border: 1px solid rgba(168,85,247,0.4);
    color: white;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: border-color 0.2s, background 0.2s;
    white-space: nowrap;
  }
  #rdm-refresh:hover {
    background: rgba(168,85,247,0.15);
    border-color: rgba(168,85,247,0.8);
  }
  #rdm-refresh:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  #rdm-refresh .spin {
    display: inline-block;
    animation: rdm-spin 0.8s linear infinite;
  }
  @keyframes rdm-spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @media (max-width: 640px) {
    #rdm-refresh {
      top: 20px;
      right: 12px;
      height: 36px;
      padding: 0 12px;
      font-size: 12px;
    }
  }
  .leaflet-popup-content-wrapper {
    background: #12121a !important;
    border: 1px solid rgba(255,255,255,0.1) !important;
    border-radius: 10px !important;
    box-shadow: 0 8px 32px rgba(0,0,0,0.6) !important;
    color: #e0e0e0 !important;
    padding: 0 !important;
  }
  .leaflet-popup-content { margin: 14px !important; }
  .leaflet-popup-tip { background: #12121a !important; }
  .leaflet-popup-close-button {
    color: #aaa !important;
    font-size: 18px !important;
    top: 6px !important;
    right: 8px !important;
  }
  .leaflet-tooltip {
    background: rgba(10,10,18,0.97) !important;
    border: 1px solid rgba(255,255,255,0.15) !important;
    border-radius: 8px !important;
    color: #fff !important;
    box-shadow: 0 4px 16px rgba(0,0,0,0.6) !important;
    padding: 8px 12px !important;
  }
  .leaflet-tooltip-top:before {
    border-top-color: rgba(255,255,255,0.15) !important;
  }
  
  .leaflet-popup-content div::-webkit-scrollbar {
    height: 4px;
  }
  .leaflet-popup-content div::-webkit-scrollbar-track {
    background: transparent;
  }
  .leaflet-popup-content div::-webkit-scrollbar-thumb {
    background: #fff;
    border-radius: 99px;
  }
`;

// ─── Search bar ───────────────────────────────────────────────────────────────
function SearchBar({ onSelect }) {
  const [query,   setQuery]   = useState("");
  const [results, setResults] = useState([]);
  const [focused, setFocused] = useState(false);
  const timerRef = useRef(null);

  // ── Geocode with Nominatim ─────────────────────────────────────────────────
  const search = useCallback(async (q) => {
    if (q.length < 3) { setResults([]); return; }
    try {
      const res  = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5`,
        { headers: { "Accept-Language": "en" } }
      );
      const data = await res.json();
      setResults(data.map((r) => ({
        label: r.display_name,
        lat:   parseFloat(r.lat),
        lon:   parseFloat(r.lon),
      })));
    } catch (e) {
      console.error("[geocode]", e);
    }
  }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(val), 400);
  };

  const handlePick = (r) => {
    onSelect(r.lat, r.lon);
    setQuery(r.label.split(",")[0]);
    setResults([]);
  };

  return (
    <div id="rdm-search-wrap">
      <div id="rdm-search-box">
        <input
          id="rdm-search-input"
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          autoComplete="off"
        />
        {/* Animated placeholder — hidden when focused or has value */}
        {!focused && !query && (
          <div id="rdm-placeholder">
            <span>Search</span>
            <div id="rdm-city-rotator">
              <div id="rdm-city-inner">
                {CITIES_LOOP.map((c, i) => (
                  <span key={i}>{c}</span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {results.length > 0 && focused && (
        <div id="rdm-dropdown">
          {results.map((r, i) => (
            <div key={i} className="rdm-result" onMouseDown={() => handlePick(r)}>
              {r.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function RoadDefectsMap() {
  const mapRef        = useRef(null);
  const mapDivRef     = useRef(null);
  const layerCacheRef = useRef({});
  const eventCacheRef = useRef({});
  const imageCacheRef = useRef({});
  const fetchedCells  = useRef(new Set());
  const isFetchingRef = useRef(false);

  // ── Initialize Leaflet ─────────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current) return;

    // Small delay ensures the DOM has painted and the container has real pixels
    const init = () => {
      const map = L.map(mapDivRef.current, {
        center: [13.05, 80.22],
        zoom: 13,
        zoomControl: false,
      });

      L.control.zoom({ position: "bottomright" }).addTo(map);

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        { attribution: "© OpenStreetMap contributors © CARTO", subdomains: "abcd", maxZoom: 20 }
      ).addTo(map);

      mapRef.current = map;

      // Force Leaflet to recalculate container size after mount
      setTimeout(() => map.invalidateSize(), 100);

      loadViewport();

      let moveTimer = null;
      map.on("moveend", () => {
        clearTimeout(moveTimer);
        moveTimer = setTimeout(loadViewport, 300);
      });
    };

    // Use requestAnimationFrame so the container is definitely rendered
    requestAnimationFrame(init);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // ── Viewport loader ────────────────────────────────────────────────────────
  const loadViewport = useCallback(async () => {
    const map = mapRef.current;
    if (!map || isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      const cells     = boundsToH3Cells(map.getBounds());
      console.log("1. Cells generated:", cells.length, cells.slice(0, 3));

      const newEvents = await fetchEventsForCells(cells, fetchedCells.current);
      console.log("2. New events returned:", newEvents.length, newEvents);

      cells.forEach((c) => fetchedCells.current.add(c));
      if (!newEvents.length) return;

      const newImages = await fetchImagesForEvents(newEvents.map((e) => e.id));
      Object.assign(imageCacheRef.current, newImages);

      const byHex = {};
      for (const ev of newEvents) {
        if (!ev.h3_index) continue;
        if (!byHex[ev.h3_index]) byHex[ev.h3_index] = [];
        byHex[ev.h3_index].push(ev);
      }
      for (const [hexId, events] of Object.entries(byHex)) {
        if (!eventCacheRef.current[hexId]) eventCacheRef.current[hexId] = [];
        eventCacheRef.current[hexId].push(...events);
        drawHex(hexId, eventCacheRef.current[hexId]);
      }
    } catch (err) {
      console.error("[loadViewport]", err);
    } finally {
      isFetchingRef.current = false;
    }
  }, []);

  // ── Draw hex ───────────────────────────────────────────────────────────────
  function drawHex(hexId, events) {
    const map = mapRef.current;
    if (!map) return;

    // Remove existing layer group for this hex if any
    if (layerCacheRef.current[hexId]) {
      layerCacheRef.current[hexId].forEach(l => map.removeLayer(l));
    }

    const layers = [];

    // ── 1. Hexagon — always transparent blue ──────────────────────────────────
    const latLngs = h3.cellToBoundary(hexId).map(([lat, lng]) => [lat, lng]);
    const hexPolygon = L.polygon(latLngs, {
      color: "#3b82f6",
      fillColor: "#3b82f6",
      fillOpacity: 0.35,
      weight: 1.5,
      opacity: 0.8,
    });
    hexPolygon.addTo(map);
    layers.push(hexPolygon);

    // ── 2. Group events by identical path ────────────────────────────────────
    const pathGroups = {};
    for (const ev of events) {
      const key = JSON.stringify(ev.path);
      if (!pathGroups[key]) pathGroups[key] = [];
      pathGroups[key].push(ev);
    }

    // ── 3. Draw each path group ───────────────────────────────────────────────
    for (const [pathKey, groupEvents] of Object.entries(pathGroups)) {
      const path = JSON.parse(pathKey);
      const avgParam = groupEvents.reduce((s, e) => s + e.parameter, 0) / groupEvents.length;
      const color = getEventColor(avgParam);

      let eventLayer;

      if (path.length <= 1) {
        // ── Single point → Circle marker ──────────────────────────────────────
        const [lat, lon] = path[0];
        eventLayer = L.circle([lat, lon], {
          radius: 8,
          color: color,
          fillColor: color,
          fillOpacity: 0.9,
          weight: 1.5,
        });
      } else {
        // ── Multiple points → Polyline ─────────────────────────────────────────
        eventLayer = L.polyline(path, {
          color: color,
          weight: 5,
          opacity: 0.85,
        });
      }

      // Hover
      eventLayer.on("mouseover", (e) => {
        eventLayer.bindTooltip(buildHoverHTML(groupEvents), {
          sticky: true,
          opacity: 1,
          className: "rdm-tooltip",
        }).openTooltip(e.latlng);
        if (path.length <= 1) {
          eventLayer.setStyle({ fillOpacity: 1, weight: 3 });  // ← highlight on hover
        } else {
          eventLayer.setStyle({ weight: 7, opacity: 1 });
        }
      });

      eventLayer.on("mouseout", () => {
        eventLayer.closeTooltip();
        if (path.length <= 1) {
          eventLayer.setStyle({ fillOpacity: 0.9, weight: 1.5 });  // ← back to normal
        } else {
          eventLayer.setStyle({ weight: 5, opacity: 0.85 });
        }
      });

      // Click → image popup
      eventLayer.on("click", async () => {
        const missing = groupEvents.map(e => e.id).filter(id => !imageCacheRef.current[id]);
        if (missing.length) {
          Object.assign(imageCacheRef.current, await fetchImagesForEvents(missing));
        }
        eventLayer
          .bindPopup(buildImagePopupHTML(groupEvents, imageCacheRef.current), {
            maxWidth: 520,
            maxHeight: 460,
          })
          .openPopup();
      });

      eventLayer.addTo(map);
      layers.push(eventLayer);
    }

    // Store all layers for this hex so we can remove them later
    layerCacheRef.current[hexId] = layers;
  }

  const handleSearchSelect = useCallback((lat, lon) => {
    mapRef.current?.setView([lat, lon], 14, { animate: true, duration: 1.5 });
  }, []);

  // ── Refresh — clears all caches and redraws current viewport ──────────────
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    const map = mapRef.current;
    if (!map || refreshing) return;
    setRefreshing(true);

    // Remove all hex layers from map
    Object.values(layerCacheRef.current).forEach((layers) => 
    layers.forEach(l => map.removeLayer(l))
  );

    // Clear all caches
    layerCacheRef.current = {};
    eventCacheRef.current = {};
    imageCacheRef.current = {};
    fetchedCells.current  = new Set();
    isFetchingRef.current = false;

    // Directly fetch fresh data — avoids stale closure in loadViewport
    try {
      const cells     = boundsToH3Cells(map.getBounds());
      const newEvents = await fetchEventsForCells(cells, fetchedCells.current);
      cells.forEach((c) => fetchedCells.current.add(c));

      if (newEvents.length) {
        const newImages = await fetchImagesForEvents(newEvents.map((e) => e.id));
        Object.assign(imageCacheRef.current, newImages);

        const byHex = {};
        for (const ev of newEvents) {
          if (!ev.h3_index) continue;
          if (!byHex[ev.h3_index]) byHex[ev.h3_index] = [];
          byHex[ev.h3_index].push(ev);
        }
        for (const [hexId, events] of Object.entries(byHex)) {
          eventCacheRef.current[hexId] = events;
          drawHex(hexId, events);
        }
      }
    } catch (err) {
      console.error("[refresh]", err);
    }

    setRefreshing(false);
  }, [refreshing]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{styles}</style>
      <div id="rdm-container">
        <div id="rdm-map" ref={mapDivRef} />
        <SearchBar onSelect={handleSearchSelect} />
        <div id="rdm-badge"><span>road runner</span></div>
        <button id="rdm-refresh" onClick={handleRefresh} disabled={refreshing}>
          {refreshing
            ? <><span className="spin">↻</span> Refreshing…</>
            : <>↻</>}
        </button>
        <div id="rdm-watermark">vehnicate</div>
      </div>
    </>
  );
}