// places-store.js — User notes about restaurants/places, stored in localStorage

(function () {
  const KEY = 'gz.places.v1';
  function load() {
    try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : {}; }
    catch { return {}; }
  }
  function save(map) { try { localStorage.setItem(KEY, JSON.stringify(map)); } catch {} }

  function get(id) {
    const map = load();
    return map[id] || null;
  }

  function set(id, data) {
    const map = load();
    map[id] = { ...(map[id] || {}), ...data, ts: Date.now() };
    save(map);
    return map[id];
  }

  function toggleRecommend(id, baseInfo = {}) {
    const cur = get(id) || {};
    const recommended = !cur.recommended;
    return set(id, { ...baseInfo, recommended });
  }

  function setNote(id, note, baseInfo = {}) {
    const text = String(note || '').trim();
    return set(id, { ...baseInfo, note: text });
  }

  function listAll() {
    const map = load();
    return Object.entries(map).map(([id, v]) => ({ id, ...v }));
  }

  function clear() { save({}); }

  window.GZPlaces = { get, set, toggleRecommend, setNote, listAll, clear };
})();
