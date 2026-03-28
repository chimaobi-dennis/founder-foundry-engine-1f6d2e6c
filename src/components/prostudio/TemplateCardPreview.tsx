interface Props {
  template: { id: string; name: string };
  brandName: string;
}

const previews: Record<string, {
  background: string;
  overlay: string;
  productBg: string;
  productColor: string;
  textColor: string;
  showFrame: boolean;
  fontStyle: string;
}> = {
  'marble-luxury': {
    background: '#F2EDE6',
    overlay: 'radial-gradient(ellipse at 30% 20%, rgba(220,210,195,0.7) 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, rgba(200,190,175,0.5) 0%, transparent 50%)',
    productBg: '#FFFFFF', productColor: '#2D4A3E', textColor: '#4A3A28',
    showFrame: true, fontStyle: 'serif',
  },
  'dark-moody-studio': {
    background: '#141210',
    overlay: 'radial-gradient(ellipse at 70% 20%, rgba(212,160,23,0.2) 0%, transparent 55%)',
    productBg: '#FFFFFF', productColor: '#141210', textColor: 'rgba(245,240,232,0.6)',
    showFrame: false, fontStyle: 'sans-serif',
  },
  'linen-flat-lay': {
    background: '#EDE5D5', overlay: 'none',
    productBg: '#FFFFFF', productColor: '#2D4A3E', textColor: '#6A5A48',
    showFrame: false, fontStyle: 'serif',
  },
  'outdoor-lifestyle': {
    background: 'linear-gradient(135deg, #A8C4B0, #6A9A7C)', overlay: 'none',
    productBg: '#FFFFFF', productColor: '#2D4A3E', textColor: 'rgba(255,255,255,0.9)',
    showFrame: false, fontStyle: 'sans-serif',
  },
  'sunrise-window': {
    background: 'linear-gradient(180deg, #E8C878 0%, #F5E8C0 50%, #F0E0A8 100%)', overlay: 'none',
    productBg: '#FFFFFF', productColor: '#8A6020', textColor: 'rgba(100,70,20,0.7)',
    showFrame: false, fontStyle: 'sans-serif',
  },
  'minimal-white': {
    background: '#FAFAF8', overlay: 'none',
    productBg: '#FFFFFF', productColor: '#2D4A3E', textColor: '#8A8078',
    showFrame: true, fontStyle: 'sans-serif',
  },
  'urban-street': {
    background: '#7A8898', overlay: 'none',
    productBg: '#FFFFFF', productColor: '#3A4858', textColor: 'rgba(255,255,255,0.8)',
    showFrame: false, fontStyle: 'sans-serif',
  },
  'night-neon': {
    background: '#080A14',
    overlay: 'radial-gradient(ellipse at 50% 55%, rgba(45,74,62,0.5) 0%, transparent 65%)',
    productBg: '#FFFFFF', productColor: '#2D4A3E', textColor: 'rgba(212,240,220,0.7)',
    showFrame: false, fontStyle: 'sans-serif',
  },
  'raw-concrete': {
    background: '#909090',
    overlay: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.03) 0px, rgba(0,0,0,0.03) 1px, transparent 1px, transparent 8px)',
    productBg: '#FFFFFF', productColor: '#404040', textColor: 'rgba(255,255,255,0.6)',
    showFrame: false, fontStyle: 'sans-serif',
  },
  'forest-floor': {
    background: '#283828', overlay: 'none',
    productBg: '#FFFFFF', productColor: '#2D4A3E', textColor: 'rgba(200,220,200,0.7)',
    showFrame: false, fontStyle: 'serif',
  },
  'rooftop-golden-hour': {
    background: 'linear-gradient(160deg, #C87820, #E8A030, #F0C060)', overlay: 'none',
    productBg: '#FFFFFF', productColor: '#8A5010', textColor: 'rgba(255,255,255,0.9)',
    showFrame: false, fontStyle: 'sans-serif',
  },
  'cafe-counter': {
    background: 'linear-gradient(180deg, #6A4A30, #4A3020)',
    overlay: 'radial-gradient(ellipse at 50% 80%, rgba(180,120,60,0.25) 0%, transparent 50%)',
    productBg: '#FFFFFF', productColor: '#4A3020', textColor: 'rgba(220,200,180,0.7)',
    showFrame: false, fontStyle: 'sans-serif',
  },
};

const fallback = previews['minimal-white'];

export function TemplateCardPreview({ template, brandName }: Props) {
  const s = previews[template.id] || fallback;
  const initials = brandName ? brandName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'NF';

  return (
    <div style={{ width: '100%', height: '220px', position: 'relative', overflow: 'hidden', background: s.background }}>
      {s.overlay !== 'none' && <div style={{ position: 'absolute', inset: 0, background: s.overlay }} />}
      {s.showFrame && <div style={{ position: 'absolute', inset: '12px', border: '0.5px solid rgba(150,140,130,0.25)', borderRadius: '2px', pointerEvents: 'none' as const }} />}

      {/* Product placeholder */}
      <div style={{
        position: 'absolute', left: '50%', top: '45%', transform: 'translate(-50%, -50%)',
        width: '52px', height: '80px', background: s.productBg, borderRadius: '3px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '7px', color: s.productColor, textAlign: 'center' as const, padding: '4px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.15)', fontFamily: s.fontStyle,
      }}>
        {initials}
      </div>

      {/* Brand label */}
      <div style={{
        position: 'absolute', bottom: '10px', left: '12px',
        fontSize: '7px', letterSpacing: '0.15em', color: s.textColor,
        fontFamily: s.fontStyle, textTransform: 'uppercase' as const,
      }}>
        {'NORDFORM'}
      </div>

      {/* Template-specific decorations */}
      {template.id === 'urban-street' && (
        <>
          <div style={{ position: 'absolute', left: '20%', top: 0, bottom: 0, width: '0.5px', background: 'rgba(255,255,255,0.08)' }} />
          <div style={{ position: 'absolute', left: '40%', top: 0, bottom: 0, width: '0.5px', background: 'rgba(255,255,255,0.08)' }} />
          <div style={{ position: 'absolute', left: '60%', top: 0, bottom: 0, width: '0.5px', background: 'rgba(255,255,255,0.08)' }} />
          <div style={{ position: 'absolute', top: '14px', left: '12px', fontSize: '28px', fontWeight: '700', color: 'rgba(255,255,255,0.05)', lineHeight: 1 }}>{initials}</div>
        </>
      )}
      {template.id === 'rooftop-golden-hour' && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '22%', display: 'flex', alignItems: 'flex-end', gap: '3px', padding: '0 8px' }}>
          {[18, 28, 14, 22, 16, 20, 12].map((h, i) => (
            <div key={i} style={{ flex: 1, height: `${h}px`, background: 'rgba(0,0,0,0.18)', borderRadius: '1px 1px 0 0' }} />
          ))}
        </div>
      )}
      {template.id === 'sunrise-window' && (
        <>
          <div style={{ position: 'absolute', left: '28%', top: 0, bottom: 0, width: '2px', background: 'rgba(180,140,40,0.15)' }} />
          <div style={{ position: 'absolute', left: '31%', top: 0, bottom: 0, width: '2px', background: 'rgba(180,140,40,0.15)' }} />
        </>
      )}
      {template.id === 'linen-flat-lay' && (
        <>
          <div style={{ position: 'absolute', top: '18px', left: '18px', width: '12px', height: '12px', borderRadius: '50%', background: '#C8B89A', opacity: 0.6 }} />
          <div style={{ position: 'absolute', bottom: '22px', left: '14px', width: '28px', height: '2px', background: '#B8A88A', transform: 'rotate(-25deg)', opacity: 0.5 }} />
          <div style={{ position: 'absolute', bottom: '18px', right: '16px', width: '8px', height: '8px', background: '#D8C8B0', opacity: 0.5 }} />
        </>
      )}
      {template.id === 'forest-floor' && (
        <>
          <div style={{ position: 'absolute', bottom: '-10px', left: '-10px', width: '80px', height: '40px', borderRadius: '50%', background: 'rgba(45,74,62,0.35)', transform: 'rotate(-20deg)' }} />
          <div style={{ position: 'absolute', top: '10px', right: '-5px', width: '40px', height: '20px', borderRadius: '50%', background: 'rgba(60,90,50,0.25)' }} />
        </>
      )}
    </div>
  );
}
