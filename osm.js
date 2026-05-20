// osm.js — Lazy-loaded Leaflet + Overpass client for the Restaurants map
// Free, no API keys. Tiles from OpenStreetMap.

(function () {
  const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  let loading = null;

  function loadLeaflet() {
    if (window.L) return Promise.resolve(window.L);
    if (loading) return loading;
    loading = new Promise((resolve, reject) => {
      if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
        const css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = LEAFLET_CSS;
        document.head.appendChild(css);
      }
      const s = document.createElement('script');
      s.src = LEAFLET_JS;
      s.async = true;
      s.onload = () => resolve(window.L);
      s.onerror = () => reject(new Error('No se pudo cargar el mapa.'));
      document.head.appendChild(s);
    });
    return loading;
  }

  // Get user location with timeout
  function getLocation(timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const e = new Error('geo_unavailable'); e.code = 'geo_unavailable';
        return reject(e);
      }
      let done = false;
      const timer = setTimeout(() => {
        if (!done) { done = true; const e = new Error('geo_timeout'); e.code = 'geo_timeout'; reject(e); }
      }, timeoutMs);
      navigator.geolocation.getCurrentPosition(
        (pos) => { if (!done) { done = true; clearTimeout(timer); resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy }); } },
        (err) => {
          if (done) return; done = true; clearTimeout(timer);
          const e = new Error('geo_denied');
          e.code = err.code === 1 ? 'geo_denied' : err.code === 2 ? 'geo_unavailable' : 'geo_timeout';
          reject(e);
        },
        { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 60000 }
      );
    });
  }

  // Query restaurants/cafes/bakeries with diet:gluten_free=yes|only within radius (meters)
  // We use POST (more reliable for long queries) with content-type form-urlencoded.
  async function findGlutenFreePlaces({ lat, lon, radius = 2500 }) {
    const r = Math.max(200, Math.min(10000, Math.round(radius)));
    const q = `[out:json][timeout:25];
(
  node["amenity"~"^(restaurant|cafe|bakery|fast_food|ice_cream|pub|bar|food_court)$"]["diet:gluten_free"~"^(yes|only)$"](around:${r},${lat},${lon});
  way["amenity"~"^(restaurant|cafe|bakery|fast_food|ice_cream|pub|bar|food_court)$"]["diet:gluten_free"~"^(yes|only)$"](around:${r},${lat},${lon});
);
out center 60;`;

    const mirrors = [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
      'https://overpass.private.coffee/api/interpreter',
    ];

    let lastErr;
    for (const url of mirrors) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 25000);
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'data=' + encodeURIComponent(q),
          credentials: 'omit',
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (!res.ok) { lastErr = new Error('http_' + res.status); continue; }
        const data = await res.json();
        return (data.elements || []).map(e => {
          const lat = e.lat ?? (e.center && e.center.lat);
          const lon = e.lon ?? (e.center && e.center.lon);
          const t = e.tags || {};
          return {
            id: `${e.type}-${e.id}`,
            lat, lon,
            name: t.name || 'Sin nombre',
            cuisine: t.cuisine || '',
            amenity: t.amenity || '',
            diet: t['diet:gluten_free'] || 'yes',
            address: [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' '),
            city: t['addr:city'] || '',
            phone: t.phone || '',
            website: t.website || '',
            opening_hours: t.opening_hours || '',
          };
        }).filter(p => p.lat && p.lon);
      } catch (e) {
        clearTimeout(timer);
        lastErr = e;
      }
    }
    const err = new Error('overpass_failed');
    err.code = 'overpass_failed';
    err.detail = lastErr ? (lastErr.message || lastErr.name) : 'unknown';
    throw err;
  }

  // Haversine distance in meters
  function distance(a, b) {
    const R = 6371000;
    const toRad = d => d * Math.PI / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lon - a.lon);
    const lat1 = toRad(a.lat), lat2 = toRad(b.lat);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  window.GZOSM = { loadLeaflet, getLocation, findGlutenFreePlaces, distance };
})();
