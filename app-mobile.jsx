// GlutenZero — interactive prototype
// Three connected screens: Home → Scanner → Result
// Result has 3 states: apto / dudoso / no-apto

const { useState, useEffect, useRef } = React;

// ─────────────────────────────────────────────────────────────
// Design tokens — light + dark presets
// ─────────────────────────────────────────────────────────────
const LIGHT_TOKENS = {
  bg: '#F6F1E8',
  bgSoft: '#FBF7EF',
  surface: '#FFFFFF',
  ink: '#1A1F1B',
  inkSoft: '#5C6259',
  inkMuted: '#8A8F86',
  green: '#1F7A4D',
  greenSoft: '#E5F3EB',
  greenDeep: '#0F4A2E',
  coral: '#E04D3C',
  coralSoft: '#FCE9E5',
  amber: '#D98E1E',
  amberSoft: '#FBEFD5',
  divider: 'rgba(26,31,27,0.08)',
};
const DARK_TOKENS = {
  bg: '#0F1411',          // very dark green-black
  bgSoft: '#161C18',
  surface: '#1B221E',
  ink: '#F1EFE8',
  inkSoft: '#B6B8B0',
  inkMuted: '#7F857C',
  green: '#5DD78A',       // brighter for dark
  greenSoft: 'rgba(93,215,138,0.18)',
  greenDeep: '#5DD78A',   // accent stays bright in dark
  coral: '#F2766A',
  coralSoft: 'rgba(242,118,106,0.18)',
  amber: '#F4C266',
  amberSoft: 'rgba(244,194,102,0.18)',
  divider: 'rgba(255,255,255,0.08)',
};

// `tokens` is mutable. We rewrite its keys when theme changes and force a re-render.
const tokens = { ...LIGHT_TOKENS };

function applyTheme(themeName) {
  const target = themeName === 'dark' ? DARK_TOKENS : LIGHT_TOKENS;
  Object.keys(target).forEach(k => { tokens[k] = target[k]; });
  // Mirror to <html> for the body background + system chrome
  if (typeof document !== 'undefined') {
    document.documentElement.style.background = tokens.bg;
    document.body.style.background = tokens.bg;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', themeName === 'dark' ? '#0F1411' : '#0F4A2E');
  }
}

function resolveTheme(pref) {
  if (pref === 'dark') return 'dark';
  if (pref === 'light') return 'light';
  // auto → use system preference
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

const fonts = {
  sans: '"Inter", -apple-system, system-ui, sans-serif',
  serif: '"Fraunces", "Cooper", Georgia, serif',
};

// ─────────────────────────────────────────────────────────────
// Mock product data
// ─────────────────────────────────────────────────────────────
const PRODUCTS = {
  apto: {
    name: 'Galletas María',
    brand: 'Adpan',
    barcode: '8412345 678901',
    image: '🍪',
    imgBg: '#E8DCC4',
    state: 'apto',
    title: 'Sin gluten',
    subtitle: 'Apto para celíacos',
    cert: 'Certificado FACE — Marca de Garantía',
    ingredients: [
      { name: 'Harina de arroz', risk: 'safe' },
      { name: 'Almidón de maíz', risk: 'safe' },
      { name: 'Azúcar', risk: 'safe' },
      { name: 'Aceite de girasol', risk: 'safe' },
      { name: 'Aroma natural de vainilla', risk: 'safe' },
      { name: 'Sal', risk: 'safe' },
    ],
    crossContamination: { level: 'low', text: 'Fabricado en planta dedicada sin gluten' },
    reports: { safe: 142, unsafe: 1 },
  },
  dudoso: {
    name: 'Salsa de soja clásica',
    brand: 'Kimura',
    barcode: '4901234 567890',
    image: '🍶',
    imgBg: '#D4C49A',
    state: 'dudoso',
    title: 'Precaución',
    subtitle: 'Puede contener trazas',
    cert: null,
    ingredients: [
      { name: 'Agua', risk: 'safe' },
      { name: 'Habas de soja', risk: 'safe' },
      { name: 'Trigo', risk: 'danger' },
      { name: 'Sal', risk: 'safe' },
      { name: 'Conservante (E202)', risk: 'safe' },
    ],
    crossContamination: { level: 'high', text: 'Contiene trigo como ingrediente' },
    reports: { safe: 4, unsafe: 38 },
  },
  noApto: {
    name: 'Cerveza Tostada',
    brand: 'Mahou Clásica',
    barcode: '8410123 456789',
    image: '🍺',
    imgBg: '#C8A557',
    state: 'noApto',
    title: 'No apto',
    subtitle: 'Contiene gluten',
    cert: null,
    ingredients: [
      { name: 'Agua', risk: 'safe' },
      { name: 'Malta de cebada', risk: 'danger' },
      { name: 'Lúpulo', risk: 'safe' },
      { name: 'Levadura', risk: 'safe' },
    ],
    crossContamination: { level: 'critical', text: 'Producto elaborado con cereales con gluten' },
    reports: { safe: 0, unsafe: 287 },
  },
};

const HISTORY_SEED = [
  { name: 'Yogur natural', brand: 'Danone', state: 'apto', emoji: '🥛', when: 'Hace 2 h' },
  { name: 'Pasta de lentejas', brand: 'Barilla', state: 'apto', emoji: '🍝', when: 'Ayer' },
  { name: 'Galletas Príncipe', brand: 'LU', state: 'noApto', emoji: '🍪', when: 'Ayer' },
  { name: 'Hummus tradicional', brand: 'Mercadona', state: 'dudoso', emoji: '🥣', when: 'Hace 2 d' },
];

// ─────────────────────────────────────────────────────────────
// History + Profile stores (localStorage-backed)
// ─────────────────────────────────────────────────────────────
const HISTORY_KEY = 'gz.history.v1';
const PROFILE_KEY = 'gz.profile.v1';

function relativeTime(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Hace un momento';
  if (m < 60) return `Hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'Ayer';
  if (d < 7) return `Hace ${d} d`;
  return new Date(ts).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

const historyStore = {
  load() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  },
  save(list) {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list)); } catch {}
  },
  add(product) {
    const list = historyStore.load();
    // Dedup by barcode (keep most recent)
    const filtered = list.filter(p => p.barcode !== product.barcode);
    const entry = {
      barcode: product.barcode,
      name: product.name,
      brand: product.brand,
      state: product.state,
      emoji: product.image,
      imageUrl: product.imageUrl || null,
      ts: Date.now(),
    };
    const next = [entry, ...filtered].slice(0, 200);
    historyStore.save(next);
    return next;
  },
  clear() { historyStore.save([]); },
};

const FAVORITES_KEY = 'glutenzero_favorites_v1';
const favoritesStore = {
  load() {
    try {
      const raw = localStorage.getItem(FAVORITES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  },
  save(list) {
    try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(list)); } catch {}
  },
  has(barcode) {
    if (!barcode) return false;
    return favoritesStore.load().some(p => p.barcode === barcode);
  },
  toggle(product) {
    if (!product || !product.barcode) return favoritesStore.load();
    const list = favoritesStore.load();
    const exists = list.some(p => p.barcode === product.barcode);
    let next;
    if (exists) {
      next = list.filter(p => p.barcode !== product.barcode);
    } else {
      const entry = {
        barcode: product.barcode,
        name: product.name,
        brand: product.brand,
        state: product.state,
        emoji: product.image,
        imageUrl: product.imageUrl || null,
        ts: Date.now(),
      };
      next = [entry, ...list].slice(0, 500);
    }
    favoritesStore.save(next);
    return next;
  },
  remove(barcode) {
    const next = favoritesStore.load().filter(p => p.barcode !== barcode);
    favoritesStore.save(next);
    return next;
  },
  clear() { favoritesStore.save([]); },
};

const profileStore = {
  load() {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },
  save(p) {
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch {}
  },
};

const PROFILE_DEFAULT = {
  name: '',
  sensitivity: 'celiac', // celiac | sensitive | choice
  warnTraces: true,
  warnDoubts: true,
  theme: 'auto', // auto | light | dark
  onboarded: false,
};

// ─────────────────────────────────────────────────────────────
// Reusable bits
// ─────────────────────────────────────────────────────────────
function StateBadge({ state, size = 'sm' }) {
  const cfg = {
    apto:    { bg: tokens.greenSoft, fg: tokens.greenDeep, label: 'Apto', dot: tokens.green },
    dudoso:  { bg: tokens.amberSoft, fg: '#7A4F0B',        label: 'Dudoso', dot: tokens.amber },
    noApto:  { bg: tokens.coralSoft, fg: '#7A1F12',        label: 'No apto', dot: tokens.coral },
  }[state];
  const padY = size === 'sm' ? 4 : 6;
  const padX = size === 'sm' ? 9 : 12;
  const fs = size === 'sm' ? 12 : 13;
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: cfg.bg, color: cfg.fg, padding: `${padY}px ${padX}px`,
      borderRadius: 999, fontSize: fs, fontWeight: 600,
      letterSpacing: -0.1,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: cfg.dot }} />
      {cfg.label}
    </div>
  );
}

function ProductTile({ product, onClick }) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px', background: tokens.surface,
      borderRadius: 16, cursor: 'pointer',
      border: `1px solid ${tokens.divider}`,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 11,
        background: '#F1EAD9', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        fontSize: 22, flexShrink: 0, overflow: 'hidden',
      }}>
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => {
              const span = document.createElement('span');
              span.style.fontSize = '22px';
              span.textContent = product.emoji || '📦';
              e.target.replaceWith(span);
            }}
          />
        ) : (product.emoji || '📦')}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 15, fontWeight: 600, color: tokens.ink,
          letterSpacing: -0.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{product.name}</div>
        <div style={{ fontSize: 13, color: tokens.inkMuted, marginTop: 1 }}>
          {product.brand} · {product.when}
        </div>
      </div>
      <StateBadge state={product.state} />
    </div>
  );
}

// Logo: stylized wheat with a slash
function GZLogo({ size = 28, color = tokens.greenDeep }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <path d="M16 4 C16 4, 16 12, 16 20" stroke={color} strokeWidth="2.4" strokeLinecap="round"/>
      <path d="M16 8 C12 8, 9 10, 9 13 C12 13, 15 11, 16 8 Z" fill={color}/>
      <path d="M16 8 C20 8, 23 10, 23 13 C20 13, 17 11, 16 8 Z" fill={color}/>
      <path d="M16 14 C12 14, 9 16, 9 19 C12 19, 15 17, 16 14 Z" fill={color}/>
      <path d="M16 14 C20 14, 23 16, 23 19 C20 19, 17 17, 16 14 Z" fill={color}/>
      <path d="M5 27 L27 5" stroke={tokens.coral} strokeWidth="2.6" strokeLinecap="round"/>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// Screen 1: HOME
// ─────────────────────────────────────────────────────────────
function HomeScreen({ onScan, userName = 'Lucía', recent = [] }) {
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';

  return (
    <div style={{
      paddingTop: 56, paddingBottom: 40,
      background: tokens.bg, minHeight: '100%',
      fontFamily: fonts.sans, color: tokens.ink,
    }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <GZLogo size={26} />
          <span style={{
            fontFamily: fonts.serif, fontSize: 22, fontWeight: 600,
            color: tokens.greenDeep, letterSpacing: -0.3,
          }}>GlutenZero</span>
        </div>
        <div style={{
          width: 36, height: 36, borderRadius: 999,
          background: tokens.greenSoft, color: tokens.greenDeep,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 600,
        }}>{(userName || '?').trim().charAt(0).toUpperCase() || '?'}</div>
      </div>

      {/* Greeting */}
      <div style={{ padding: '4px 20px 20px' }}>
        <div style={{ fontSize: 15, color: tokens.inkSoft, marginBottom: 4 }}>
          {greet}, {userName}
        </div>
        <h1 style={{
          fontFamily: fonts.serif, fontSize: 32, fontWeight: 500,
          margin: 0, lineHeight: 1.1, letterSpacing: -0.6,
          color: tokens.ink, textWrap: 'pretty',
        }}>
          ¿Qué vas a comer<br/><em style={{ fontStyle: 'italic', color: tokens.green }}>hoy?</em>
        </h1>
      </div>

      {/* Big scan CTA */}
      <div style={{ padding: '8px 20px 0' }}>
        <button onClick={onScan} style={{
          width: '100%', border: 'none', cursor: 'pointer',
          background: tokens.greenDeep, color: '#fff',
          borderRadius: 24, padding: '20px 22px',
          display: 'flex', alignItems: 'center', gap: 16,
          fontFamily: fonts.sans, textAlign: 'left',
          boxShadow: '0 8px 24px rgba(15,74,46,0.2), 0 2px 6px rgba(15,74,46,0.1)',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 18,
            background: 'rgba(255,255,255,0.14)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M3 9V6a3 3 0 013-3h3M25 9V6a3 3 0 00-3-3h-3M3 19v3a3 3 0 003 3h3M25 19v3a3 3 0 01-3 3h-3" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"/>
              <path d="M3 14h22" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: -0.2 }}>Escanear producto</div>
            <div style={{ fontSize: 13.5, opacity: 0.78, marginTop: 2 }}>
              Código de barras o etiqueta
            </div>
          </div>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M7 4l6 6-6 6" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Quick stats card */}
      <div style={{ padding: '14px 20px 0' }}>
        <div style={{
          background: tokens.surface, borderRadius: 20,
          padding: 16, display: 'flex',
          border: `1px solid ${tokens.divider}`,
        }}>
          <div style={{ flex: 1, paddingRight: 14 }}>
            <div style={{ fontSize: 12, color: tokens.inkMuted, fontWeight: 500, letterSpacing: 0.2, textTransform: 'uppercase' }}>Esta semana</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: tokens.ink, marginTop: 4, letterSpacing: -0.4 }}>
              23 <span style={{ fontSize: 13, fontWeight: 500, color: tokens.inkMuted }}>escaneos</span>
            </div>
          </div>
          <div style={{ width: 1, background: tokens.divider }} />
          <div style={{ flex: 1, paddingLeft: 14 }}>
            <div style={{ fontSize: 12, color: tokens.inkMuted, fontWeight: 500, letterSpacing: 0.2, textTransform: 'uppercase' }}>Aptos</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: tokens.green, marginTop: 4, letterSpacing: -0.4 }}>
              19 <span style={{ fontSize: 13, fontWeight: 500, color: tokens.inkMuted }}>· 83%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent scans */}
      <div style={{ padding: '24px 20px 0' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          marginBottom: 12,
        }}>
          <h2 style={{
            fontSize: 17, fontWeight: 600, margin: 0,
            color: tokens.ink, letterSpacing: -0.3,
          }}>Recientes</h2>
          <button style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 14, color: tokens.green, fontWeight: 500,
            fontFamily: fonts.sans,
          }}>Ver todo</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(recent.length ? recent : HISTORY_SEED).slice(0, 4).map((p, i) =>
            <ProductTile key={p.barcode || i} product={{ ...p, when: p.ts ? relativeTime(p.ts) : p.when }} />
          )}
        </div>
      </div>

      {/* Tip card */}
      <div style={{ padding: '24px 20px 0' }}>
        <div style={{
          background: tokens.greenSoft, borderRadius: 20,
          padding: 18, display: 'flex', gap: 14, alignItems: 'flex-start',
        }}>
          <div style={{
            fontSize: 24, lineHeight: 1, flexShrink: 0, marginTop: 2,
          }}>💡</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: tokens.greenDeep, letterSpacing: -0.1 }}>
              Sabías que…
            </div>
            <div style={{ fontSize: 13.5, color: tokens.inkSoft, marginTop: 4, lineHeight: 1.45, textWrap: 'pretty' }}>
              El trigo sarraceno no contiene gluten a pesar de su nombre. Es perfecto para hacer crepes y pasta.
            </div>
          </div>
        </div>
      </div>

      {/* Bottom tab nav */}
      <div style={{ height: 80 }} />
    </div>
  );
}

function BottomTabs({ active = 'home', onScan, onNavigate }) {
  const tabs = [
    { id: 'home', label: 'Inicio', icon: 'home' },
    { id: 'history', label: 'Historial', icon: 'list' },
    { id: 'scan', label: '', icon: 'scan' },
    { id: 'fav', label: 'Lugares', icon: 'map' },
    { id: 'profile', label: 'Perfil', icon: 'user' },
  ];

  const renderIcon = (icon, isActive) => {
    const c = isActive ? tokens.greenDeep : tokens.inkMuted;
    if (icon === 'home') return <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 11l8-7 8 7v9a1 1 0 01-1 1h-4v-6h-6v6H5a1 1 0 01-1-1v-9z" stroke={c} strokeWidth="2" strokeLinejoin="round"/></svg>;
    if (icon === 'list') return <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M4 12h16M4 17h10" stroke={c} strokeWidth="2" strokeLinecap="round"/></svg>;
    if (icon === 'map') return <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7z" stroke={c} strokeWidth="2" strokeLinejoin="round"/><circle cx="12" cy="9" r="2.5" stroke={c} strokeWidth="2"/></svg>;
    if (icon === 'heart') return <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z" stroke={c} strokeWidth="2" strokeLinejoin="round"/></svg>;
    if (icon === 'user') return <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke={c} strokeWidth="2"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke={c} strokeWidth="2" strokeLinecap="round"/></svg>;
    return null;
  };

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 40,
      paddingBottom: 24, paddingTop: 8,
      background: 'linear-gradient(180deg, rgba(246,241,232,0) 0%, rgba(246,241,232,0.95) 30%)',
    }}>
      <div style={{
        margin: '0 16px', background: tokens.surface,
        borderRadius: 999, height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        boxShadow: '0 4px 16px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)',
        border: `1px solid ${tokens.divider}`,
        position: 'relative',
      }}>
        {tabs.map(t => {
          if (t.id === 'scan') {
            return (
              <button key={t.id} onClick={onScan} style={{
                width: 56, height: 56, borderRadius: 999,
                background: tokens.greenDeep, border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(15,74,46,0.35)',
                transform: 'translateY(-2px)',
              }}>
                <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
                  <path d="M3 9V6a3 3 0 013-3h3M25 9V6a3 3 0 00-3-3h-3M3 19v3a3 3 0 003 3h3M25 19v3a3 3 0 01-3 3h-3" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"/>
                  <path d="M3 14h22" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"/>
                </svg>
              </button>
            );
          }
          const isActive = t.id === active;
          return (
            <button key={t.id} onClick={() => onNavigate && onNavigate(t.id)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              padding: '4px 8px', fontFamily: fonts.sans,
            }}>
              {renderIcon(t.icon, isActive)}
              <span style={{
                fontSize: 10.5, fontWeight: isActive ? 600 : 500,
                color: isActive ? tokens.greenDeep : tokens.inkMuted,
                letterSpacing: -0.1,
              }}>{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Screen 2: SCANNER — Cámara real (html5-qrcode) + Manual (OFF)
// ─────────────────────────────────────────────────────────────
function ScannerScreen({ onCancel, onLookup, onLookupText, mode, setMode }) {
  const [manualCode, setManualCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Manual sub-mode: code vs name
  const [manualMode, setManualMode] = useState('code'); // 'code' | 'name'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null); // null = no search yet, [] = no results
  const [searching, setSearching] = useState(false);

  // OCR state
  const [ocrPhase, setOcrPhase] = useState('idle'); // idle | starting | live | capturing | recognizing | done | error
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrError, setOcrError] = useState(null);
  const ocrVideoRef = useRef(null);
  const ocrStreamRef = useRef(null);
  const ocrFileRef = useRef(null);

  // Camera state
  const [camPhase, setCamPhase] = useState('init'); // init | requesting | running | denied | nocam | error | found
  const [camError, setCamError] = useState(null);
  const [foundCode, setFoundCode] = useState(null);
  const scannerRef = useRef(null);
  const containerIdRef = useRef('gz-camera-' + Math.random().toString(36).slice(2, 10));
  const containerId = containerIdRef.current;

  useEffect(() => {
    if (mode !== 'camera') return;
    let cancelled = false;

    const start = async () => {
      setCamPhase('requesting');
      setCamError(null);
      setFoundCode(null);

      // Comprobaciones previas para dar errores claros
      if (typeof window === 'undefined' || !window.isSecureContext) {
        setCamPhase('error');
        setCamError('La cámara requiere conexión segura (HTTPS).');
        return;
      }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCamPhase('error');
        setCamError('Tu navegador no permite acceso a la cámara desde esta vista. Prueba a abrir la app en Safari/Chrome en vez de la PWA instalada.');
        return;
      }

      // Cargar la librería bajo demanda (evita peso si el usuario no usa cámara)
      if (!window.Html5Qrcode) {
        try {
          await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
            s.onload = resolve;
            s.onerror = () => reject(new Error('script_load_failed'));
            document.head.appendChild(s);
          });
        } catch {
          if (!cancelled) { setCamPhase('error'); setCamError('No se pudo cargar el lector. Revisa tu conexión.'); }
          return;
        }
      }
      if (cancelled) return;

      try {
        // PRE-FLIGHT: pedir permiso primero con getUserMedia para forzar el prompt
        // y obtener el error real (html5-qrcode a veces lo enmascara)
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' } },
            audio: false,
          });
          // Cerramos el stream inmediatamente, html5-qrcode pedirá el suyo
          stream.getTracks().forEach(t => t.stop());
        } catch (preErr) {
          throw preErr; // propagamos al catch externo con el error real
        }

        // Esperar a que el contenedor exista y tenga tamaño antes de arrancar
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const containerEl = document.getElementById(containerId);
        if (!containerEl) throw new Error('container_missing');

        const html5Qrcode = new window.Html5Qrcode(containerId, { verbose: false });
        scannerRef.current = html5Qrcode;
        await html5Qrcode.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 260, height: 140 },
            aspectRatio: 1.7777,
            disableFlip: false,
          },
          async (decoded) => {
            if (cancelled || foundCode) return;
            // Solo aceptamos códigos numéricos largos (EAN/UPC)
            const code = String(decoded || '').replace(/\D/g, '');
            if (code.length < 8) return;
            setFoundCode(code);
            setCamPhase('found');
            // Vibrar si el dispositivo lo permite
            if (navigator.vibrate) try { navigator.vibrate(60); } catch {}
            // Parar la cámara antes de navegar
            try { await html5Qrcode.stop(); } catch {}
            try { await html5Qrcode.clear(); } catch {}
            scannerRef.current = null;
            // Lanzar consulta
            try { await onLookup(code); }
            catch (e) {
              if (cancelled) return;
              let msg = 'Error consultando el producto.';
              if (e.code === 'not_found') msg = `Código ${code} no está en Open Food Facts.`;
              else if (e.code === 'timeout') msg = 'La consulta tardó demasiado. Reintenta.';
              else if (e.code === 'network') msg = 'Sin conexión. Revisa Wi-Fi/datos.';
              setCamError(msg);
              setCamPhase('error');
            }
          },
          () => { /* errores de frame: ignorar, son normales */ }
        );
        if (!cancelled) setCamPhase('running');
      } catch (err) {
        if (cancelled) return;
        const name = (err && (err.name || '')) + '';
        const msg = (err && (err.message || err.toString && err.toString() || '')) + '';
        const ctor = err && err.constructor && err.constructor.name || '';
        const detail = name || ctor || 'Error';
        const text = msg && msg !== '[object Object]' ? msg : (err ? JSON.stringify(err).slice(0, 120) : 'sin detalle');
        if (/permission|notallowed|denied/i.test(name + ' ' + msg)) {
          setCamPhase('denied');
        } else if (/notfound|nocamera|devicesnotfound|overconstrained/i.test(name + ' ' + msg)) {
          setCamPhase('nocam');
        } else {
          setCamPhase('error');
          setCamError(`No se pudo iniciar la cámara (${detail}: ${text.slice(0, 140)}). Usa el modo Manual.`);
        }
      }
    };
    start();

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      if (s) {
        s.stop().then(() => s.clear()).catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [mode]);

  // ─── OCR: live camera for label mode ───────────────────────
  useEffect(() => {
    if (mode !== 'label') {
      // stop OCR camera if leaving
      const s = ocrStreamRef.current;
      if (s) { try { s.getTracks().forEach(t => t.stop()); } catch {} ocrStreamRef.current = null; }
      setOcrPhase('idle'); setOcrError(null); setOcrProgress(0);
      return;
    }
    let cancelled = false;
    (async () => {
      setOcrPhase('starting'); setOcrError(null);
      if (!window.isSecureContext) {
        setOcrError('La cámara requiere HTTPS.'); setOcrPhase('error'); return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setOcrError('Tu navegador no permite acceso a la cámara.'); setOcrPhase('error'); return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        ocrStreamRef.current = stream;
        const v = ocrVideoRef.current;
        if (v) {
          v.srcObject = stream;
          v.setAttribute('playsinline', 'true');
          v.muted = true;
          await v.play().catch(() => {});
        }
        if (!cancelled) setOcrPhase('live');
      } catch (err) {
        if (cancelled) return;
        const name = (err && (err.name || '')) + '';
        if (/permission|notallowed|denied/i.test(name)) setOcrError('Permiso de cámara denegado. Actívalo en los ajustes del navegador.');
        else if (/notfound|nocamera|devicesnotfound/i.test(name)) setOcrError('No hay cámara disponible.');
        else setOcrError('No se pudo iniciar la cámara. Prueba a subir una foto de la galería.');
        setOcrPhase('error');
      }
    })();
    return () => {
      cancelled = true;
      const s = ocrStreamRef.current;
      if (s) { try { s.getTracks().forEach(t => t.stop()); } catch {} ocrStreamRef.current = null; }
    };
  }, [mode]);

  const runOcr = async (source) => {
    if (!window.GZOCR) {
      setOcrError('Motor OCR no disponible.'); setOcrPhase('error'); return;
    }
    setOcrPhase('recognizing'); setOcrProgress(0); setOcrError(null);
    try {
      const { text } = await window.GZOCR.recognize(source, (m) => {
        if (m && m.status === 'recognizing text' && typeof m.progress === 'number') {
          setOcrProgress(Math.max(0, Math.min(100, m.progress * 100)));
        }
      });
      if (!text || text.replace(/\s/g, '').length < 6) {
        setOcrError('No se pudo leer texto. Acércate más o usa mejor luz.');
        setOcrPhase('error');
        return;
      }
      await onLookupText(text);
    } catch (e) {
      setOcrError('Error procesando la imagen. Inténtalo de nuevo.');
      setOcrPhase('error');
    }
  };

  const captureFromVideo = async () => {
    const v = ocrVideoRef.current;
    if (!v || !v.videoWidth) return;
    setOcrPhase('capturing');
    try {
      const canvas = window.GZOCR.captureFrame(v, 1280);
      await runOcr(canvas);
    } catch (e) {
      setOcrError('No se pudo capturar la imagen.');
      setOcrPhase('error');
    }
  };

  const handleFile = async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    e.target.value = '';
    try {
      // Preprocesado (escala de grises + contraste) para mejor OCR
      const canvas = await (window.GZOCR.enhanceFile
        ? window.GZOCR.enhanceFile(f, 1600)
        : Promise.resolve(f));
      await runOcr(canvas);
    } catch {
      await runOcr(f); // fallback: archivo bruto
    }
  };

  const submitManual = async (code) => {
    const c = (code || manualCode).trim();
    if (!c) return;
    setLoading(true); setError(null);
    try {
      await onLookup(c);
    } catch (e) {
      let msg = 'Error de red. ¿Tienes conexión?';
      if (e.code === 'not_found') msg = 'No encontrado en Open Food Facts. Prueba con otro código.';
      else if (e.code === 'timeout') msg = 'La consulta tardó demasiado. Reintenta con mejor señal.';
      else if (e.code === 'http') msg = `Error del servidor (${e.status}). Reintenta en unos segundos.`;
      else if (e.code === 'network') msg = 'Sin conexión a Open Food Facts. Revisa Wi-Fi/datos.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const submitSearch = async () => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setError('Escribe al menos 2 letras.');
      return;
    }
    setSearching(true); setError(null); setSearchResults(null);
    try {
      const items = await OFF.searchByName(q);
      setSearchResults(items);
    } catch (e) {
      let msg = 'No se pudo buscar.';
      if (e.code === 'timeout') msg = 'La búsqueda tardó demasiado. Reintenta.';
      else if (e.code === 'busy') msg = 'Open Food Facts está saturado ahora mismo. Reintenta en unos segundos o prueba con otra palabra.';
      else if (e.code === 'network') msg = `Error de conexión con Open Food Facts${e.detail ? ` (${e.detail.slice(0, 60)})` : ''}. Reintenta en unos segundos.`;
      else if (e.code === 'http') msg = `Open Food Facts no responde (${e.status}). Reintenta más tarde.`;
      else if (e.code === 'parse') msg = 'Respuesta inesperada del servidor.';
      else if (e.code === 'query_short') msg = 'Escribe al menos 2 letras.';
      setError(msg);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%',
      background: mode !== 'manual' ? '#0A0F0B' : tokens.bg,
      overflow: 'hidden', fontFamily: fonts.sans,
    }}>
      {/* Camera backdrop only when in camera mode and not yet running */}
      {mode === 'camera' && camPhase !== 'running' && camPhase !== 'found' && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          background: `radial-gradient(ellipse at 30% 30%, #2a3a2c 0%, transparent 50%), radial-gradient(ellipse at 70% 70%, #1f2820 0%, transparent 50%), linear-gradient(180deg, #0e140f 0%, #0a0f0b 100%)`,
        }} />
      )}

      {/* Top bar */}
      <div style={{
        position: 'absolute', top: 56, left: 0, right: 0, zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px',
      }}>
        <button onClick={onCancel} style={{
          width: 40, height: 40, borderRadius: 999,
          background: mode !== 'manual' ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.06)',
          border: 'none', cursor: 'pointer',
          backdropFilter: 'blur(20px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 2l10 10M12 2L2 12" stroke={mode !== 'manual' ? '#fff' : tokens.ink} strokeWidth="2.2" strokeLinecap="round"/>
          </svg>
        </button>

        <div style={{
          padding: '8px 14px', borderRadius: 999,
          background: mode !== 'manual' ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.06)',
          backdropFilter: 'blur(20px)',
          color: mode !== 'manual' ? '#fff' : tokens.ink, fontSize: 13, fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {mode === 'camera' ? (
            <>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: camPhase === 'found' ? '#5DD78A' : (camPhase === 'running' ? '#5DD78A' : '#F4C266'), boxShadow: '0 0 8px currentColor', animation: 'gz-pulse 1.4s ease-in-out infinite' }} />
              {camPhase === 'requesting' && 'Permiso de cámara…'}
              {camPhase === 'running' && 'Apunta al código'}
              {camPhase === 'found' && `Detectado · ${foundCode}`}
              {camPhase === 'denied' && 'Permiso denegado'}
              {camPhase === 'nocam' && 'Sin cámara'}
              {camPhase === 'error' && 'Error de cámara'}
              {camPhase === 'init' && 'Iniciando…'}
            </>
          ) : mode === 'label' ? (
            <>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: ocrPhase === 'recognizing' ? '#F4C266' : ocrPhase === 'live' ? '#5DD78A' : '#F4C266', boxShadow: '0 0 8px currentColor', animation: 'gz-pulse 1.4s ease-in-out infinite' }} />
              {ocrPhase === 'idle' && 'Toca para empezar'}
              {ocrPhase === 'starting' && 'Preparando cámara…'}
              {ocrPhase === 'live' && 'Encuadra los ingredientes'}
              {ocrPhase === 'capturing' && 'Capturando…'}
              {ocrPhase === 'recognizing' && `Leyendo texto · ${Math.round(ocrProgress)}%`}
              {ocrPhase === 'error' && 'Error de lectura'}
            </>
          ) : 'Introducir código manual'}
        </div>

        <div style={{ width: 40 }} />
      </div>

      {/* Mode toggle */}
      <div style={{
        position: 'absolute', top: 116, left: 0, right: 0, zIndex: 10,
        display: 'flex', justifyContent: 'center',
      }}>
        <div style={{
          background: mode !== 'manual' ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.06)',
          backdropFilter: 'blur(20px)',
          padding: 4, borderRadius: 999,
          display: 'flex', gap: 2,
          border: mode !== 'manual' ? '1px solid rgba(255,255,255,0.1)' : `1px solid ${tokens.divider}`,
        }}>
          {[
            { id: 'camera', label: 'Cámara' },
            { id: 'label', label: 'Etiqueta' },
            { id: 'manual', label: 'Manual' },
          ].map(m => (
            <button key={m.id} onClick={() => setMode(m.id)} style={{
              padding: '8px 16px', borderRadius: 999, border: 'none',
              background: mode === m.id ? '#fff' : 'transparent',
              color: mode === m.id ? tokens.greenDeep : (mode !== 'manual' ? 'rgba(255,255,255,0.85)' : tokens.inkSoft),
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              fontFamily: fonts.sans, letterSpacing: -0.1,
            }}>{m.label}</button>
          ))}
        </div>
      </div>

      {/* CAMERA video container */}
      {mode === 'camera' && (
        <>
          <div id={containerId} style={{
            position: 'absolute', inset: 0, zIndex: 1,
            background: '#000',
          }} />
          {/* Overlay: reticle */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 280, height: 180, zIndex: 5, pointerEvents: 'none',
          }}>
            {[
              { top: 0, left: 0, borders: 'tl' },
              { top: 0, right: 0, borders: 'tr' },
              { bottom: 0, left: 0, borders: 'bl' },
              { bottom: 0, right: 0, borders: 'br' },
            ].map((c, i) => {
              const b = c.borders;
              const stroke = camPhase === 'found' ? '#5DD78A' : '#fff';
              return (
                <div key={i} style={{
                  position: 'absolute', ...c, width: 32, height: 32,
                  borderTop: b.includes('t') ? `3px solid ${stroke}` : 'none',
                  borderBottom: b.includes('b') ? `3px solid ${stroke}` : 'none',
                  borderLeft: b.includes('l') ? `3px solid ${stroke}` : 'none',
                  borderRight: b.includes('r') ? `3px solid ${stroke}` : 'none',
                  borderTopLeftRadius: b === 'tl' ? 12 : 0,
                  borderTopRightRadius: b === 'tr' ? 12 : 0,
                  borderBottomLeftRadius: b === 'bl' ? 12 : 0,
                  borderBottomRightRadius: b === 'br' ? 12 : 0,
                  transition: 'border-color 0.3s',
                }} />
              );
            })}
            {camPhase === 'running' && (
              <div style={{
                position: 'absolute', left: 8, right: 8, top: '50%', height: 2,
                background: 'linear-gradient(90deg, transparent, #5DD78A, transparent)',
                boxShadow: '0 0 16px #5DD78A',
                animation: 'gz-scan 1.6s ease-in-out infinite',
              }} />
            )}
          </div>

          {/* Overlay: state message + manual fallback */}
          {(camPhase === 'denied' || camPhase === 'nocam' || camPhase === 'error') && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 8,
              background: 'rgba(10,15,11,0.9)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '0 32px', textAlign: 'center', color: '#fff',
            }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>
                {camPhase === 'denied' ? '🔒' : camPhase === 'nocam' ? '📷' : '⚠️'}
              </div>
              <h3 style={{ fontFamily: fonts.serif, fontSize: 22, margin: '0 0 8px', fontWeight: 500 }}>
                {camPhase === 'denied' && 'Necesitamos permiso de cámara'}
                {camPhase === 'nocam' && 'No hay cámara disponible'}
                {camPhase === 'error' && 'Algo ha ido mal'}
              </h3>
              <p style={{ fontSize: 14, opacity: 0.8, margin: '0 0 20px', lineHeight: 1.5 }}>
                {camPhase === 'denied' && 'Activa el permiso en los ajustes del navegador y vuelve a intentarlo.'}
                {camPhase === 'nocam' && 'Tu dispositivo no tiene cámara accesible.'}
                {camError || 'Usa el modo Manual para introducir el código a mano.'}
              </p>
              <button onClick={() => setMode('manual')} style={{
                padding: '12px 22px', borderRadius: 999, border: 'none', cursor: 'pointer',
                background: '#fff', color: tokens.greenDeep,
                fontSize: 14, fontWeight: 600, fontFamily: fonts.sans,
              }}>Usar entrada manual</button>
            </div>
          )}
        </>
      )}

      {/* OCR / LABEL mode */}
      {mode === 'label' && (
        <>
          <video
            ref={ocrVideoRef}
            playsInline
            muted
            style={{
              position: 'absolute', inset: 0, zIndex: 1,
              width: '100%', height: '100%', objectFit: 'cover',
              background: '#000',
            }}
          />
          {/* Reticle */}
          <div style={{
            position: 'absolute', top: '52%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '78%', maxWidth: 360, height: 220, zIndex: 5, pointerEvents: 'none',
          }}>
            {[
              { top: 0, left: 0, b: 'tl' }, { top: 0, right: 0, b: 'tr' },
              { bottom: 0, left: 0, b: 'bl' }, { bottom: 0, right: 0, b: 'br' },
            ].map((c, i) => {
              const b = c.b;
              return (
                <div key={i} style={{
                  position: 'absolute', ...c, width: 36, height: 36,
                  borderTop: b.includes('t') ? '3px solid #fff' : 'none',
                  borderBottom: b.includes('b') ? '3px solid #fff' : 'none',
                  borderLeft: b.includes('l') ? '3px solid #fff' : 'none',
                  borderRight: b.includes('r') ? '3px solid #fff' : 'none',
                  borderTopLeftRadius: b === 'tl' ? 14 : 0,
                  borderTopRightRadius: b === 'tr' ? 14 : 0,
                  borderBottomLeftRadius: b === 'bl' ? 14 : 0,
                  borderBottomRightRadius: b === 'br' ? 14 : 0,
                }} />
              );
            })}
            <div style={{
              position: 'absolute', bottom: -34, left: 0, right: 0,
              textAlign: 'center', color: '#fff', fontSize: 13,
              textShadow: '0 1px 4px rgba(0,0,0,0.7)', letterSpacing: -0.1,
            }}>Encuadra la lista de <b>Ingredientes</b></div>
          </div>

          {/* Error overlay */}
          {ocrPhase === 'error' && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 8,
              background: 'rgba(10,15,11,0.92)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '0 32px', textAlign: 'center', color: '#fff',
            }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
              <h3 style={{ fontFamily: fonts.serif, fontSize: 22, margin: '0 0 8px', fontWeight: 500 }}>No se pudo leer</h3>
              <p style={{ fontSize: 14, opacity: 0.8, margin: '0 0 20px', lineHeight: 1.5 }}>{ocrError}</p>
              <button onClick={() => { setOcrPhase('live'); setOcrError(null); }} style={{
                padding: '12px 22px', borderRadius: 999, border: 'none', cursor: 'pointer',
                background: '#fff', color: tokens.greenDeep,
                fontSize: 14, fontWeight: 600, fontFamily: fonts.sans,
              }}>Reintentar</button>
            </div>
          )}

          {/* Recognizing overlay */}
          {ocrPhase === 'recognizing' && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 8,
              background: 'rgba(10,15,11,0.85)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '0 40px', textAlign: 'center', color: '#fff',
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: 999,
                border: '3px solid rgba(255,255,255,0.15)', borderTopColor: '#5DD78A',
                animation: 'gz-spin 1s linear infinite', marginBottom: 18,
              }} />
              <div style={{ fontFamily: fonts.serif, fontSize: 22, margin: '0 0 6px', fontWeight: 500 }}>Leyendo etiqueta</div>
              <div style={{ fontSize: 14, opacity: 0.7 }}>{Math.round(ocrProgress)}%</div>
              <div style={{
                width: 200, height: 4, marginTop: 14, borderRadius: 999,
                background: 'rgba(255,255,255,0.15)', overflow: 'hidden',
              }}>
                <div style={{
                  width: `${ocrProgress}%`, height: '100%',
                  background: '#5DD78A', transition: 'width 0.2s',
                }} />
              </div>
            </div>
          )}

          {/* Bottom controls */}
          {(ocrPhase === 'live' || ocrPhase === 'starting' || ocrPhase === 'capturing') && (
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10,
              background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.75) 60%)',
              padding: '60px 24px 40px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
            }}>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12.5, textAlign: 'center', lineHeight: 1.4, marginBottom: 4 }}>
                Asegúrate de que el texto esté nítido y bien iluminado
              </div>
              <button
                onClick={captureFromVideo}
                disabled={ocrPhase !== 'live'}
                aria-label="Capturar etiqueta"
                style={{
                  width: 76, height: 76, borderRadius: 999,
                  border: '4px solid rgba(255,255,255,0.4)',
                  background: '#fff', cursor: ocrPhase === 'live' ? 'pointer' : 'wait',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
                  opacity: ocrPhase === 'live' ? 1 : 0.5,
                }}>
                <div style={{ width: 56, height: 56, borderRadius: 999, background: tokens.greenDeep }} />
              </button>
              <button
                onClick={() => ocrFileRef.current && ocrFileRef.current.click()}
                style={{
                  background: 'rgba(255,255,255,0.16)', border: 'none',
                  color: '#fff', padding: '10px 18px', borderRadius: 999,
                  fontSize: 13.5, fontWeight: 500, cursor: 'pointer',
                  fontFamily: fonts.sans, letterSpacing: -0.1,
                  backdropFilter: 'blur(20px)',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <rect x="2" y="3" width="12" height="10" rx="1.5"/>
                  <circle cx="6" cy="7" r="1.3"/>
                  <path d="M14 11l-3-3-5 5"/>
                </svg>
                Subir foto desde galería
              </button>
              <input
                ref={ocrFileRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFile}
                style={{ display: 'none' }}
              />
            </div>
          )}
        </>
      )}

      {/* MANUAL form */}
      {mode === 'manual' && (
        <div style={{
          position: 'absolute', top: 180, left: 0, right: 0, bottom: 0,
          padding: '0 24px', overflow: 'auto',
        }}>
          {/* Sub-toggle: Código / Nombre */}
          <div style={{
            display: 'flex', gap: 6, padding: 4,
            background: tokens.divider, borderRadius: 999,
            margin: '20px 0 18px',
          }}>
            {[
              { id: 'code', label: 'Por código' },
              { id: 'name', label: 'Por nombre' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => { setManualMode(t.id); setError(null); }}
                style={{
                  flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer',
                  background: manualMode === t.id ? '#fff' : 'transparent',
                  color: manualMode === t.id ? tokens.greenDeep : tokens.inkSoft,
                  borderRadius: 999, fontSize: 14, fontWeight: 600,
                  fontFamily: fonts.sans, letterSpacing: -0.1,
                  boxShadow: manualMode === t.id ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                }}>{t.label}</button>
            ))}
          </div>

          {manualMode === 'code' && (
            <>
              <h2 style={{
                fontFamily: fonts.serif, fontSize: 24, fontWeight: 500,
                margin: '0 0 4px', color: tokens.ink, letterSpacing: -0.4, lineHeight: 1.15,
              }}>Introduce el código de barras</h2>
              <p style={{
                margin: '0 0 18px', fontSize: 14, color: tokens.inkSoft, lineHeight: 1.45,
              }}>El número largo bajo las rayas. Consultaremos Open Food Facts.</p>

              <input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                value={manualCode}
                onChange={e => { setManualCode(e.target.value); setError(null); }}
                onKeyDown={e => { if (e.key === 'Enter') submitManual(); }}
                placeholder="8410188012108"
                style={{
                  width: '100%', height: 56, borderRadius: 14,
                  border: `1.5px solid ${error ? tokens.coral : tokens.divider}`,
                  background: tokens.surface, padding: '0 16px',
                  fontSize: 18, fontFamily: 'ui-monospace, monospace',
                  color: tokens.ink, letterSpacing: 0.5, outline: 'none',
                  boxSizing: 'border-box',
                }}
              />

              {error && (
                <div style={{
                  marginTop: 10, fontSize: 13.5, color: tokens.coral,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <span>⚠️</span> {error}
                </div>
              )}

              <button onClick={() => submitManual()} disabled={loading || !manualCode.trim()} style={{
                width: '100%', height: 54, marginTop: 14, border: 'none', cursor: loading ? 'wait' : 'pointer',
                background: (!manualCode.trim() || loading) ? tokens.inkMuted : tokens.greenDeep,
                color: '#fff', borderRadius: 14, fontSize: 16, fontWeight: 600,
                fontFamily: fonts.sans, letterSpacing: -0.2,
                opacity: loading ? 0.7 : 1,
              }}>
                {loading ? 'Consultando…' : 'Comprobar producto'}
              </button>

              <div style={{ marginTop: 28 }}>
                <div style={{
                  fontSize: 12, fontWeight: 600, color: tokens.inkMuted,
                  textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10,
                }}>Pruébalo con</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {SAMPLE_BARCODES.map(s => (
                    <button key={s.code} onClick={() => { setManualCode(s.code); submitManual(s.code); }} style={{
                      background: tokens.surface, border: `1px solid ${tokens.divider}`,
                      borderRadius: 14, padding: '12px 14px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
                      fontFamily: fonts.sans,
                    }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: tokens.greenSoft, color: tokens.greenDeep,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                          <path d="M2 4v10M5 4v10M8 4v10M11 4v10M14 4v10M16 4v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14.5, fontWeight: 600, color: tokens.ink, letterSpacing: -0.2 }}>{s.label}</div>
                        <div style={{ fontSize: 12, color: tokens.inkMuted, marginTop: 1 }}>{s.hint} · {s.code}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {manualMode === 'name' && (
            <>
              <h2 style={{
                fontFamily: fonts.serif, fontSize: 24, fontWeight: 500,
                margin: '0 0 4px', color: tokens.ink, letterSpacing: -0.4, lineHeight: 1.15,
              }}>Buscar por nombre</h2>
              <p style={{
                margin: '0 0 18px', fontSize: 14, color: tokens.inkSoft, lineHeight: 1.45,
              }}>Útil si el código está dañado o no tienes el producto delante.</p>

              <div style={{ position: 'relative' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={tokens.inkMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{
                  position: 'absolute', top: 19, left: 14,
                }}>
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setError(null); }}
                  onKeyDown={e => { if (e.key === 'Enter') submitSearch(); }}
                  placeholder="nutella, hummus, galletas..."
                  style={{
                    width: '100%', height: 56, borderRadius: 14,
                    border: `1.5px solid ${error ? tokens.coral : tokens.divider}`,
                    background: tokens.surface, padding: '0 16px 0 42px',
                    fontSize: 16, color: tokens.ink, outline: 'none',
                    fontFamily: fonts.sans, boxSizing: 'border-box',
                  }}
                />
              </div>

              {error && (
                <div style={{
                  marginTop: 10, fontSize: 13.5, color: tokens.coral,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <span>⚠️</span> {error}
                </div>
              )}

              <button onClick={() => submitSearch()} disabled={searching || searchQuery.trim().length < 2} style={{
                width: '100%', height: 54, marginTop: 14, border: 'none', cursor: searching ? 'wait' : 'pointer',
                background: (searchQuery.trim().length < 2 || searching) ? tokens.inkMuted : tokens.greenDeep,
                color: '#fff', borderRadius: 14, fontSize: 16, fontWeight: 600,
                fontFamily: fonts.sans, letterSpacing: -0.2,
                opacity: searching ? 0.7 : 1,
              }}>
                {searching ? 'Buscando…' : 'Buscar'}
              </button>

              {/* Results */}
              {searchResults !== null && (
                <div style={{ marginTop: 24 }}>
                  <div style={{
                    fontSize: 12, fontWeight: 600, color: tokens.inkMuted,
                    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10,
                  }}>
                    {searchResults.length === 0 ? 'Sin resultados' : `${searchResults.length} resultado${searchResults.length === 1 ? '' : 's'}`}
                  </div>

                  {searchResults.length === 0 ? (
                    <div style={{
                      background: tokens.surface, borderRadius: 16, padding: '24px 20px',
                      border: `1px solid ${tokens.divider}`,
                      textAlign: 'center', color: tokens.inkMuted,
                      fontSize: 14, lineHeight: 1.5,
                    }}>
                      Prueba con otro término o introduce el código de barras directamente.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {searchResults.map((r) => {
                        const stateColor =
                          r.quickState === 'apto' ? tokens.green :
                          r.quickState === 'dudoso' ? tokens.amber :
                          r.quickState === 'noApto' ? tokens.coral : tokens.inkMuted;
                        const stateLabel =
                          r.quickState === 'apto' ? 'Apto' :
                          r.quickState === 'dudoso' ? 'Trazas' :
                          r.quickState === 'noApto' ? 'No apto' : '?';
                        return (
                          <button
                            key={r.code}
                            onClick={() => submitManual(r.code)}
                            style={{
                              background: tokens.surface, border: `1px solid ${tokens.divider}`,
                              borderRadius: 14, padding: '10px 12px', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
                              fontFamily: fonts.sans,
                            }}>
                            <div style={{
                              width: 48, height: 48, borderRadius: 12,
                              background: '#F1EAD9', flexShrink: 0, overflow: 'hidden',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              {r.image ? (
                                <img src={r.image} alt="" style={{
                                  width: '100%', height: '100%', objectFit: 'cover',
                                }} onError={(e) => { e.target.style.display = 'none'; }} />
                              ) : (
                                <span style={{ fontSize: 22 }}>📦</span>
                              )}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{
                                fontSize: 14.5, fontWeight: 600, color: tokens.ink,
                                letterSpacing: -0.2, lineHeight: 1.2,
                                overflow: 'hidden', textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}>{r.name}</div>
                              <div style={{
                                fontSize: 12, color: tokens.inkMuted, marginTop: 2,
                                overflow: 'hidden', textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}>{r.brand || '—'}</div>
                            </div>
                            {r.quickState && (
                              <span style={{
                                flexShrink: 0,
                                fontSize: 11, fontWeight: 600, color: stateColor,
                                letterSpacing: 0.2,
                                padding: '4px 8px', borderRadius: 999,
                                background: stateColor + '20',
                              }}>{stateLabel}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* CAMERA bottom panel */}
      {mode === 'camera' && camPhase !== 'denied' && camPhase !== 'nocam' && camPhase !== 'error' && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10,
          background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.7) 50%)',
          padding: '80px 24px 50px',
        }}>
          <div style={{ textAlign: 'center', color: '#fff', fontSize: 15, fontWeight: 500, marginBottom: 8, letterSpacing: -0.2 }}>
            {camPhase === 'found'
              ? '¡Listo! Consultando…'
              : camPhase === 'running'
                ? 'Centra el código de barras en el recuadro'
                : 'Preparando cámara…'}
          </div>
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.55)', fontSize: 12, lineHeight: 1.45 }}>
            ¿No detecta? Usa el modo Manual.
          </div>
        </div>
      )}

      <style>{`
        @keyframes gz-scan {
          0% { transform: translateY(-70px); opacity: 0; }
          15% { opacity: 1; } 85% { opacity: 1; }
          100% { transform: translateY(70px); opacity: 0; }
        }
        @keyframes gz-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
        @keyframes gz-spin {
          to { transform: rotate(360deg); }
        }
        #${containerId} video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Screen 3: RESULT
// ─────────────────────────────────────────────────────────────
function ResultScreen({ product, onClose, onScanAgain, isFavorite, onToggleFavorite }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, [product.state]);

  const cfg = {
    apto: {
      bg: tokens.green, bgDeep: tokens.greenDeep,
      accent: '#5DD78A', soft: tokens.greenSoft,
      icon: 'check',
      headline: '¡Puedes comerlo!',
    },
    dudoso: {
      bg: tokens.amber, bgDeep: '#9A6710',
      accent: '#F4C266', soft: tokens.amberSoft,
      icon: 'warn',
      headline: 'Mejor evítalo',
    },
    noApto: {
      bg: tokens.coral, bgDeep: '#9A2D1F',
      accent: '#F2766A', soft: tokens.coralSoft,
      icon: 'cross',
      headline: 'No es apto',
    },
  }[product.state];

  const renderIcon = () => {
    if (cfg.icon === 'check') return (
      <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
        <path d="M14 28l10 10 18-20" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
    if (cfg.icon === 'warn') return (
      <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
        <path d="M28 14v18" stroke="#fff" strokeWidth="5" strokeLinecap="round"/>
        <circle cx="28" cy="42" r="3" fill="#fff"/>
      </svg>
    );
    return (
      <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
        <path d="M16 16l24 24M40 16L16 40" stroke="#fff" strokeWidth="5" strokeLinecap="round"/>
      </svg>
    );
  };

  return (
    <div style={{
      width: '100%', height: '100%', overflow: 'auto',
      background: tokens.bg, fontFamily: fonts.sans,
      color: tokens.ink,
    }}>
      {/* Hero verdict */}
      <div style={{
        background: cfg.bgDeep,
        padding: '64px 24px 40px',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Close button */}
        <button onClick={onClose} style={{
          position: 'absolute', top: 56, right: 16, zIndex: 5,
          width: 36, height: 36, borderRadius: 999,
          background: 'rgba(255,255,255,0.18)', border: 'none', cursor: 'pointer',
          backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <path d="M2 2l10 10M12 2L2 12" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"/>
          </svg>
        </button>

        {/* Decorative blob */}
        <div style={{
          position: 'absolute', top: -80, right: -80,
          width: 240, height: 240, borderRadius: 999,
          background: cfg.accent, opacity: 0.15,
        }} />

        {/* Icon */}
        <div style={{
          width: 96, height: 96, borderRadius: 999,
          background: 'rgba(255,255,255,0.18)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 22,
          transform: mounted ? 'scale(1)' : 'scale(0.6)',
          opacity: mounted ? 1 : 0,
          transition: 'all 0.4s cubic-bezier(.34,1.56,.64,1)',
        }}>
          {renderIcon()}
        </div>

        {/* Headline */}
        <h1 style={{
          fontFamily: fonts.serif, fontSize: 40, fontWeight: 500,
          margin: 0, color: '#fff', lineHeight: 1.05,
          letterSpacing: -0.8,
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(8px)',
          transition: 'all 0.5s ease 0.1s',
        }}>{cfg.headline}</h1>

        <div style={{
          fontSize: 16, color: 'rgba(255,255,255,0.82)',
          marginTop: 8, fontWeight: 400, letterSpacing: -0.1,
          opacity: mounted ? 1 : 0,
          transition: 'opacity 0.5s ease 0.2s',
        }}>{product.subtitle}</div>
      </div>

      {/* Product card */}
      <div style={{ padding: '0 16px', marginTop: -28, position: 'relative', zIndex: 2 }}>
        <div style={{
          background: tokens.surface, borderRadius: 22,
          padding: 18, display: 'flex', gap: 14, alignItems: 'center',
          boxShadow: '0 8px 24px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <div style={{
            width: 68, height: 68, borderRadius: 16,
            background: product.imgBg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 34, flexShrink: 0, overflow: 'hidden',
          }}>
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => { e.target.style.display = 'none'; e.target.parentNode.textContent = product.image; }}
              />
            ) : product.image}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 17, fontWeight: 600, color: tokens.ink,
              letterSpacing: -0.3,
            }}>{product.name}</div>
            <div style={{ fontSize: 14, color: tokens.inkMuted, marginTop: 2 }}>
              {product.brand}
            </div>
            {product.source === 'ocr' ? (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: 11.5, color: tokens.greenDeep, marginTop: 8,
                background: tokens.greenSoft, padding: '4px 8px', borderRadius: 999,
                fontWeight: 600, letterSpacing: 0.1,
              }}>
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <rect x="2" y="4" width="12" height="9" rx="1.5"/>
                  <path d="M5 4V3a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1"/>
                </svg>
                Leído de etiqueta
              </div>
            ) : (
              <div style={{
                fontSize: 11.5, color: tokens.inkMuted, marginTop: 6,
                fontFamily: 'ui-monospace, monospace', letterSpacing: 0.4,
              }}>{product.barcode}</div>
            )}
          </div>
        </div>
      </div>

      {/* Certification (apto only) */}
      {product.cert && (
        <div style={{ padding: '14px 16px 0' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: tokens.greenSoft, padding: '12px 16px',
            borderRadius: 14, color: tokens.greenDeep,
          }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 2l2 1.5 2.5-.5 1 2.4 2.2 1.3-.6 2.5L18 11.5l-1.4 2.1.6 2.5-2.2 1.3-1 2.4-2.5-.5L10 20.5l-1.5-1.5-2.5.5-1-2.4-2.2-1.3.6-2.5L2 11.5l1.4-2.1-.6-2.5 2.2-1.3 1-2.4 2.5.5L10 2z" fill="currentColor" opacity="0.15"/>
              <path d="M6 10l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={{ fontSize: 13, fontWeight: 500, letterSpacing: -0.1 }}>
              {product.cert}
            </span>
          </div>
        </div>
      )}

      {/* Ingredients */}
      <div style={{ padding: '24px 20px 0' }}>
        <h2 style={{
          fontSize: 13, fontWeight: 600, margin: '0 0 12px',
          color: tokens.inkMuted, textTransform: 'uppercase',
          letterSpacing: 0.6,
        }}>{product.source === 'ocr' && (!product.ingredients || product.ingredients.length === 0)
          ? 'Texto leído de la foto'
          : 'Ingredientes detectados'}</h2>

        {product.source === 'ocr' && (!product.ingredients || product.ingredients.length === 0) ? (
          <div style={{
            background: tokens.surface, borderRadius: 16, padding: 16,
            border: `1px solid ${tokens.divider}`,
          }}>
            <div style={{
              fontSize: 13, color: tokens.inkSoft, lineHeight: 1.5,
              fontFamily: 'ui-monospace, "SF Mono", monospace',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              maxHeight: 200, overflow: 'auto',
            }}>{product.ocrText || '—'}</div>
            <div style={{
              marginTop: 10, fontSize: 12, color: tokens.inkMuted, lineHeight: 1.45,
            }}>
              Este es el texto que hemos leído. Si está ilegible, vuelve a capturar la etiqueta con mejor luz y enfoque.
            </div>
          </div>
        ) : (
          <div style={{
          background: tokens.surface, borderRadius: 16,
          border: `1px solid ${tokens.divider}`, overflow: 'hidden',
        }}>
          {product.ingredients.map((ing, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 16px',
              borderBottom: i < product.ingredients.length - 1 ? `1px solid ${tokens.divider}` : 'none',
              background: ing.risk === 'danger' ? tokens.coralSoft : 'transparent',
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: 999,
                background: ing.risk === 'danger' ? tokens.coral : tokens.green,
                flexShrink: 0,
              }} />
              <span style={{
                flex: 1, fontSize: 15,
                color: ing.risk === 'danger' ? '#7A1F12' : tokens.ink,
                fontWeight: ing.risk === 'danger' ? 600 : 400,
                letterSpacing: -0.2,
              }}>{ing.name}</span>
              {ing.risk === 'danger' && (
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  color: tokens.coral, textTransform: 'uppercase', letterSpacing: 0.4,
                }}>Gluten</span>
              )}
            </div>
          ))}
        </div>
        )}
      </div>

      {/* Cross-contamination */}
      <div style={{ padding: '20px 20px 0' }}>
        <h2 style={{
          fontSize: 13, fontWeight: 600, margin: '0 0 12px',
          color: tokens.inkMuted, textTransform: 'uppercase',
          letterSpacing: 0.6,
        }}>Contaminación cruzada</h2>
        <div style={{
          background: tokens.surface, borderRadius: 16, padding: 16,
          border: `1px solid ${tokens.divider}`,
          display: 'flex', gap: 12, alignItems: 'flex-start',
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: 9, flexShrink: 0,
            background: product.crossContamination.level === 'low' ? tokens.greenSoft :
                        product.crossContamination.level === 'high' ? tokens.amberSoft :
                        tokens.coralSoft,
            color: product.crossContamination.level === 'low' ? tokens.greenDeep :
                   product.crossContamination.level === 'high' ? '#7A4F0B' :
                   '#7A1F12',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 2v6M8 11v.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14.5, color: tokens.ink, lineHeight: 1.45, letterSpacing: -0.1, textWrap: 'pretty' }}>
              {product.crossContamination.text}
            </div>
          </div>
        </div>
      </div>

      {/* Community reports */}
      <div style={{ padding: '20px 20px 0' }}>
        <h2 style={{
          fontSize: 13, fontWeight: 600, margin: '0 0 12px',
          color: tokens.inkMuted, textTransform: 'uppercase',
          letterSpacing: 0.6,
        }}>Reportes de la comunidad</h2>
        <div style={{
          background: tokens.surface, borderRadius: 16, padding: 16,
          border: `1px solid ${tokens.divider}`,
        }}>
          {/* Bar */}
          <div style={{
            display: 'flex', height: 8, borderRadius: 999, overflow: 'hidden',
            background: tokens.divider, marginBottom: 12,
          }}>
            <div style={{
              width: `${(product.reports.safe / (product.reports.safe + product.reports.unsafe)) * 100}%`,
              background: tokens.green, transition: 'width 0.5s',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: tokens.green, fontWeight: 500 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: tokens.green }} />
              {product.reports.safe} sin problemas
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: tokens.coral, fontWeight: 500 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: tokens.coral }} />
              {product.reports.unsafe} se intoxicaron
            </div>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div style={{ padding: '20px 20px 0' }}>
        <div style={{
          fontSize: 11.5, color: tokens.inkMuted, lineHeight: 1.5,
          textAlign: 'center', padding: '0 8px',
        }}>
          GlutenZero ofrece información orientativa. Consulta siempre la etiqueta oficial y tu profesional sanitario.
        </div>
      </div>

      {/* Actions */}
      <div style={{
        padding: '24px 20px 40px',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <button onClick={onScanAgain} style={{
          height: 54, borderRadius: 16, border: 'none', cursor: 'pointer',
          background: tokens.greenDeep, color: '#fff',
          fontSize: 16, fontWeight: 600, fontFamily: fonts.sans,
          letterSpacing: -0.2,
          boxShadow: '0 4px 14px rgba(15,74,46,0.2)',
        }}>Escanear otro</button>
        <button onClick={onToggleFavorite} style={{
          height: 50, borderRadius: 16, cursor: 'pointer',
          background: isFavorite ? tokens.greenSoft : 'transparent',
          color: isFavorite ? tokens.greenDeep : tokens.ink,
          border: `1px solid ${isFavorite ? tokens.greenDeep : tokens.divider}`,
          fontSize: 15, fontWeight: 500, fontFamily: fonts.sans,
          letterSpacing: -0.2,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill={isFavorite ? 'currentColor' : 'none'}>
            <path d="M8 14s-5-3.2-5-7a3 3 0 0 1 5-2.2A3 3 0 0 1 13 7c0 3.8-5 7-5 7z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
          </svg>
          {isFavorite ? 'En favoritos' : 'Guardar en favoritos'}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Screen: RESTAURANTS — mapa con OSM + lugares "diet:gluten_free=yes"
// ─────────────────────────────────────────────────────────────
function RestaurantsScreen({ favorites = [], onOpenProduct }) {
  const [phase, setPhase] = useState('idle'); // idle | locating | loading | ready | error
  const [errorMsg, setErrorMsg] = useState(null);
  const [places, setPlaces] = useState([]);
  const [center, setCenter] = useState(null);
  const [selected, setSelected] = useState(null);
  const [radius, setRadius] = useState(2500);
  const [showOnlyRecommended, setShowOnlyRecommended] = useState(false);
  const [showFavoritesPanel, setShowFavoritesPanel] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0); // for note edits

  const mapRef = useRef(null);
  const mapElRef = useRef(null);
  const markersRef = useRef({});
  const meMarkerRef = useRef(null);

  const userNotes = (window.GZPlaces ? window.GZPlaces.listAll() : []);
  const userNotesById = userNotes.reduce((acc, n) => { acc[n.id] = n; return acc; }, {});

  // Initial: ask location + fetch
  const locateAndLoad = async () => {
    setPhase('locating');
    setErrorMsg(null);
    try {
      const loc = await window.GZOSM.getLocation();
      setCenter(loc);
      await loadPlaces(loc, radius);
    } catch (e) {
      let msg = 'No se pudo obtener tu ubicación.';
      if (e.code === 'geo_denied') msg = 'Has rechazado el permiso de ubicación. Actívalo en los ajustes del navegador.';
      else if (e.code === 'geo_unavailable') msg = 'Tu dispositivo no permite la ubicación.';
      else if (e.code === 'geo_timeout') msg = 'La ubicación tardó demasiado.';
      setErrorMsg(msg);
      setPhase('error');
    }
  };

  const loadPlaces = async (loc, r) => {
    setPhase('loading');
    setErrorMsg(null);
    try {
      const list = await window.GZOSM.findGlutenFreePlaces({ lat: loc.lat, lon: loc.lon, radius: r });
      // Sort by distance
      list.forEach(p => { p.distance = window.GZOSM.distance(loc, p); });
      list.sort((a, b) => a.distance - b.distance);
      setPlaces(list);
      setPhase('ready');
    } catch (e) {
      setErrorMsg(`No se pudieron cargar los restaurantes${e.detail ? ` (${e.detail.slice(0, 60)})` : ''}. Reintenta en unos segundos.`);
      setPhase('error');
    }
  };

  // Init Leaflet once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const L = await window.GZOSM.loadLeaflet();
        if (cancelled || !mapElRef.current) return;
        if (!mapRef.current) {
          const m = L.map(mapElRef.current, {
            zoomControl: true,
            attributionControl: true,
          }).setView([40.4168, -3.7038], 13); // Madrid as default
          L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap',
          }).addTo(m);
          mapRef.current = m;
        }
        // Trigger initial fetch
        if (phase === 'idle') locateAndLoad();
      } catch (e) {
        setErrorMsg('No se pudo cargar el mapa.');
        setPhase('error');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Re-render markers when places change
  useEffect(() => {
    const L = window.L;
    const m = mapRef.current;
    if (!L || !m) return;

    // Clear previous
    Object.values(markersRef.current).forEach(mk => m.removeLayer(mk));
    markersRef.current = {};

    // Center on user
    if (center) {
      const ll = [center.lat, center.lon];
      m.setView(ll, 14);
      if (meMarkerRef.current) m.removeLayer(meMarkerRef.current);
      meMarkerRef.current = L.circleMarker(ll, {
        radius: 8, color: '#1f6feb', weight: 3, fillColor: '#3b82f6', fillOpacity: 0.6,
      }).addTo(m);
    }

    // Add place markers (apply filter)
    const filtered = showOnlyRecommended
      ? places.filter(p => userNotesById[p.id]?.recommended)
      : places;

    filtered.forEach(p => {
      const isRec = userNotesById[p.id]?.recommended;
      const color = isRec ? '#0F4A2E' : '#1F7A4D';
      const icon = L.divIcon({
        html: `<div style="
          width:28px;height:28px;border-radius:50% 50% 50% 0;
          background:${color};transform:rotate(-45deg);
          border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);
          display:flex;align-items:center;justify-content:center;
        "><div style="transform:rotate(45deg);color:#fff;font-size:12px;font-weight:700;">${isRec ? '★' : '✓'}</div></div>`,
        className: '',
        iconSize: [28, 28], iconAnchor: [14, 28], popupAnchor: [0, -28],
      });
      const mk = L.marker([p.lat, p.lon], { icon }).addTo(m);
      mk.on('click', () => setSelected(p));
      markersRef.current[p.id] = mk;
    });

    // Fit bounds if there are places
    if (filtered.length && center) {
      const bounds = L.latLngBounds(filtered.map(p => [p.lat, p.lon]));
      bounds.extend([center.lat, center.lon]);
      m.fitBounds(bounds.pad(0.2), { maxZoom: 15 });
    }
  }, [places, center, showOnlyRecommended, refreshTick]);

  const onToggleRecommend = (place) => {
    window.GZPlaces.toggleRecommend(place.id, {
      name: place.name, lat: place.lat, lon: place.lon, amenity: place.amenity,
    });
    setRefreshTick(t => t + 1);
  };

  const onSaveNote = (place, note) => {
    window.GZPlaces.setNote(place.id, note, {
      name: place.name, lat: place.lat, lon: place.lon, amenity: place.amenity,
    });
    setRefreshTick(t => t + 1);
  };

  const fmtDistance = (m) => m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;

  const visiblePlaces = showOnlyRecommended
    ? places.filter(p => userNotesById[p.id]?.recommended)
    : places;

  return (
    <div style={{
      width: '100%', height: '100%', background: tokens.bg,
      fontFamily: fonts.sans, color: tokens.ink,
      display: 'flex', flexDirection: 'column',
      paddingTop: 'max(env(safe-area-inset-top), 12px)',
      paddingBottom: 90,
      position: 'relative',
    }}>
      {/* Header */}
      <div style={{ padding: '12px 20px 12px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <h1 style={{
            fontFamily: fonts.serif, fontSize: 28, fontWeight: 400,
            color: tokens.ink, margin: 0, letterSpacing: -0.6,
          }}>Lugares cerca</h1>
          <button onClick={() => locateAndLoad()} disabled={phase === 'locating' || phase === 'loading'} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: tokens.green, fontSize: 13.5, fontWeight: 600,
            fontFamily: fonts.sans, padding: 4,
            opacity: (phase === 'locating' || phase === 'loading') ? 0.5 : 1,
          }}>↻ Buscar de nuevo</button>
        </div>
        <p style={{ fontSize: 13, color: tokens.inkMuted, margin: '4px 0 0' }}>
          Restaurantes etiquetados como «sin gluten» en OpenStreetMap.
        </p>
      </div>

      {/* Filter chips */}
      <div style={{
        padding: '0 20px 10px', display: 'flex', gap: 8, flexWrap: 'wrap', flexShrink: 0,
      }}>
        <button onClick={() => setShowOnlyRecommended(v => !v)} style={{
          padding: '7px 12px', borderRadius: 999, border: 'none', cursor: 'pointer',
          background: showOnlyRecommended ? tokens.greenDeep : tokens.surface,
          color: showOnlyRecommended ? '#fff' : tokens.ink,
          border: `1px solid ${showOnlyRecommended ? tokens.greenDeep : tokens.divider}`,
          fontSize: 12.5, fontWeight: 500, fontFamily: fonts.sans, letterSpacing: -0.1,
        }}>★ Solo recomendados ({userNotes.filter(n => n.recommended).length})</button>
        <button onClick={() => setShowFavoritesPanel(true)} style={{
          padding: '7px 12px', borderRadius: 999, cursor: 'pointer',
          background: tokens.surface, color: tokens.ink,
          border: `1px solid ${tokens.divider}`,
          fontSize: 12.5, fontWeight: 500, fontFamily: fonts.sans, letterSpacing: -0.1,
        }}>♡ Productos favoritos ({favorites.length})</button>
        <select
          value={radius}
          onChange={e => {
            const r = parseInt(e.target.value, 10);
            setRadius(r);
            if (center) loadPlaces(center, r);
          }}
          style={{
            padding: '7px 12px', borderRadius: 999, cursor: 'pointer',
            background: tokens.surface, color: tokens.ink,
            border: `1px solid ${tokens.divider}`,
            fontSize: 12.5, fontWeight: 500, fontFamily: fonts.sans,
          }}>
          <option value="1000">A 1 km</option>
          <option value="2500">A 2,5 km</option>
          <option value="5000">A 5 km</option>
          <option value="10000">A 10 km</option>
        </select>
      </div>

      {/* Map container */}
      <div style={{ position: 'relative', height: 280, margin: '0 16px', borderRadius: 18, overflow: 'hidden', border: `1px solid ${tokens.divider}`, flexShrink: 0 }}>
        <div ref={mapElRef} style={{ position: 'absolute', inset: 0, background: tokens.bgSoft }} />

        {(phase === 'idle' || phase === 'locating' || phase === 'loading') && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 10,
            background: 'rgba(15,20,17,0.7)', backdropFilter: 'blur(4px)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            color: '#fff', textAlign: 'center', padding: 16,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 999,
              border: '3px solid rgba(255,255,255,0.2)', borderTopColor: '#5DD78A',
              animation: 'gz-spin 1s linear infinite', marginBottom: 12,
            }} />
            <div style={{ fontSize: 14, fontWeight: 500 }}>
              {phase === 'locating' ? 'Buscando tu ubicación…' : 'Cargando restaurantes…'}
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 10,
            background: 'rgba(15,20,17,0.85)', color: '#fff',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: 24, textAlign: 'center',
          }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📍</div>
            <div style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 14, maxWidth: 280 }}>{errorMsg}</div>
            <button onClick={() => locateAndLoad()} style={{
              padding: '10px 18px', borderRadius: 999, border: 'none', cursor: 'pointer',
              background: '#fff', color: tokens.greenDeep,
              fontSize: 13.5, fontWeight: 600, fontFamily: fonts.sans,
            }}>Reintentar</button>
          </div>
        )}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '14px 16px 0' }}>
        {phase === 'ready' && visiblePlaces.length === 0 && (
          <div style={{
            background: tokens.surface, borderRadius: 16, padding: '24px 18px',
            textAlign: 'center', border: `1px solid ${tokens.divider}`,
          }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
            <div style={{ fontSize: 14.5, fontWeight: 600, color: tokens.ink, marginBottom: 6 }}>
              {showOnlyRecommended ? 'No has recomendado lugares' : 'Sin lugares en este radio'}
            </div>
            <div style={{ fontSize: 12.5, color: tokens.inkMuted, lineHeight: 1.5 }}>
              {showOnlyRecommended
                ? 'Toca la estrella en un lugar para marcarlo como recomendado.'
                : 'Prueba a ampliar el radio o busca en otra zona.'}
            </div>
          </div>
        )}

        {visiblePlaces.map(p => {
          const note = userNotesById[p.id];
          const rec = note?.recommended;
          return (
            <button
              key={p.id}
              onClick={() => { setSelected(p); if (mapRef.current) mapRef.current.flyTo([p.lat, p.lon], 17, { duration: 0.6 }); }}
              style={{
                width: '100%', textAlign: 'left', cursor: 'pointer',
                background: tokens.surface, borderRadius: 14, padding: 14,
                marginBottom: 8, border: `1px solid ${rec ? tokens.green : tokens.divider}`,
                fontFamily: fonts.sans,
                display: 'flex', alignItems: 'flex-start', gap: 12,
              }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                background: rec ? tokens.greenDeep : tokens.greenSoft,
                color: rec ? '#fff' : tokens.greenDeep,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, fontWeight: 700,
              }}>{rec ? '★' : '✓'}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 15, fontWeight: 600, color: tokens.ink, letterSpacing: -0.2,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{p.name}</div>
                <div style={{
                  fontSize: 12.5, color: tokens.inkMuted, marginTop: 2,
                  display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
                }}>
                  <span>{p.amenity === 'cafe' ? 'Cafetería' :
                          p.amenity === 'bakery' ? 'Panadería' :
                          p.amenity === 'fast_food' ? 'Comida rápida' :
                          p.amenity === 'ice_cream' ? 'Heladería' :
                          p.amenity === 'pub' ? 'Pub' :
                          p.amenity === 'bar' ? 'Bar' :
                          'Restaurante'}</span>
                  <span style={{ opacity: 0.4 }}>·</span>
                  <span>{fmtDistance(p.distance)}</span>
                  {p.diet === 'only' && (
                    <>
                      <span style={{ opacity: 0.4 }}>·</span>
                      <span style={{ color: tokens.green, fontWeight: 600 }}>100% SG</span>
                    </>
                  )}
                </div>
                {note?.note && (
                  <div style={{
                    fontSize: 12.5, color: tokens.inkSoft, marginTop: 6,
                    background: tokens.bgSoft, padding: '6px 8px', borderRadius: 8,
                    fontStyle: 'italic', lineHeight: 1.4,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>"{note.note}"</div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Place detail sheet */}
      {selected && (
        <PlaceSheet
          place={selected}
          note={userNotesById[selected.id]}
          onClose={() => setSelected(null)}
          onToggleRecommend={() => onToggleRecommend(selected)}
          onSaveNote={(n) => onSaveNote(selected, n)}
        />
      )}

      {/* Favorites side panel */}
      {showFavoritesPanel && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 50,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'flex-end',
        }} onClick={() => setShowFavoritesPanel(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            width: '100%', background: tokens.bg,
            borderRadius: '24px 24px 0 0', padding: 20,
            maxHeight: '70vh', overflowY: 'auto',
            paddingBottom: 'max(env(safe-area-inset-bottom), 20px)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{
                fontFamily: fonts.serif, fontSize: 22, margin: 0,
                fontWeight: 500, color: tokens.ink, letterSpacing: -0.4,
              }}>Productos favoritos</h3>
              <button onClick={() => setShowFavoritesPanel(false)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: tokens.inkMuted, fontSize: 20, padding: 4,
              }}>×</button>
            </div>
            {favorites.length === 0 ? (
              <div style={{ fontSize: 14, color: tokens.inkMuted, padding: '12px 0' }}>
                Aún no tienes productos favoritos. Marca productos desde la pantalla de resultado.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {favorites.map(p => (
                  <button key={p.barcode} onClick={() => { setShowFavoritesPanel(false); onOpenProduct(p); }} style={{
                    background: tokens.surface, border: `1px solid ${tokens.divider}`,
                    borderRadius: 14, padding: 12, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
                    fontFamily: fonts.sans,
                  }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                      background: '#F1EAD9', overflow: 'hidden',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                    }}>
                      {p.imageUrl
                        ? <img src={p.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => e.target.style.display = 'none'} />
                        : (p.emoji || '📦')}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 600, color: tokens.ink, letterSpacing: -0.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: tokens.inkMuted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.brand || '—'}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PlaceSheet({ place, note, onClose, onToggleRecommend, onSaveNote }) {
  const [editingNote, setEditingNote] = useState(false);
  const [draft, setDraft] = useState(note?.note || '');
  const rec = !!note?.recommended;

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 50,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'flex-end',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', background: tokens.bg,
        borderRadius: '24px 24px 0 0', padding: '20px 20px 24px',
        maxHeight: '85vh', overflowY: 'auto',
        paddingBottom: 'max(env(safe-area-inset-bottom), 24px)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 4 }}>
          <h3 style={{
            fontFamily: fonts.serif, fontSize: 24, margin: 0,
            fontWeight: 500, color: tokens.ink, letterSpacing: -0.4, lineHeight: 1.2,
          }}>{place.name}</h3>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: tokens.inkMuted, fontSize: 20, padding: 4, flexShrink: 0,
          }}>×</button>
        </div>

        <div style={{ fontSize: 13.5, color: tokens.inkMuted, marginBottom: 18 }}>
          {place.amenity === 'cafe' ? 'Cafetería' : place.amenity === 'bakery' ? 'Panadería' : 'Restaurante'}
          {place.cuisine && ` · ${place.cuisine.replace(/_/g, ' ')}`}
          {place.diet === 'only' && <span style={{ color: tokens.green, fontWeight: 600 }}> · 100% sin gluten</span>}
        </div>

        {/* Actions */}
        <button onClick={onToggleRecommend} style={{
          width: '100%', height: 52, borderRadius: 14, cursor: 'pointer',
          background: rec ? tokens.greenDeep : tokens.surface,
          color: rec ? '#fff' : tokens.ink,
          border: `1px solid ${rec ? tokens.greenDeep : tokens.divider}`,
          fontSize: 15, fontWeight: 600, fontFamily: fonts.sans,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          marginBottom: 10,
        }}>
          <span style={{ fontSize: 18 }}>{rec ? '★' : '☆'}</span>
          {rec ? 'Recomendado por ti' : 'Marcar como recomendado'}
        </button>

        {/* Note */}
        <div style={{
          background: tokens.surface, borderRadius: 14, padding: 14,
          border: `1px solid ${tokens.divider}`, marginBottom: 12,
        }}>
          <div style={{
            fontSize: 11, fontWeight: 600, color: tokens.inkMuted,
            textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8,
          }}>Tu nota</div>
          {editingNote ? (
            <>
              <textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder="“El pan sin gluten estaba muy bueno”, “Tienen menú dedicado”, …"
                rows={3}
                autoFocus
                style={{
                  width: '100%', boxSizing: 'border-box',
                  border: `1px solid ${tokens.divider}`, borderRadius: 10,
                  padding: 10, fontSize: 14, fontFamily: fonts.sans,
                  background: tokens.bg, color: tokens.ink,
                  resize: 'none', outline: 'none',
                }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button onClick={() => { onSaveNote(draft); setEditingNote(false); }} style={{
                  flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: tokens.greenDeep, color: '#fff', fontSize: 14, fontWeight: 600,
                  fontFamily: fonts.sans,
                }}>Guardar</button>
                <button onClick={() => { setDraft(note?.note || ''); setEditingNote(false); }} style={{
                  padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                  background: 'transparent', color: tokens.inkSoft,
                  border: `1px solid ${tokens.divider}`,
                  fontSize: 14, fontWeight: 500, fontFamily: fonts.sans,
                }}>Cancelar</button>
              </div>
            </>
          ) : (
            <>
              {note?.note ? (
                <div style={{ fontSize: 14, color: tokens.ink, lineHeight: 1.5, fontStyle: 'italic' }}>"{note.note}"</div>
              ) : (
                <div style={{ fontSize: 13.5, color: tokens.inkMuted, lineHeight: 1.5 }}>
                  Aún no has escrito una nota.
                </div>
              )}
              <button onClick={() => setEditingNote(true)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: tokens.green, fontSize: 13, fontWeight: 600,
                fontFamily: fonts.sans, padding: '8px 0 0', textAlign: 'left',
              }}>{note?.note ? 'Editar nota' : '+ Añadir nota'}</button>
            </>
          )}
        </div>

        {/* External links */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <a
            href={`https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lon}&zoom=18`}
            target="_blank" rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
              background: tokens.surface, borderRadius: 12,
              border: `1px solid ${tokens.divider}`,
              color: tokens.ink, textDecoration: 'none', fontSize: 14,
              fontFamily: fonts.sans, fontWeight: 500,
            }}>
            <span style={{ fontSize: 18 }}>🗺️</span>
            Abrir en OpenStreetMap
          </a>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}&center=${place.lat},${place.lon}`}
            target="_blank" rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
              background: tokens.surface, borderRadius: 12,
              border: `1px solid ${tokens.divider}`,
              color: tokens.ink, textDecoration: 'none', fontSize: 14,
              fontFamily: fonts.sans, fontWeight: 500,
            }}>
            <span style={{ fontSize: 18 }}>📍</span>
            Ver en Google Maps (reseñas)
          </a>
          {place.website && (
            <a
              href={place.website.startsWith('http') ? place.website : `https://${place.website}`}
              target="_blank" rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                background: tokens.surface, borderRadius: 12,
                border: `1px solid ${tokens.divider}`,
                color: tokens.ink, textDecoration: 'none', fontSize: 14,
                fontFamily: fonts.sans, fontWeight: 500,
              }}>
              <span style={{ fontSize: 18 }}>🌐</span>
              Web del lugar
            </a>
          )}
        </div>

        <div style={{
          marginTop: 14, fontSize: 11.5, color: tokens.inkMuted, lineHeight: 1.5, textAlign: 'center', padding: '0 8px',
        }}>
          Datos de OpenStreetMap. Confirma siempre la información en el restaurante antes de pedir.
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Screen: FAVORITES
// ─────────────────────────────────────────────────────────────
function FavoritesScreen({ items, onOpen, onRemove }) {
  const [query, setQuery] = useState('');
  const filtered = items.filter(p => !query || (`${p.name} ${p.brand}`.toLowerCase().includes(query.toLowerCase())));

  const stateColor = (s) => s === 'apto' ? tokens.green : s === 'dudoso' ? tokens.amber : tokens.coral;
  const stateBg = (s) => s === 'apto' ? tokens.greenSoft : s === 'dudoso' ? tokens.amberSoft : tokens.coralSoft;
  const stateLabel = (s) => s === 'apto' ? 'Apto' : s === 'dudoso' ? 'Dudoso' : 'No apto';

  return (
    <div style={{
      width: '100%', minHeight: '100%',
      paddingTop: 'max(env(safe-area-inset-top), 12px)',
      paddingBottom: 110, background: tokens.bg, fontFamily: fonts.sans,
    }}>
      <div style={{ padding: '16px 20px 8px' }}>
        <h1 style={{
          fontFamily: fonts.serif, fontSize: 30, fontWeight: 400,
          color: tokens.ink, margin: 0, letterSpacing: -0.6,
        }}>Favoritos</h1>
        <p style={{ fontSize: 14, color: tokens.inkMuted, margin: '4px 0 0' }}>
          {items.length} {items.length === 1 ? 'producto guardado' : 'productos guardados'}
        </p>
      </div>

      {items.length > 0 && (
        <div style={{ padding: '12px 20px 0' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: tokens.surface, borderRadius: 14, padding: '12px 14px',
            border: `1px solid ${tokens.divider}`,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={tokens.inkMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar en favoritos"
              style={{
                flex: 1, border: 'none', outline: 'none', background: 'transparent',
                fontSize: 15, color: tokens.ink, fontFamily: fonts.sans,
              }}
            />
            {query && (
              <button onClick={() => setQuery('')} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: tokens.inkMuted, fontSize: 18, padding: 0,
              }}>×</button>
            )}
          </div>
        </div>
      )}

      <div style={{ padding: '18px 20px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.length === 0 && (
          <div style={{
            background: tokens.surface, borderRadius: 18, padding: '40px 24px',
            textAlign: 'center', border: `1px solid ${tokens.divider}`,
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>💚</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: tokens.ink, marginBottom: 6 }}>Aún no tienes favoritos</div>
            <div style={{ fontSize: 13.5, color: tokens.inkMuted, lineHeight: 1.5 }}>
              Cuando escanees un producto, púlsalo «Guardar en favoritos» y aparecerá aquí para acceder rápido.
            </div>
          </div>
        )}
        {filtered.length === 0 && items.length > 0 && (
          <div style={{
            background: tokens.surface, borderRadius: 18, padding: '24px 20px',
            textAlign: 'center', border: `1px solid ${tokens.divider}`,
            fontSize: 14, color: tokens.inkMuted,
          }}>Sin resultados para «{query}»</div>
        )}
        {filtered.map((p) => (
          <div key={p.barcode} style={{
            background: tokens.surface, borderRadius: 16, padding: 12,
            display: 'flex', alignItems: 'center', gap: 12,
            border: `1px solid ${tokens.divider}`,
          }}>
            <button onClick={() => onOpen(p)} style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 12,
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 0, textAlign: 'left',
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: stateBg(p.state), display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: 22,
                flexShrink: 0, overflow: 'hidden',
              }}>
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none'; }} />
                ) : (p.emoji || '📦')}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 15, fontWeight: 600, color: tokens.ink,
                  letterSpacing: -0.2, lineHeight: 1.25,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{p.name}</div>
                <div style={{
                  fontSize: 12.5, color: tokens.inkMuted, marginTop: 2,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <span style={{
                    color: stateColor(p.state), fontWeight: 600,
                  }}>{stateLabel(p.state)}</span>
                  <span style={{ opacity: 0.4 }}>·</span>
                  <span>{p.brand || '—'}</span>
                </div>
              </div>
            </button>
            <button onClick={() => onRemove(p.barcode)} aria-label="Quitar de favoritos" style={{
              width: 38, height: 38, borderRadius: 10,
              background: 'transparent', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: tokens.inkMuted, flexShrink: 0,
            }}>
              <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 14s-5-3.2-5-7a3 3 0 0 1 5-2.2A3 3 0 0 1 13 7c0 3.8-5 7-5 7z"/>
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Screen 4: HISTORY
// ─────────────────────────────────────────────────────────────
function HistoryScreen({ items, onOpen, onClear }) {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');

  const filtered = items.filter(p => {
    if (filter !== 'all' && p.state !== filter) return false;
    if (query && !(`${p.name} ${p.brand}`.toLowerCase().includes(query.toLowerCase()))) return false;
    return true;
  });

  const counts = {
    all: items.length,
    apto: items.filter(p => p.state === 'apto').length,
    dudoso: items.filter(p => p.state === 'dudoso').length,
    noApto: items.filter(p => p.state === 'noApto').length,
  };

  const filterTabs = [
    { id: 'all', label: 'Todos' },
    { id: 'apto', label: 'Aptos' },
    { id: 'dudoso', label: 'Dudosos' },
    { id: 'noApto', label: 'No aptos' },
  ];

  return (
    <div style={{
      width: '100%', minHeight: '100%',
      paddingTop: 'max(env(safe-area-inset-top), 12px)',
      paddingBottom: 110, background: tokens.bg,
      fontFamily: fonts.sans,
    }}>
      {/* Header */}
      <div style={{ padding: '16px 20px 8px' }}>
        <h1 style={{
          fontFamily: fonts.serif, fontSize: 30, fontWeight: 400,
          color: tokens.ink, margin: 0, letterSpacing: -0.6,
        }}>Historial</h1>
        <p style={{
          fontSize: 14, color: tokens.inkMuted, margin: '4px 0 0',
        }}>{items.length} {items.length === 1 ? 'producto escaneado' : 'productos escaneados'}</p>
      </div>

      {/* Search */}
      <div style={{ padding: '12px 20px 0' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: tokens.surface, borderRadius: 14, padding: '12px 14px',
          border: `1px solid ${tokens.divider}`,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={tokens.inkMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar producto o marca"
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontSize: 15, color: tokens.ink, fontFamily: fonts.sans,
            }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: tokens.inkMuted, fontSize: 18, padding: 0,
            }}>×</button>
          )}
        </div>
      </div>

      {/* Filter pills */}
      <div style={{
        padding: '14px 20px 0',
        display: 'flex', gap: 8, overflowX: 'auto',
        scrollbarWidth: 'none',
      }}>
        {filterTabs.map(t => {
          const active = filter === t.id;
          const count = counts[t.id];
          return (
            <button key={t.id} onClick={() => setFilter(t.id)} style={{
              flexShrink: 0,
              padding: '8px 14px', borderRadius: 999,
              border: `1px solid ${active ? tokens.green : tokens.divider}`,
              background: active ? tokens.green : '#fff',
              color: active ? '#fff' : tokens.ink,
              fontSize: 13.5, fontWeight: 500, cursor: 'pointer',
              fontFamily: fonts.sans, letterSpacing: -0.1,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {t.label}
              <span style={{
                fontSize: 11, fontWeight: 600,
                background: active ? 'rgba(255,255,255,0.25)' : tokens.divider,
                color: active ? '#fff' : tokens.inkMuted,
                padding: '1px 7px', borderRadius: 999,
              }}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* List */}
      <div style={{ padding: '18px 20px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.length === 0 && (
          <div style={{
            background: tokens.surface, borderRadius: 18, padding: '32px 20px',
            textAlign: 'center', border: `1px solid ${tokens.divider}`,
          }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🔍</div>
            <div style={{ fontSize: 15, color: tokens.ink, fontWeight: 500, marginBottom: 4 }}>
              {items.length === 0 ? 'Aún no has escaneado nada' : 'Sin resultados'}
            </div>
            <div style={{ fontSize: 13, color: tokens.inkMuted, lineHeight: 1.5 }}>
              {items.length === 0
                ? 'Tus escaneos aparecerán aquí automáticamente.'
                : 'Prueba con otro término o filtro.'}
            </div>
          </div>
        )}
        {filtered.map((p, i) => (
          <div key={p.barcode || i} onClick={() => onOpen && onOpen(p)} style={{ cursor: 'pointer' }}>
            <ProductTile product={{ ...p, when: relativeTime(p.ts) }} />
          </div>
        ))}
      </div>

      {items.length > 0 && (
        <div style={{ padding: '24px 20px 0', textAlign: 'center' }}>
          <button onClick={onClear} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: tokens.coral, fontSize: 13.5, fontWeight: 500,
            fontFamily: fonts.sans, padding: 8,
          }}>Borrar historial</button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Screen 5: PROFILE
// ─────────────────────────────────────────────────────────────
function ProfileScreen({ profile, onChange, stats }) {
  const sensitivities = [
    { id: 'celiac', label: 'Celíaco/a', sub: 'Cero gluten, sensibilidad máxima' },
    { id: 'sensitive', label: 'Sensible al gluten', sub: 'Reduzco gluten por molestias' },
    { id: 'choice', label: 'Por elección', sub: 'Estilo de vida sin gluten' },
  ];

  const set = (k, v) => onChange({ ...profile, [k]: v });

  return (
    <div style={{
      width: '100%', minHeight: '100%',
      paddingTop: 'max(env(safe-area-inset-top), 12px)',
      paddingBottom: 110, background: tokens.bg,
      fontFamily: fonts.sans,
    }}>
      {/* Header */}
      <div style={{ padding: '16px 20px 8px' }}>
        <h1 style={{
          fontFamily: fonts.serif, fontSize: 30, fontWeight: 400,
          color: tokens.ink, margin: 0, letterSpacing: -0.6,
        }}>Mi perfil</h1>
      </div>

      {/* Avatar + name card */}
      <div style={{ padding: '16px 20px 0' }}>
        <div style={{
          background: tokens.surface, borderRadius: 22, padding: 20,
          border: `1px solid ${tokens.divider}`,
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: 999,
            background: `linear-gradient(135deg, ${tokens.green}, ${tokens.greenDeep})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 26, fontWeight: 500,
            fontFamily: fonts.serif, flexShrink: 0,
          }}>
            {(profile.name || '?').trim().charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <input
              value={profile.name}
              onChange={e => set('name', e.target.value)}
              placeholder="Tu nombre"
              style={{
                width: '100%', border: 'none', outline: 'none', background: 'transparent',
                fontSize: 19, fontWeight: 500, color: tokens.ink,
                fontFamily: fonts.sans, letterSpacing: -0.3, padding: 0,
              }}
            />
            <div style={{ fontSize: 13, color: tokens.inkMuted, marginTop: 2 }}>
              Toca para editar
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ padding: '14px 20px 0', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {[
          { label: 'Escaneos', value: stats.total, color: tokens.ink },
          { label: 'Aptos', value: stats.safe, color: tokens.green },
          { label: 'No aptos', value: stats.unsafe, color: tokens.coral },
        ].map(s => (
          <div key={s.label} style={{
            background: tokens.surface, borderRadius: 14, padding: '14px 8px',
            border: `1px solid ${tokens.divider}`, textAlign: 'center',
          }}>
            <div style={{ fontFamily: fonts.serif, fontSize: 24, fontWeight: 400, color: s.color, lineHeight: 1 }}>
              {s.value}
            </div>
            <div style={{ fontSize: 11, color: tokens.inkMuted, marginTop: 4, letterSpacing: 0.2 }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Sensitivity */}
      <div style={{ padding: '24px 20px 0' }}>
        <h2 style={{
          fontSize: 11, fontWeight: 600, margin: '0 0 10px',
          color: tokens.inkMuted, textTransform: 'uppercase', letterSpacing: 0.6,
        }}>Nivel de sensibilidad</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sensitivities.map(s => {
            const active = profile.sensitivity === s.id;
            return (
              <button key={s.id} onClick={() => set('sensitivity', s.id)} style={{
                width: '100%', textAlign: 'left', cursor: 'pointer',
                background: tokens.surface, borderRadius: 16, padding: 14,
                border: `1.5px solid ${active ? tokens.green : tokens.divider}`,
                fontFamily: fonts.sans,
                display: 'flex', alignItems: 'center', gap: 12,
                transition: 'border-color 0.15s, background 0.15s',
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: 999,
                  border: `2px solid ${active ? tokens.green : tokens.divider}`,
                  background: active ? tokens.green : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {active && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 500, color: tokens.ink, letterSpacing: -0.2 }}>{s.label}</div>
                  <div style={{ fontSize: 12.5, color: tokens.inkMuted, marginTop: 2 }}>{s.sub}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Toggles */}
      <div style={{ padding: '24px 20px 0' }}>
        <h2 style={{
          fontSize: 11, fontWeight: 600, margin: '0 0 10px',
          color: tokens.inkMuted, textTransform: 'uppercase', letterSpacing: 0.6,
        }}>Avisos al escanear</h2>
        <div style={{ background: tokens.surface, borderRadius: 16, border: `1px solid ${tokens.divider}`, overflow: 'hidden' }}>
          <ProfileToggle
            label="Avisar de trazas"
            sub="“Puede contener trazas de gluten”"
            value={profile.warnTraces}
            onChange={v => set('warnTraces', v)}
          />
          <div style={{ height: 1, background: tokens.divider, margin: '0 16px' }} />
          <ProfileToggle
            label="Avisar de ingredientes dudosos"
            sub="Aromas, almidones modificados, etc."
            value={profile.warnDoubts}
            onChange={v => set('warnDoubts', v)}
          />
        </div>
      </div>

      {/* Theme */}
      <div style={{ padding: '24px 20px 0' }}>
        <h2 style={{
          fontSize: 11, fontWeight: 600, margin: '0 0 10px',
          color: tokens.inkMuted, textTransform: 'uppercase', letterSpacing: 0.6,
        }}>Apariencia</h2>
        <div style={{
          background: tokens.surface, borderRadius: 16,
          border: `1px solid ${tokens.divider}`, padding: 6,
          display: 'flex', gap: 4,
        }}>
          {[
            { id: 'auto', label: 'Auto', ic: '⚙️' },
            { id: 'light', label: 'Claro', ic: '☀️' },
            { id: 'dark', label: 'Oscuro', ic: '🌙' },
          ].map(t => {
            const active = (profile.theme || 'auto') === t.id;
            return (
              <button key={t.id} onClick={() => set('theme', t.id)} style={{
                flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer',
                background: active ? tokens.greenSoft : 'transparent',
                color: active ? tokens.greenDeep : tokens.inkSoft,
                borderRadius: 12, fontSize: 13.5, fontWeight: 600,
                fontFamily: fonts.sans, letterSpacing: -0.1,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                transition: 'background 0.15s, color 0.15s',
              }}>
                <span style={{ fontSize: 18 }}>{t.ic}</span>
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* About */}
      <div style={{ padding: '24px 20px 0' }}>
        <div style={{
          background: tokens.greenSoft, borderRadius: 18, padding: 16,
          fontSize: 13, color: tokens.greenDeep, lineHeight: 1.5,
        }}>
          <strong style={{ fontWeight: 600 }}>GlutenZero · v0.3</strong><br />
          Información orientativa. Consulta siempre la etiqueta oficial y a tu profesional sanitario.
        </div>
      </div>
    </div>
  );
}

function ProfileToggle({ label, sub, value, onChange }) {
  return (
    <button onClick={() => onChange(!value)} style={{
      width: '100%', background: 'none', border: 'none', cursor: 'pointer',
      padding: 16, display: 'flex', alignItems: 'center', gap: 12,
      fontFamily: fonts.sans, textAlign: 'left',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 500, color: tokens.ink, letterSpacing: -0.2 }}>{label}</div>
        <div style={{ fontSize: 12.5, color: tokens.inkMuted, marginTop: 2 }}>{sub}</div>
      </div>
      <div style={{
        width: 44, height: 26, borderRadius: 999,
        background: value ? tokens.green : tokens.divider,
        position: 'relative', flexShrink: 0,
        transition: 'background 0.2s',
      }}>
        <div style={{
          position: 'absolute', top: 2, left: value ? 20 : 2,
          width: 22, height: 22, borderRadius: 999,
          background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          transition: 'left 0.2s',
        }} />
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// Screen: ONBOARDING — solo en el primer arranque
// ─────────────────────────────────────────────────────────────
function OnboardingScreen({ initialProfile, onDone }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initialProfile.name || '');
  const [sensitivity, setSensitivity] = useState(initialProfile.sensitivity || 'celiac');

  const sensitivities = [
    { id: 'celiac', label: 'Celíaco/a', sub: 'Cero gluten, sensibilidad máxima' },
    { id: 'sensitive', label: 'Sensible al gluten', sub: 'Reduzco gluten por molestias' },
    { id: 'choice', label: 'Por elección', sub: 'Estilo de vida sin gluten' },
  ];

  const next = () => setStep(s => s + 1);
  const back = () => setStep(s => Math.max(0, s - 1));
  const finish = () => {
    onDone({
      ...initialProfile,
      name: name.trim() || 'Hola',
      sensitivity,
      onboarded: true,
    });
  };

  const totalSteps = 3;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: `linear-gradient(180deg, ${tokens.greenDeep} 0%, #0a3a23 100%)`,
      fontFamily: fonts.sans, color: '#fff',
      display: 'flex', flexDirection: 'column',
      paddingTop: 'max(env(safe-area-inset-top), 20px)',
      paddingBottom: 'max(env(safe-area-inset-bottom), 20px)',
      overflow: 'hidden',
    }}>
      {/* Decorative blobs */}
      <div style={{
        position: 'absolute', top: -120, right: -100,
        width: 320, height: 320, borderRadius: 999,
        background: '#5DD78A', opacity: 0.18, filter: 'blur(60px)',
      }} />
      <div style={{
        position: 'absolute', bottom: -150, left: -80,
        width: 280, height: 280, borderRadius: 999,
        background: '#1F7A4D', opacity: 0.4, filter: 'blur(80px)',
      }} />

      {/* Progress bar */}
      <div style={{ padding: '12px 24px 0', position: 'relative', zIndex: 2 }}>
        <div style={{
          height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.15)', overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', width: `${((step + 1) / totalSteps) * 100}%`,
            background: '#5DD78A', transition: 'width 0.3s',
            boxShadow: '0 0 8px rgba(93,215,138,0.5)',
          }} />
        </div>
        <div style={{
          marginTop: 8, fontSize: 12, color: 'rgba(255,255,255,0.6)', letterSpacing: 0.3,
        }}>{step + 1} / {totalSteps}</div>
      </div>

      {/* Step content */}
      <div style={{
        flex: 1, padding: '24px 28px 16px',
        position: 'relative', zIndex: 2,
        display: 'flex', flexDirection: 'column',
        justifyContent: 'flex-start',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}>
        {step === 0 && (
          <div>
            <GZLogo size={56} color="#fff" />
            <h1 style={{
              fontFamily: fonts.serif, fontSize: 38, fontWeight: 500,
              margin: '20px 0 12px', letterSpacing: -0.8, lineHeight: 1.05,
              textWrap: 'pretty',
            }}>Comer sin gluten, <em style={{ color: '#5DD78A', fontStyle: 'italic' }}>sin miedo</em>.</h1>
            <p style={{
              fontSize: 17, lineHeight: 1.5, margin: 0,
              color: 'rgba(255,255,255,0.82)', letterSpacing: -0.1,
              textWrap: 'pretty', maxWidth: 360,
            }}>
              GlutenZero te dice al instante si un producto es seguro. Tres formas de escanear, una respuesta clara.
            </p>

            <div style={{
              marginTop: 32, display: 'flex', flexDirection: 'column', gap: 14,
            }}>
              {[
                { ic: '⎯', t: 'Código de barras', s: 'Apunta y listo' },
                { ic: '🅰', t: 'Etiqueta', s: 'Foto de los ingredientes' },
                { ic: '#', t: 'Manual', s: 'Si no funciona la cámara' },
              ].map((f, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '12px 14px', borderRadius: 16,
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 12,
                    background: 'rgba(93,215,138,0.2)', color: '#5DD78A',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, fontWeight: 700, flexShrink: 0,
                  }}>{f.ic}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: -0.2 }}>{f.t}</div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 1 }}>{f.s}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <div style={{ fontSize: 14, color: '#5DD78A', fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 12 }}>
              Encantados de conocerte
            </div>
            <h2 style={{
              fontFamily: fonts.serif, fontSize: 34, fontWeight: 500,
              margin: '0 0 12px', letterSpacing: -0.6, lineHeight: 1.1,
              textWrap: 'pretty',
            }}>¿Cómo te llamas?</h2>
            <p style={{
              fontSize: 16, color: 'rgba(255,255,255,0.7)',
              margin: '0 0 32px', lineHeight: 1.5,
            }}>Lo usaremos para saludarte en la app. Puedes cambiarlo después.</p>

            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Tu nombre"
              autoFocus
              style={{
                width: '100%', height: 60, boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.1)',
                border: '1.5px solid rgba(255,255,255,0.2)',
                borderRadius: 16, padding: '0 20px',
                fontSize: 20, color: '#fff', outline: 'none',
                fontFamily: fonts.sans, letterSpacing: -0.2,
              }}
            />
          </div>
        )}

        {step === 2 && (
          <div>
            <div style={{ fontSize: 14, color: '#5DD78A', fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 12 }}>
              Casi listo, {name.trim() || 'tú'}
            </div>
            <h2 style={{
              fontFamily: fonts.serif, fontSize: 32, fontWeight: 500,
              margin: '0 0 12px', letterSpacing: -0.6, lineHeight: 1.1,
              textWrap: 'pretty',
            }}>¿Cuál es tu nivel de sensibilidad?</h2>
            <p style={{
              fontSize: 15, color: 'rgba(255,255,255,0.7)',
              margin: '0 0 24px', lineHeight: 1.5,
            }}>Ajusta cuánto te avisamos ante dudas. Puedes cambiarlo en el Perfil.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sensitivities.map(s => {
                const active = sensitivity === s.id;
                return (
                  <button key={s.id} onClick={() => setSensitivity(s.id)} style={{
                    width: '100%', textAlign: 'left', cursor: 'pointer',
                    background: active ? 'rgba(93,215,138,0.18)' : 'rgba(255,255,255,0.08)',
                    border: `1.5px solid ${active ? '#5DD78A' : 'rgba(255,255,255,0.12)'}`,
                    borderRadius: 16, padding: 16,
                    display: 'flex', alignItems: 'center', gap: 12,
                    fontFamily: fonts.sans, color: '#fff',
                    transition: 'all 0.15s',
                  }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: 999,
                      border: `2px solid ${active ? '#5DD78A' : 'rgba(255,255,255,0.3)'}`,
                      background: active ? '#5DD78A' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {active && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={tokens.greenDeep} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: -0.2 }}>{s.label}</div>
                      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>{s.sub}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div style={{
              marginTop: 24, padding: '12px 14px',
              background: 'rgba(255,255,255,0.06)', borderRadius: 12,
              fontSize: 12, lineHeight: 1.5, color: 'rgba(255,255,255,0.7)',
            }}>
              ⚠️ GlutenZero ofrece información orientativa. Consulta siempre la etiqueta oficial y a tu profesional sanitario.
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '12px 24px 16px', display: 'flex', gap: 10,
        position: 'relative', zIndex: 3,
        background: 'linear-gradient(180deg, transparent 0%, rgba(10,58,35,0.95) 30%)',
        flexShrink: 0,
      }}>
        {step > 0 && (
          <button onClick={back} style={{
            flex: '0 0 auto', padding: '0 22px', height: 54,
            borderRadius: 16, border: '1.5px solid rgba(255,255,255,0.2)',
            background: 'transparent', color: '#fff',
            fontSize: 15, fontWeight: 500, cursor: 'pointer',
            fontFamily: fonts.sans, letterSpacing: -0.2,
          }}>Atrás</button>
        )}
        <button
          onClick={step < totalSteps - 1 ? next : finish}
          disabled={step === 1 && !name.trim()}
          style={{
            flex: 1, height: 54, borderRadius: 16, border: 'none',
            background: (step === 1 && !name.trim()) ? 'rgba(255,255,255,0.15)' : '#fff',
            color: (step === 1 && !name.trim()) ? 'rgba(255,255,255,0.5)' : tokens.greenDeep,
            fontSize: 16, fontWeight: 600, cursor: (step === 1 && !name.trim()) ? 'not-allowed' : 'pointer',
            fontFamily: fonts.sans, letterSpacing: -0.2,
            transition: 'all 0.15s',
          }}>
          {step === 0 && 'Empezar'}
          {step === 1 && 'Continuar'}
          {step === 2 && 'Listo, ¡vamos!'}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// App shell
// ─────────────────────────────────────────────────────────────
const TWEAKS_DEFAULTS = /*EDITMODE-BEGIN*/{
  "resultState": "apto",
  "userName": "Lucía"
}/*EDITMODE-END*/;

function GlutenZeroApp() {
  const [tweaks, setTweak] = useTweaks(TWEAKS_DEFAULTS);
  const [screen, setScreen] = useState('home'); // home | scanner | result | history | profile
  const [scanMode, setScanMode] = useState('camera');
  const [resultProduct, setResultProduct] = useState(PRODUCTS[tweaks.resultState] || PRODUCTS.apto);
  const [history, setHistory] = useState(() => historyStore.load());
  const [favorites, setFavorites] = useState(() => favoritesStore.load());
  const [profile, setProfile] = useState(() => profileStore.load() || { ...PROFILE_DEFAULT, name: tweaks.userName });
  const [themeVersion, setThemeVersion] = useState(0);

  // Persist profile when it changes
  useEffect(() => { profileStore.save(profile); }, [profile]);

  // Apply theme whenever pref changes, and listen to system changes if auto
  useEffect(() => {
    const pref = profile.theme || 'auto';
    applyTheme(resolveTheme(pref));
    setThemeVersion(v => v + 1);

    if (pref === 'auto' && typeof window !== 'undefined' && window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const onChange = () => {
        applyTheme(resolveTheme('auto'));
        setThemeVersion(v => v + 1);
      };
      mq.addEventListener && mq.addEventListener('change', onChange);
      return () => mq.removeEventListener && mq.removeEventListener('change', onChange);
    }
  }, [profile.theme]);

  const goScan = () => setScreen('scanner');
  const goHome = () => setScreen('home');
  const navigate = (tab) => {
    if (tab === 'scan') return goScan();
    if (tab === 'home') return setScreen('home');
    if (tab === 'history') return setScreen('history');
    if (tab === 'fav') return setScreen('restaurants');
    if (tab === 'profile') return setScreen('profile');
  };

  const toggleFavorite = () => {
    if (!resultProduct || !resultProduct.barcode) return;
    const next = favoritesStore.toggle(resultProduct);
    setFavorites(next);
  };
  const removeFavorite = (barcode) => {
    setFavorites(favoritesStore.remove(barcode));
  };
  const isFavorite = !!(resultProduct && resultProduct.barcode && favorites.some(f => f.barcode === resultProduct.barcode));

  // Real lookup: call Open Food Facts and analyze
  const onLookup = async (barcode) => {
    const raw = await OFF.fetchProduct(barcode);
    const analyzed = GlutenEngine.analyze(raw);
    // Persist to history if it's a real product (not an error stub)
    if (analyzed && analyzed.name && !analyzed.error) {
      const next = historyStore.add({ ...analyzed, barcode });
      setHistory(next);
    }
    setResultProduct(analyzed);
    setScreen('result');
  };

  // OCR lookup: analyze raw ingredient text from a label photo
  const onLookupText = async (text) => {
    const analyzed = GlutenEngine.analyzeText(text);
    if (!analyzed) return;
    // Tag with a synthetic barcode so favorites/history dedup still works
    const syntheticBarcode = 'ocr-' + Date.now();
    const product = { ...analyzed, barcode: syntheticBarcode };
    const next = historyStore.add(product);
    setHistory(next);
    setResultProduct(product);
    setScreen('result');
  };

  const clearHistory = () => {
    if (typeof window !== 'undefined' && window.confirm('¿Borrar todo el historial?')) {
      historyStore.clear();
      setHistory([]);
    }
  };

  const stats = {
    total: history.length,
    safe: history.filter(p => p.state === 'apto').length,
    unsafe: history.filter(p => p.state === 'noApto').length,
  };

  useEffect(() => {
    if (screen === 'result' && PRODUCTS[tweaks.resultState]) {
      // tweak override (demo)
      setResultProduct(PRODUCTS[tweaks.resultState]);
    }
  }, [tweaks.resultState]);

  return (
    <>
      {!profile.onboarded && (
        <OnboardingScreen
          initialProfile={profile}
          onDone={(p) => setProfile(p)}
        />
      )}
      <div style={{
        position: 'fixed', inset: 0, background: tokens.bg, overflow: 'hidden',
      }}>
        <div data-screen-label="01 Home" style={{
          position: 'absolute', inset: 0,
          opacity: screen === 'home' ? 1 : 0,
          pointerEvents: screen === 'home' ? 'auto' : 'none',
          transition: 'opacity 0.25s',
        }}>
          <div style={{ width: '100%', height: '100%', overflow: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <HomeScreen onScan={goScan} userName={profile.name} recent={history} />
          </div>
          <BottomTabs active="home" onScan={goScan} onNavigate={navigate} />
        </div>

        <div data-screen-label="04 History" style={{
          position: 'absolute', inset: 0,
          opacity: screen === 'history' ? 1 : 0,
          pointerEvents: screen === 'history' ? 'auto' : 'none',
          transition: 'opacity 0.25s',
        }}>
          <div style={{ width: '100%', height: '100%', overflow: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <HistoryScreen
              items={history}
              onClear={clearHistory}
              onOpen={(p) => {
                // Re-look up to show a fresh result (uses cached barcode if available)
                if (p.barcode) onLookup(p.barcode);
              }}
            />
          </div>
          <BottomTabs active="history" onScan={goScan} onNavigate={navigate} />
        </div>

        <div data-screen-label="07 Restaurants" style={{
          position: 'absolute', inset: 0,
          opacity: screen === 'restaurants' ? 1 : 0,
          pointerEvents: screen === 'restaurants' ? 'auto' : 'none',
          transition: 'opacity 0.25s',
        }}>
          {screen === 'restaurants' && (
            <RestaurantsScreen
              favorites={favorites}
              onOpenProduct={(p) => { if (p.barcode) onLookup(p.barcode); }}
            />
          )}
          <BottomTabs active="fav" onScan={goScan} onNavigate={navigate} />
        </div>

        <div data-screen-label="06 Favorites" style={{
          position: 'absolute', inset: 0,
          opacity: screen === 'favorites' ? 1 : 0,
          pointerEvents: screen === 'favorites' ? 'auto' : 'none',
          transition: 'opacity 0.25s',
        }}>
          <div style={{ width: '100%', height: '100%', overflow: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <FavoritesScreen
              items={favorites}
              onOpen={(p) => { if (p.barcode) onLookup(p.barcode); }}
              onRemove={removeFavorite}
            />
          </div>
          <BottomTabs active="fav" onScan={goScan} onNavigate={navigate} />
        </div>

        <div data-screen-label="05 Profile" style={{
          position: 'absolute', inset: 0,
          opacity: screen === 'profile' ? 1 : 0,
          pointerEvents: screen === 'profile' ? 'auto' : 'none',
          transition: 'opacity 0.25s',
        }}>
          <div style={{ width: '100%', height: '100%', overflow: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <ProfileScreen profile={profile} onChange={setProfile} stats={stats} />
          </div>
          <BottomTabs active="profile" onScan={goScan} onNavigate={navigate} />
        </div>

        <div data-screen-label="02 Scanner" style={{
          position: 'absolute', inset: 0,
          opacity: screen === 'scanner' ? 1 : 0,
          pointerEvents: screen === 'scanner' ? 'auto' : 'none',
          transition: 'opacity 0.25s',
        }}>
          {screen === 'scanner' && (
            <ScannerScreen
              mode={scanMode} setMode={setScanMode}
              onCancel={goHome} onLookup={onLookup} onLookupText={onLookupText}
            />
          )}
        </div>

        <div data-screen-label="03 Result" style={{
          position: 'absolute', inset: 0,
          opacity: screen === 'result' ? 1 : 0,
          pointerEvents: screen === 'result' ? 'auto' : 'none',
          transition: 'opacity 0.25s',
        }}>
          {(screen === 'result' || screen === 'scanner') && (
            <ResultScreen
              product={resultProduct}
              onClose={goHome}
              onScanAgain={() => { setScreen('scanner'); }}
              isFavorite={isFavorite}
              onToggleFavorite={toggleFavorite}
            />
          )}
        </div>
      </div>

      {false && <TweaksPanel title="Tweaks">
        <TweakSection title="Resultado del escáner">
          <TweakRadio
            label="Estado del producto"
            value={tweaks.resultState}
            onChange={v => setTweak('resultState', v)}
            options={[
              { value: 'apto', label: 'Apto' },
              { value: 'dudoso', label: 'Dudoso' },
              { value: 'noApto', label: 'No apto' },
            ]}
          />
          <div style={{ fontSize: 12, color: '#888', marginTop: 8, lineHeight: 1.4 }}>
            Cambia entre los tres estados posibles. Si estás en la pantalla de resultado, se actualiza al instante.
          </div>
        </TweakSection>
        <TweakSection title="Pantalla">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <TweakButton label="Home" onClick={() => setScreen('home')} />
            <TweakButton label="Escáner" onClick={() => setScreen('scanner')} />
            <TweakButton label="Resultado" onClick={() => {
              setResultProduct(PRODUCTS[tweaks.resultState] || PRODUCTS.apto);
              setScreen('result');
            }} />
          </div>
        </TweakSection>
        <TweakSection title="Personalización">
          <TweakText
            label="Nombre del usuario"
            value={tweaks.userName}
            onChange={v => setTweak('userName', v)}
          />
        </TweakSection>
      </TweaksPanel>}
    </>
  );
}

// Register service worker for offline / installability
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(<GlutenZeroApp />);
