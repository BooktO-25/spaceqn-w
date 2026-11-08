import React from 'react';
import { PageContent, PAGE_THEMES } from '../types';
import { Quote } from 'lucide-react';

export const PageContentRenderer: React.FC<{ page: PageContent }> = ({ page }) => {
  const theme = PAGE_THEMES.find(t => t.id === page.themeId) || PAGE_THEMES[0];

  const wrapperStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    background: theme.bg,
    color: theme.text,
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    overflow: 'hidden',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  };

  if (page.templateId === 'ANNOUNCEMENT') {
    return (
      <div style={wrapperStyle}>
        {page.imageUrl && (
          <>
            <img src={page.imageUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.35 }} />
            <div style={{ position: 'absolute', inset: 0, background: theme.bg, opacity: 0.55 }} />
          </>
        )}
        <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '6% 8%' }}>
          <div style={{ width: 64, height: 5, borderRadius: 999, background: theme.accent, marginBottom: '3%' }} />
          <div style={{ fontSize: 'clamp(28px, 6vw, 76px)', fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.02em', maxWidth: '90%' }}>
            {page.headline || 'Your Headline Here'}
          </div>
          {page.subheading && (
            <div style={{ fontSize: 'clamp(14px, 2vw, 28px)', color: theme.textDim, marginTop: '2.5%', maxWidth: '75%', fontWeight: 500 }}>
              {page.subheading}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (page.templateId === 'OFFER') {
    return (
      <div style={wrapperStyle}>
        {page.imageUrl && (
          <img src={page.imageUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.25 }} />
        )}
        <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6% 8%', gap: '4%' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 'clamp(24px, 5vw, 60px)', fontWeight: 800, lineHeight: 1.08, letterSpacing: '-0.02em' }}>
              {page.headline || 'Special Offer'}
            </div>
            {page.subheading && (
              <div style={{ fontSize: 'clamp(13px, 1.8vw, 24px)', color: theme.textDim, marginTop: '3%', fontWeight: 500, maxWidth: '90%' }}>
                {page.subheading}
              </div>
            )}
          </div>
          {page.badgeText && (
            <div style={{
              flexShrink: 0, width: 'clamp(120px, 22vw, 260px)', height: 'clamp(120px, 22vw, 260px)',
              borderRadius: '50%', background: theme.accent, color: theme.onAccent,
              display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
              fontSize: 'clamp(18px, 3.2vw, 40px)', fontWeight: 900, lineHeight: 1.1, padding: '8%',
              boxShadow: '0 20px 50px rgba(0,0,0,0.35)', transform: 'rotate(-6deg)',
            }}>
              {page.badgeText}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (page.templateId === 'MENU') {
    return (
      <div style={wrapperStyle}>
        <div style={{ padding: '5% 8% 2%' }}>
          <div style={{ fontSize: 'clamp(22px, 4vw, 48px)', fontWeight: 800, letterSpacing: '-0.01em' }}>
            {page.headline || 'Menu'}
          </div>
          {page.subheading && (
            <div style={{ fontSize: 'clamp(11px, 1.4vw, 18px)', color: theme.textDim, marginTop: '0.5%', fontWeight: 500 }}>
              {page.subheading}
            </div>
          )}
          <div style={{ width: '100%', height: 2, background: theme.accent, opacity: 0.3, marginTop: '3%' }} />
        </div>
        <div style={{ flex: 1, overflow: 'hidden', padding: '1% 8% 5%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '2.2%' }}>
          {(page.items && page.items.length > 0 ? page.items : [{ label: 'Item Name', price: '₹0' }]).map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <span style={{ fontSize: 'clamp(15px, 2.2vw, 30px)', fontWeight: 600 }}>{item.label}</span>
              <span style={{ flex: 1, borderBottom: `2px dotted ${theme.textDim}`, opacity: 0.4, transform: 'translateY(-6px)' }} />
              <span style={{ fontSize: 'clamp(15px, 2.2vw, 30px)', fontWeight: 800, color: theme.accent }}>{item.price}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // QUOTE
  return (
    <div style={wrapperStyle}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '6% 12%' }}>
        <Quote size={40} color={theme.accent} style={{ opacity: 0.7, marginBottom: '2%' }} />
        <div style={{ fontSize: 'clamp(20px, 3.6vw, 48px)', fontWeight: 600, lineHeight: 1.3, fontStyle: 'italic', maxWidth: '85%' }}>
          {page.bodyText || 'Your inspiring quote goes here.'}
        </div>
        {page.attribution && (
          <div style={{ marginTop: '4%', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 28, height: 2, background: theme.accent }} />
            <span style={{ fontSize: 'clamp(12px, 1.6vw, 20px)', color: theme.textDim, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              {page.attribution}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
