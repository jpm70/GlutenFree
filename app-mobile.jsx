// GlutenZero — interactive prototype
// Three connected screens: Home → Scanner → Result
// Result has 3 states: apto / dudoso / no-apto

const { useState, useEffect, useRef } = React;

// ─────────────────────────────────────────────────────────────
// Design tokens
// ─────────────────────────────────────────────────────────────
const tokens = {
  bg: '#F6F1E8',          // warm cream
  bgSoft: '#FBF7EF',
  surface: '#FFFFFF',
  ink: '#1A1F1B',         // near-black with green undertone
  inkSoft: '#5C6259',
  inkMuted: '#8A8F86',
  green: '#1F7A4D',       // safe / apto
  greenSoft: '#E5F3EB',
  greenDeep: '#0F4A2E',
  coral: '#E04D3C',       // not safe
  coralSoft: '#FCE9E5',
  amber: '#D98E1E',       // dudoso
  amberSoft: '#FBEFD5',
  divider: 'rgba(26,31,27,0.08)',
};

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

const HISTORY = [
  { name: 'Yogur natural', brand: 'Danone', state: 'apto', emoji: '🥛', when: 'Hace 2 h' },
  { name: 'Pasta de lentejas', brand: 'Barilla', state: 'apto', emoji: '🍝', when: 'Ayer' },
  { name: 'Galletas Príncipe', brand: 'LU', state: 'noApto', emoji: '🍪', when: 'Ayer' },
  { name: 'Hummus tradicional', brand: 'Mercadona', state: 'dudoso', emoji: '🥣', when: 'Hace 2 d' },
];

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
        fontSize: 22, flexShrink: 0,
      }}>{product.emoji}</div>
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
function HomeScreen({ onScan, userName = 'Lucía' }) {
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
        }}>L</div>
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
          {HISTORY.map((p, i) => <ProductTile key={i} product={p} />)}
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

function BottomTabs({ active = 'home', onScan }) {
  const tabs = [
    { id: 'home', label: 'Inicio', icon: 'home' },
    { id: 'history', label: 'Historial', icon: 'list' },
    { id: 'scan', label: '', icon: 'scan' },
    { id: 'fav', label: 'Favoritos', icon: 'heart' },
    { id: 'profile', label: 'Perfil', icon: 'user' },
  ];

  const renderIcon = (icon, isActive) => {
    const c = isActive ? tokens.greenDeep : tokens.inkMuted;
    if (icon === 'home') return <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 11l8-7 8 7v9a1 1 0 01-1 1h-4v-6h-6v6H5a1 1 0 01-1-1v-9z" stroke={c} strokeWidth="2" strokeLinejoin="round"/></svg>;
    if (icon === 'list') return <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M4 12h16M4 17h10" stroke={c} strokeWidth="2" strokeLinecap="round"/></svg>;
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
        margin: '0 16px', background: '#fff',
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
            <button key={t.id} style={{
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
// Screen 2: SCANNER — Cámara (simulada) + Manual (real con OFF)
// ─────────────────────────────────────────────────────────────
function ScannerScreen({ onCancel, onLookup, mode, setMode }) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('aiming');
  const [manualCode, setManualCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Simulación de cámara: igual que antes pero al "detectar" llamamos onLookup con un código de demo
  useEffect(() => {
    if (mode !== 'camera') return;
    let t1, t2, t3;
    setProgress(0); setPhase('aiming'); setError(null);
    t1 = setTimeout(() => setPhase('detecting'), 1200);
    t2 = setTimeout(() => {
      const start = Date.now();
      const tick = () => {
        const p = Math.min(100, ((Date.now() - start) / 1600) * 100);
        setProgress(p);
        if (p < 100) requestAnimationFrame(tick);
        else setPhase('done');
      };
      tick();
    }, 1400);
    t3 = setTimeout(() => {
      // Demo: usa el primer código de muestra como "detectado"
      onLookup && onLookup(SAMPLE_BARCODES[0].code);
    }, 3400);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [mode]);

  const submitManual = async (code) => {
    const c = (code || manualCode).trim();
    if (!c) return;
    setLoading(true); setError(null);
    try {
      await onLookup(c);
    } catch (e) {
      setError(e.code === 'not_found' ? 'No encontrado en Open Food Facts' : 'Error de red. ¿Tienes conexión?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%',
      background: mode === 'camera' ? '#0A0F0B' : tokens.bg,
      overflow: 'hidden', fontFamily: fonts.sans,
    }}>
      {/* Camera backdrop only when in camera mode */}
      {mode === 'camera' && (
        <div style={{
          position: 'absolute', inset: 0,
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
          background: mode === 'camera' ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.06)',
          border: 'none', cursor: 'pointer',
          backdropFilter: 'blur(20px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 2l10 10M12 2L2 12" stroke={mode === 'camera' ? '#fff' : tokens.ink} strokeWidth="2.2" strokeLinecap="round"/>
          </svg>
        </button>

        <div style={{
          padding: '8px 14px', borderRadius: 999,
          background: mode === 'camera' ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.06)',
          backdropFilter: 'blur(20px)',
          color: mode === 'camera' ? '#fff' : tokens.ink, fontSize: 13, fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {mode === 'camera' ? (
            <>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: '#5DD78A', boxShadow: '0 0 8px #5DD78A', animation: 'gz-pulse 1.4s ease-in-out infinite' }} />
              {phase === 'aiming' && 'Buscando código…'}
              {phase === 'detecting' && 'Analizando'}
              {phase === 'done' && 'Detectado'}
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
          background: mode === 'camera' ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.06)',
          backdropFilter: 'blur(20px)',
          padding: 4, borderRadius: 999,
          display: 'flex', gap: 2,
          border: mode === 'camera' ? '1px solid rgba(255,255,255,0.1)' : `1px solid ${tokens.divider}`,
        }}>
          {[
            { id: 'camera', label: 'Cámara' },
            { id: 'manual', label: 'Manual' },
          ].map(m => (
            <button key={m.id} onClick={() => setMode(m.id)} style={{
              padding: '8px 16px', borderRadius: 999, border: 'none',
              background: mode === m.id ? '#fff' : 'transparent',
              color: mode === m.id ? tokens.greenDeep : (mode === 'camera' ? 'rgba(255,255,255,0.85)' : tokens.inkSoft),
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              fontFamily: fonts.sans, letterSpacing: -0.1,
            }}>{m.label}</button>
          ))}
        </div>
      </div>

      {/* CAMERA reticle */}
      {mode === 'camera' && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 280, height: 180, zIndex: 5,
        }}>
          {[
            { top: 0, left: 0, borders: 'tl' },
            { top: 0, right: 0, borders: 'tr' },
            { bottom: 0, left: 0, borders: 'bl' },
            { bottom: 0, right: 0, borders: 'br' },
          ].map((c, i) => {
            const b = c.borders;
            const stroke = phase === 'done' ? '#5DD78A' : '#fff';
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
          {phase !== 'done' && (
            <div style={{
              position: 'absolute', left: 8, right: 8, top: '50%', height: 2,
              background: 'linear-gradient(90deg, transparent, #5DD78A, transparent)',
              boxShadow: '0 0 16px #5DD78A',
              animation: 'gz-scan 1.6s ease-in-out infinite',
            }} />
          )}
        </div>
      )}

      {/* MANUAL form */}
      {mode === 'manual' && (
        <div style={{
          position: 'absolute', top: 180, left: 0, right: 0, bottom: 0,
          padding: '0 24px', overflow: 'auto',
        }}>
          <h2 style={{
            fontFamily: fonts.serif, fontSize: 26, fontWeight: 500,
            margin: '20px 0 6px', color: tokens.ink, letterSpacing: -0.4, lineHeight: 1.15,
          }}>Introduce el código de barras</h2>
          <p style={{
            margin: '0 0 22px', fontSize: 14.5, color: tokens.inkSoft, lineHeight: 1.45,
          }}>
            Consultaremos la base de datos de Open Food Facts.
          </p>

          <div style={{ position: 'relative' }}>
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
                background: '#fff', padding: '0 16px',
                fontSize: 18, fontFamily: 'ui-monospace, monospace',
                color: tokens.ink, letterSpacing: 0.5, outline: 'none',
                boxSizing: 'border-box',
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
                  background: '#fff', border: `1px solid ${tokens.divider}`,
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
        </div>
      )}

      {/* CAMERA bottom panel */}
      {mode === 'camera' && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10,
          background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.7) 50%)',
          padding: '80px 24px 50px',
        }}>
          <div style={{ textAlign: 'center', color: '#fff', fontSize: 15, fontWeight: 500, marginBottom: 14, letterSpacing: -0.2 }}>
            Centra el código de barras en el recuadro
          </div>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 999, overflow: 'hidden', maxWidth: 240, margin: '0 auto 10px' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: '#5DD78A', boxShadow: '0 0 8px #5DD78A' }} />
          </div>
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
            La detección automática llegará pronto. Por ahora muestra un producto de demo.
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
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Screen 3: RESULT
// ─────────────────────────────────────────────────────────────
function ResultScreen({ product, onClose, onScanAgain }) {
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
          background: '#fff', borderRadius: 22,
          padding: 18, display: 'flex', gap: 14, alignItems: 'center',
          boxShadow: '0 8px 24px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <div style={{
            width: 68, height: 68, borderRadius: 16,
            background: product.imgBg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 34, flexShrink: 0,
          }}>{product.image}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 17, fontWeight: 600, color: tokens.ink,
              letterSpacing: -0.3,
            }}>{product.name}</div>
            <div style={{ fontSize: 14, color: tokens.inkMuted, marginTop: 2 }}>
              {product.brand}
            </div>
            <div style={{
              fontSize: 11.5, color: tokens.inkMuted, marginTop: 6,
              fontFamily: 'ui-monospace, monospace', letterSpacing: 0.4,
            }}>{product.barcode}</div>
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
        }}>Ingredientes detectados</h2>

        <div style={{
          background: '#fff', borderRadius: 16,
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
      </div>

      {/* Cross-contamination */}
      <div style={{ padding: '20px 20px 0' }}>
        <h2 style={{
          fontSize: 13, fontWeight: 600, margin: '0 0 12px',
          color: tokens.inkMuted, textTransform: 'uppercase',
          letterSpacing: 0.6,
        }}>Contaminación cruzada</h2>
        <div style={{
          background: '#fff', borderRadius: 16, padding: 16,
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
          background: '#fff', borderRadius: 16, padding: 16,
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
        <button style={{
          height: 50, borderRadius: 16, cursor: 'pointer',
          background: 'transparent', color: tokens.ink,
          border: `1px solid ${tokens.divider}`,
          fontSize: 15, fontWeight: 500, fontFamily: fonts.sans,
          letterSpacing: -0.2,
        }}>Guardar en favoritos</button>
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
  const [screen, setScreen] = useState('home'); // home | scanner | result
  const [scanMode, setScanMode] = useState('manual');
  const [resultProduct, setResultProduct] = useState(PRODUCTS[tweaks.resultState] || PRODUCTS.apto);

  const goScan = () => setScreen('scanner');
  const goHome = () => setScreen('home');

  // Real lookup: call Open Food Facts and analyze
  const onLookup = async (barcode) => {
    const raw = await OFF.fetchProduct(barcode);
    const analyzed = GlutenEngine.analyze(raw);
    setResultProduct(analyzed);
    setScreen('result');
  };

  useEffect(() => {
    if (screen === 'result' && PRODUCTS[tweaks.resultState]) {
      // tweak override (demo)
      setResultProduct(PRODUCTS[tweaks.resultState]);
    }
  }, [tweaks.resultState]);

  return (
    <>
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
            <HomeScreen onScan={goScan} userName={tweaks.userName} />
          </div>
          <BottomTabs active="home" onScan={goScan} />
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
              onCancel={goHome} onLookup={onLookup}
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
