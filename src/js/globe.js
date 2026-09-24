/* ============================================================================
   Asia Conference globe
   ----------------------------------------------------------------------------
   A 3D globe of every Asia Conference host city, with arcs from Harvard.
   Clicking a year in the list beside it turns the globe to that city.

   globe.gl is vendored in public/vendor and fetched by this module rather than
   by a <script> tag: the bundler hoists this module into <head>, so a deferred
   tag at the end of <body> would execute after it and `Globe` would still be
   undefined here. If WebGL or the library is unavailable the list stays, so
   the section still carries its information.
   ========================================================================== */
import { ASIA_CONFERENCES } from "./config.js";
import { $, esc } from "./util.js";

const HARVARD = { city: "Harvard University", country: "Cambridge, Massachusetts", lat: 42.3770, lng: -71.1167, home: true };

const COORDS = {
  "Taipei": [25.0330, 121.5654],
  "Hong Kong": [22.3193, 114.1694],
  "Manila": [14.5995, 120.9842],
  "Jakarta": [-6.2088, 106.8456],
  "Seoul": [37.5665, 126.9780],
  "Bangkok": [13.7563, 100.5018],
  "Kuala Lumpur": [3.1390, 101.6869],
  "Beijing": [39.9042, 116.4074],
  "Singapore": [1.3521, 103.8198],
  "Sydney": [-33.8688, 151.2093],
  "Shanghai": [31.2304, 121.4737],
  "Tokyo": [35.6762, 139.6503],
  "Mumbai": [19.0760, 72.8777],
  "Dubai": [25.2048, 55.2708],
  "Nur-Sultan": [51.1694, 71.4491],
  "New Delhi": [28.6139, 77.2090],
  "Hanoi": [21.0285, 105.8542],
};

/* One entry per city, carrying every year it hosted. */
const CITIES = (() => {
  const order = [], map = new Map();
  for (const [year, city, country] of ASIA_CONFERENCES) {
    if (!COORDS[city]) { console.warn("No coordinates for", city); continue; }
    if (!map.has(city)) {
      const [lat, lng] = COORDS[city];
      const o = { city, country, lat, lng, years: [] };
      map.set(city, o);
      order.push(o);
    }
    map.get(city).years.push(year);
  }
  return order;
})();
const CITY_BY_NAME = new Map(CITIES.map((c) => [c.city, c]));

const POINTS = [HARVARD, ...CITIES];
const ARCS = CITIES.map((c) => ({ sLat: HARVARD.lat, sLng: HARVARD.lng, eLat: c.lat, eLng: c.lng }));

const CRIMSON = "197,60,82";
const BRASS = "196,166,110";
const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let globe = null;

function makeGlobe(container) {
  if (typeof Globe === "undefined" || !container) return null;
  let g;
  try {
    g = Globe({ animateIn: true })(container)
      .backgroundColor("rgba(0,0,0,0)")
      .globeImageUrl("/img/earth.jpg")
      .showAtmosphere(true)
      .atmosphereColor("#A51C30")
      .atmosphereAltitude(0.16)
      .pointsData(POINTS)
      .pointLat("lat").pointLng("lng")
      .pointColor((d) => `rgb(${d.home ? CRIMSON : BRASS})`)
      .pointAltitude(0.012)
      .pointRadius((d) => (d.home ? 0.5 : 0.32))
      .pointResolution(8)
      .pointLabel((d) => (d.home
        ? `<div class="globe-tip"><b>Harvard University</b><span>Cambridge, Massachusetts</span></div>`
        : `<div class="globe-tip"><b>${esc(d.city)}</b><span>${esc(d.country)}</span><span>${d.years.join(", ")}</span></div>`))
      .ringsData([HARVARD])
      .ringLat("lat").ringLng("lng")
      .ringColor(() => (t) => `rgba(${CRIMSON},${1 - t})`)
      .ringMaxRadius(4)
      .ringPropagationSpeed(1.5)
      .ringRepeatPeriod(1100)
      .arcsData(ARCS)
      .arcStartLat("sLat").arcStartLng("sLng").arcEndLat("eLat").arcEndLng("eLng")
      .arcColor(() => [`rgba(${BRASS},.75)`, `rgba(${CRIMSON},.45)`])
      .arcStroke(0.4)
      .arcDashLength(0.45)
      .arcDashGap(0.22)
      .arcDashInitialGap((_, i) => (i % 7) / 7)
      .arcDashAnimateTime((_, i) => 3200 + (i % 5) * 450)
      .arcAltitudeAutoScale(0.5);
  } catch (e) {
    console.warn("Globe init failed:", e);
    return null;
  }

  // Retina panels render four times the pixels for a globe nobody inspects at
  // 1:1, so cap the ratio rather than follow the display.
  try { g.renderer().setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); } catch {}

  const c = g.controls();
  c.autoRotate = !REDUCED;
  c.autoRotateSpeed = 0.55;
  c.enableZoom = false;
  c.enablePan = false;
  g.pointOfView({ lat: 20, lng: 105, altitude: 2.1 }, 0);

  // Size to the parent box, not to `container`: globe.gl writes inline
  // width/height onto `container` itself, so measuring it reads back its own
  // last value and the CSS-driven size never wins.
  const box = container.parentElement || container;
  const fit = () => {
    const r = box.getBoundingClientRect();
    if (r.width && r.height) g.width(r.width).height(r.height);
  };
  fit();
  if ("ResizeObserver" in window) new ResizeObserver(fit).observe(box);
  else window.addEventListener("resize", fit);

  return g;
}

function loadLib() {
  if (typeof Globe !== "undefined") return Promise.resolve(true);
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "/vendor/globe.gl.min.js";
    s.onload = () => resolve(typeof Globe !== "undefined");
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
}

function focusCity(name) {
  const city = CITY_BY_NAME.get(name);
  if (!city || !globe) return;
  globe.controls().autoRotate = false;
  globe.pointOfView({ lat: city.lat, lng: city.lng, altitude: 1.7 }, 900);
  clearTimeout(focusCity._t);
  focusCity._t = setTimeout(() => {
    if (globe && !REDUCED) globe.controls().autoRotate = true;
  }, 6000);
}

function renderList() {
  const el = $("host-list");
  if (!el) return;
  el.innerHTML = [...ASIA_CONFERENCES].reverse().map(([year, city, country]) =>
    `<li><button type="button" class="host-row" data-city="${esc(city)}">
      <span class="host-year num">${year}</span>
      <span class="host-city">${esc(city)}</span>
      <span class="host-country">${esc(country)}</span>
    </button></li>`).join("");

  el.addEventListener("click", (e) => {
    const row = e.target.closest(".host-row");
    if (!row) return;
    focusCity(row.dataset.city);
    el.querySelectorAll(".host-row.on").forEach((r) => r.classList.remove("on"));
    row.classList.add("on");
  });
}

export function initGlobe() {
  renderList();
  const stage = $("globe-stage");
  if (!stage) return;

  // Build it only when the section is near the viewport, and stop rendering
  // again once it has scrolled well away.
  const build = async () => {
    if (globe) return;
    // CSS hides the stage below 860px; don't download the library for it.
    if (!stage.offsetParent && getComputedStyle(stage).display === "none") return;
    const ok = await loadLib();
    if (!ok) { stage.classList.add("globe-off"); return; }
    globe = makeGlobe(stage);
    if (!globe) stage.classList.add("globe-off");
  };

  if (!("IntersectionObserver" in window)) { build(); return; }
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        build();
      } else if (globe) {
        globe.controls().autoRotate = false;
      }
      if (entry.isIntersecting && globe && !REDUCED) globe.controls().autoRotate = true;
    }
  }, { rootMargin: "300px" });
  io.observe(stage.parentElement || stage);
}
