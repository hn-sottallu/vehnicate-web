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
function getColor(param) {
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
  return h3.polygonToCells({
    outer: [
      [bounds.getNorth(), bounds.getWest()],
      [bounds.getNorth(), bounds.getEast()],
      [bounds.getSouth(), bounds.getEast()],
      [bounds.getSouth(), bounds.getWest()],
      [bounds.getNorth(), bounds.getWest()],
    ],
  }, H3_RES);
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

// ─── Popup HTML ───────────────────────────────────────────────────────────────
function buildPopupHTML(events, imageMap) {
  let html = `<div style="font-family:monospace;max-width:480px;">`;
  for (const ev of events) {
    const imgs  = imageMap[ev.id] || [];
    const start = new Date(ev.start_timestamp).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short",
    });
    const end = new Date(ev.end_timestamp).toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata", timeStyle: "short",
    });
    html += `
      <div style="border-left:3px solid ${getColor(ev.parameter)};padding:8px 12px;
        margin-bottom:10px;background:rgba(255,255,255,0.04);border-radius:0 6px 6px 0;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <span style="font-size:11px;color:#aaa;">Trip ${ev.tripid}</span>
          <span style="font-size:12px;font-weight:700;color:${getColor(ev.parameter)};
            background:rgba(0,0,0,0.3);padding:2px 8px;border-radius:99px;">
            ⬡ ${ev.parameter.toFixed(3)}
          </span>
        </div>
        <div style="font-size:11px;color:#ccc;margin-bottom:8px;">${start} → ${end}</div>`;
    if (imgs.length > 0) {
      html += `<div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;">`;
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
    bottom: 20px;
    right: 20px;
    font-family: 'Ledger', serif;
    font-size: 20px;
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
    background: rgba(0,0,0,0.4);
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

  /* Leaflet popup dark theme */
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
`;

// ─── Search bar ───────────────────────────────────────────────────────────────
function SearchBar({ onSelect }) {
  const [query,   setQuery]   = useState("");
  const [results, setResults] = useState([]);
  const [focused, setFocused] = useState(false);
  const [cityIdx, setCityIdx] = useState(0);
  const innerRef  = useRef(null);
  const timerRef  = useRef(null);
  const isResetting = useRef(false);

  // ── Seamless cyclic rotation ───────────────────────────────────────────────
  // List is [A, B, C, D, E, A(clone)].
  // We animate 0→1→2→3→4→5(clone of A).
  // When we land on index 5 (the clone), we wait for the transition to finish,
  // then silently (no transition) snap back to index 0 (real A).
  // User sees: …D → E → A → B… with no jump.
  useEffect(() => {
    const interval = setInterval(() => {
      if (isResetting.current) return;
      setCityIdx((prev) => prev + 1);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;

    if (cityIdx === CITIES_LOOP.length - 1) {
      // Animate to clone (last item)
      el.style.transition = "transform 0.6s ease-in-out";
      el.style.transform  = `translateY(-${cityIdx * 20}px)`;

      // After animation completes, snap silently back to index 0
      const timeout = setTimeout(() => {
        isResetting.current = true;
        el.style.transition = "none";
        el.style.transform  = "translateY(0px)";
        setCityIdx(0);
        // Re-enable transitions after a frame
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            isResetting.current = false;
          });
        });
      }, 650); // slightly longer than transition duration

      return () => clearTimeout(timeout);
    } else {
      el.style.transition = "transform 0.6s ease-in-out";
      el.style.transform  = `translateY(-${cityIdx * 20}px)`;
    }
  }, [cityIdx]);

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
        {!focused && !query && (
          <div id="rdm-placeholder">
            <span>Search</span>
            <div id="rdm-city-rotator">
              <div id="rdm-city-inner" ref={innerRef} style={{ display: "flex", flexDirection: "column" }}>
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
      const newEvents = await fetchEventsForCells(cells, fetchedCells.current);
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
    if (layerCacheRef.current[hexId]) map.removeLayer(layerCacheRef.current[hexId]);

    const avgParam = events.reduce((s, e) => s + e.parameter, 0) / events.length;
    const color    = getColor(avgParam);
    const latLngs  = h3.cellToBoundary(hexId).map(([lat, lng]) => [lat, lng]);

    const polygon = L.polygon(latLngs, {
      color, fillColor: color,
      fillOpacity: 0.15 + avgParam * 0.35,
      weight: 1.5, opacity: 0.7,
    });

    polygon.on("click", async () => {
      const missing = events.map((e) => e.id).filter((id) => !imageCacheRef.current[id]);
      if (missing.length) Object.assign(imageCacheRef.current, await fetchImagesForEvents(missing));
      polygon
        .bindPopup(buildPopupHTML(events, imageCacheRef.current), { maxWidth: 520, maxHeight: 420 })
        .openPopup();
    });
    polygon.on("mouseover", () =>
      polygon.setStyle({ fillOpacity: Math.min(0.75, 0.15 + avgParam * 0.35 + 0.2), weight: 2.5 })
    );
    polygon.on("mouseout", () =>
      polygon.setStyle({ fillOpacity: 0.15 + avgParam * 0.35, weight: 1.5 })
    );

    polygon.addTo(map);
    layerCacheRef.current[hexId] = polygon;
  }

  const handleSearchSelect = useCallback((lat, lon) => {
    mapRef.current?.setView([lat, lon], 14, { animate: true, duration: 1.5 });
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{styles}</style>
      <div id="rdm-container">
        <div id="rdm-map" ref={mapDivRef} />
        <SearchBar onSelect={handleSearchSelect} />
        <div id="rdm-badge"><span>road explorer</span></div>
        <div id="rdm-watermark">vehnicate</div>
      </div>
    </>
  );
}