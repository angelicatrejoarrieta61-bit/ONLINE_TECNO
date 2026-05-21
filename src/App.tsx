import React, { useEffect, useState, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { loadStorefrontData } from './lib/queries';
import { getImageUrl } from './lib/supabase';
import { AdminConfig } from './pages/admin/AdminConfig';

// ─── CART CONTEXT ────────────────────────────────────────────────────────────

interface CartItem {
  id: string;
  name: string;
  price: number;
  image_url: string;
  sku?: string;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  addItem: (product: any) => void;
  removeItem: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  clearCart: () => void;
  total: number;
  count: number;
}

const CartContext = createContext<CartContextType | null>(null);

const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
};

const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = (product: any) => {
    setItems(prev => {
      const existing = prev.find(i => i.id === product.id);
      if (existing) {
        return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, {
        id: product.id,
        name: product.name,
        price: product.price,
        image_url: product.image_url,
        sku: product.sku,
        quantity: 1
      }];
    });
  };

  const removeItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id));

  const updateQty = (id: string, qty: number) => {
    if (qty <= 0) { removeItem(id); return; }
    setItems(prev => prev.map(i => i.id === id ? { ...i, quantity: qty } : i));
  };

  const clearCart = () => setItems([]);

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const count = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQty, clearCart, total, count }}>
      {children}
    </CartContext.Provider>
  );
};

// ─── CART DRAWER ─────────────────────────────────────────────────────────────

const CartDrawer = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const { items, removeItem, updateQty, total, clearCart } = useCart();

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)', zIndex: 900
        }}
      />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 420,
        background: '#111', borderLeft: '1px solid #222',
        zIndex: 901, display: 'flex', flexDirection: 'column',
        animation: 'slideInRight 0.28s cubic-bezier(0.22,1,0.36,1)'
      }}>
        <style>{`
          @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to   { transform: translateX(0);    opacity: 1; }
          }
        `}</style>

        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'white', letterSpacing: 1 }}>
            CARRITO <span style={{ color: '#00A859', fontSize: 13 }}>({items.length} {items.length === 1 ? 'artículo' : 'artículos'})</span>
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        {/* Items */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {items.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#444', gap: 12 }}>
              <span style={{ fontSize: 48 }}>🛒</span>
              <p style={{ margin: 0, fontSize: 14 }}>Tu carrito está vacío</p>
            </div>
          ) : items.map(item => (
            <div key={item.id} style={{ display: 'flex', gap: 14, background: '#0a0a0a', borderRadius: 12, padding: 14, border: '1px solid #222' }}>
              <div style={{ width: 70, height: 70, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: '#000' }}>
                <img src={getImageUrl(item.image_url)} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'white', lineHeight: 1.3 }}>{item.name}</div>
                {item.sku && <div style={{ fontSize: 9, color: '#00A859', letterSpacing: 1 }}>#{item.sku}</div>}
                <div style={{ fontSize: 15, fontWeight: 900, color: '#00A859' }}>${(item.price * item.quantity).toFixed(2)} MXN</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                  <button onClick={() => updateQty(item.id, item.quantity - 1)} style={{ width: 24, height: 24, borderRadius: 6, background: '#222', border: 'none', color: 'white', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>−</button>
                  <span style={{ fontSize: 13, color: 'white', fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{item.quantity}</span>
                  <button onClick={() => updateQty(item.id, item.quantity + 1)} style={{ width: 24, height: 24, borderRadius: 6, background: '#222', border: 'none', color: 'white', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>+</button>
                  <button onClick={() => removeItem(item.id)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#444', cursor: 'pointer', fontSize: 16 }}>🗑️</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div style={{ padding: '20px 24px', borderTop: '1px solid #222', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#888', fontSize: 13 }}>Subtotal</span>
              <span style={{ color: 'white', fontSize: 20, fontWeight: 900 }}>${total.toFixed(2)} <span style={{ fontSize: 12, color: '#666' }}>MXN</span></span>
            </div>
            <button style={{ background: '#00A859', color: 'white', border: 'none', padding: '16px', borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: 'pointer', letterSpacing: 1 }}>
              PROCEDER AL PAGO →
            </button>
            <button onClick={clearCart} style={{ background: 'transparent', color: '#444', border: '1px solid #222', padding: '10px', borderRadius: 12, fontSize: 12, cursor: 'pointer' }}>
              Vaciar carrito
            </button>
          </div>
        )}
      </div>
    </>
  );
};

// ─── UTILS ───────────────────────────────────────────────────────────────────

const loadGoogleFont = (fontName: string) => {
  if (!fontName) return;
  const id = `gf-${fontName.replace(/\s+/g, '-').toLowerCase()}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(/\s+/g, '+')}:wght@300;400;500;600;700;800;900&display=swap`;
  document.head.appendChild(link);
};

// ─── COMPONENTS ──────────────────────────────────────────────────────────────

const Logo = ({ url }: { url?: string }) => {
  if (url) return <img src={getImageUrl(url)} alt="Logo" style={{ height: 35 }} />;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 32, height: 32, backgroundColor: '#00A859', borderRadius: '4px', position: 'relative' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(45deg)', width: 14, height: 14, borderTop: '3px solid white', borderLeft: '3px solid white' }}></div>
      </div>
      <div style={{ color: 'white', fontWeight: 800, fontSize: 20, letterSpacing: '-1px', lineHeight: 1 }}>
        TECNOCASA <span style={{ fontWeight: 400, fontSize: 10, display: 'block', opacity: 0.8 }}>GROUP</span>
      </div>
    </div>
  );
};

const HeroSlider = ({ images }: { images: string }) => {
  const imageList = images
    ? images.split(',').map((s) => s.trim()).filter(Boolean)
    : ['tecnocasa_hero_lifestyle_1777699998792.png'];
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (imageList.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % imageList.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [imageList.length]);

  return (
    <div className="hero-slider-v3">
      {imageList.map((img, idx) => (
        <div
          key={idx}
          className={`hero-slide-v3 ${idx === currentIndex ? 'active' : ''}`}
          style={{ backgroundImage: `url(${getImageUrl(img)})`, backgroundAttachment: 'scroll' }}
        />
      ))}
    </div>
  );
};

const ProductCard = ({ product, onQuickview }: any) => {
  const { addItem } = useCart();
  const [qrExpanded, setQrExpanded] = useState(false);
  const [added, setAdded] = useState(false);
  const productCode = product.sku || product.id;
  const qrData = `${window.location.origin}/product/${productCode}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}`;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    addItem(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div className="product-card">
      <div className="product-card__visual">
        <div className="card-wishlist">♡</div>

        {!qrExpanded && (
          <div className="qr-internal-container" onClick={() => setQrExpanded(true)}>
            <span className="qr-internal-title">QR PRODUCTO</span>
            <div className="qr-small-trigger">
              <img src={qrUrl} alt="QR" className="qr-mini" />
              <div className="qr-dot-mini"></div>
            </div>
          </div>
        )}

        <img src={getImageUrl(product.image_url)} alt={product.name} className="product-image" />
        <div className="quickview-pill" onClick={(e) => onQuickview(product, e)}>
          <span>👁️</span> QUICKVIEW
        </div>
      </div>

      <div className="product-card__info">
        <h3 className="product-title">{product.name}</h3>
        <div className="title-line"></div>
        <div className="price-row">
          <div className="price-box">
            <span className="price-symbol">$</span>
            <span className="price-value">{product.price}</span>
            <span className="price-currency">MXN</span>
          </div>
          {product.sku && (
            <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', fontWeight: 700, letterSpacing: 1 }}>{product.sku}</span>
          )}
        </div>
      </div>

      {qrExpanded && (
        <div className="qr-expansion-overlay" onClick={() => setQrExpanded(false)}>
          <div className="qr-expanded-content">
            <div className="qr-expanded-title">{product.name}</div>
            <div className="qr-big-box">
              <img src={qrUrl} alt="QR" className="qr-image" />
            </div>
            <div style={{ color: '#00A859', fontSize: 10, fontWeight: 800, letterSpacing: 1, background: 'rgba(0,168,89,0.1)', padding: '4px 12px', borderRadius: 20, maxWidth: '80%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              #{product.sku ? productCode : productCode.split('-')[0]}
            </div>
            <div className="qr-close-hint">Toca para cerrar</div>
          </div>
        </div>
      )}

      <button className="btn-metalized" onClick={handleAddToCart} style={{ transition: 'background 0.2s', background: added ? '#007a40' : undefined }}>
        <span className="metal-icon">{added ? '✓' : '🛒'}</span>
        <span>{added ? 'AGREGADO' : 'COMPRAR'}</span>
      </button>
    </div>
  );
};

const QuickviewModal = ({ product, origin, onClose }: any) => {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  if (!product || !origin) return null;
  const productCode = product.sku || product.id;
  const qrData = `${window.location.origin}/product/${productCode}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}`;

  const screenCenterX = window.innerWidth / 2;
  const screenCenterY = window.innerHeight / 2;
  const startX = origin.overrideX !== null ? origin.overrideX - screenCenterX : (origin.x + origin.width / 2) - screenCenterX;
  const startY = (origin.y + origin.height / 2) - screenCenterY;

  const handleAddToCart = () => {
    addItem(product);
    setAdded(true);
    setTimeout(() => { setAdded(false); onClose(); }, 1200);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content-pro"
        onClick={e => e.stopPropagation()}
        style={{ '--start-left': `${startX}px`, '--start-top': `${startY}px`, '--anim-name': 'perspectiveRight' } as any}
      >
        <button className="modal-close" onClick={onClose}>×</button>
        <div className="modal-body-grid">
          <div className="modal-image-panel">
            <div className="modal-image-glow"></div>
            <img src={getImageUrl(product.image_url)} alt={product.name} className="modal-main-img" />
          </div>
          <div className="modal-details-panel">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 4 }}>
              <span className="modal-category">{product.category || 'Colección Oficial'}</span>
              {product.sku && (
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: 700, letterSpacing: 1.5, background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: 20 }}>{product.sku}</span>
              )}
            </div>
            <h2 className="modal-title">{product.name}</h2>
            <div className="modal-price-qr-row">
              <div className="modal-price-row">
                <span className="symbol">$</span>
                <span className="val">{product.price}</span>
                <span className="cur">MXN</span>
              </div>
              <div className="modal-qr-section-small">
                <img src={qrUrl} alt="QR" className="modal-qr" />
              </div>
            </div>
            <div className="modal-divider"></div>
            <p className="modal-description">
              {product.description || 'Este producto oficial de Tecnocasa Group ha sido diseñado con los más altos estándares de calidad.'}
            </p>
          </div>
        </div>
        <button className="btn-metalized modal-btn-bottom" onClick={handleAddToCart} style={{ transition: 'background 0.2s', background: added ? '#007a40' : undefined }}>
          <span className="metal-icon">{added ? '✓' : '🛒'}</span> {added ? 'AGREGADO AL CARRITO' : 'COMPRAR'}
        </button>
      </div>
    </div>
  );
};

// ─── FRONT STORE ─────────────────────────────────────────────────────────────

const FrontStore = () => {
  const { count } = useCart();
  const [config, setConfig] = useState<any>({});
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchErrors, setFetchErrors] = useState<string[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [originRect, setOriginRect] = useState<any>(null);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    loadStorefrontData().then(({ config: cfg, products: prods, fetchErrors: errs }) => {
      setConfig(cfg);
      setProducts(prods);
      setFetchErrors(errs);
      setLoading(false);

      const root = document.documentElement;
      if (cfg.primary_color) root.style.setProperty('--c-primary', cfg.primary_color);
      if (cfg.font_titles) { loadGoogleFont(cfg.font_titles); root.style.setProperty('--font-titles', `'${cfg.font_titles}', serif`); }
      if (cfg.font_subtitles) { loadGoogleFont(cfg.font_subtitles); root.style.setProperty('--font-subtitles', `'${cfg.font_subtitles}', sans-serif`); }
      if (cfg.font_body) { loadGoogleFont(cfg.font_body); root.style.setProperty('--font-main', `'${cfg.font_body}', sans-serif`); }
    });
  }, []);

  useEffect(() => {
    if (selectedProduct) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [selectedProduct]);

  const handleQuickview = (product: any, e: React.MouseEvent) => {
    const cardElement = (e.target as HTMLElement).closest('.product-card');
    if (cardElement) {
      const rect = cardElement.getBoundingClientRect();
      const allCards = Array.from(document.querySelectorAll('.product-card'));
      const index = allCards.indexOf(cardElement);
      const gridContainer = document.querySelector('.products-grid-v3');
      const gridRect = gridContainer?.getBoundingClientRect() || { left: 0 };
      let overrideX = null;
      if (index === 0) overrideX = gridRect.left;
      if (index === 1) overrideX = gridRect.left + 472;
      setOriginRect({ x: rect.left, y: rect.top, width: rect.width, height: rect.height, overrideX });
      setSelectedProduct(product);
    }
  };

  const closeQuickview = () => { setSelectedProduct(null); setOriginRect(null); };

  if (loading) return <div className="loading-screen">Cargando Tecnocasa Boutique...</div>;

  const categories = [
    { id: 'agendas', name: 'Agendas', i: '📓' },
    { id: 'bolsas', name: 'Bolsas', i: '👜' },
    { id: 'tazas', name: 'Tazas', i: '☕' },
    { id: 'termos', name: 'Termos y botellas', i: '🍶' },
    { id: 'escritorio', name: 'Escritorio', i: '✒️' },
    { id: 'tecnologia', name: 'Tecnología', i: '⌚' },
    { id: 'textiles', name: 'Textiles', i: '👕' },
    { id: 'mas', name: 'Más categorías', i: '📁' }
  ];

  return (
    <div className="storefront-v1">
      {fetchErrors.length > 0 && (
        <div role="alert" style={{ background: '#3d1515', color: '#ffb4b4', padding: '12px 16px', fontSize: 13, lineHeight: 1.45, borderBottom: '1px solid #662020' }}>
          <strong style={{ color: '#fff' }}>No se pudo cargar la base de datos correctamente.</strong>
          <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
            {fetchErrors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
          <p style={{ margin: '8px 0 0', opacity: 0.9 }}>
            En Supabase: SQL Editor → pega y ejecuta el archivo <code style={{ color: '#8cffb4' }}>supabase_db_setup.sql</code>. Comprueba también API URL y anon key en <strong>Project Settings → API</strong>.
          </p>
        </div>
      )}
      {fetchErrors.length === 0 && products.length === 0 && !loading && (
        <div style={{ background: '#1a2e1f', color: '#a8e6c1', padding: '12px 16px', fontSize: 13, borderBottom: '1px solid #2a4a32' }}>
          Conexión correcta, pero <strong>no hay productos activos</strong>. Entra a <Link to="/admin" style={{ color: '#00ff88' }}>/admin</Link> y crea productos.
        </div>
      )}

      <div className="announcement-bar">
        <span>🚚 Envíos a todo el país  •  Productos oficiales Tecnocasa</span>
      </div>

      <header className="main-header dark-header">
        <div className="container header-container">
          <Link to="/" className="brand-logo"><Logo url={config.logo_url} /></Link>
          <nav className="nav-menu">
            <a href="#" className="active">Tienda</a>
            <a href="#">Colecciones</a>
            <a href="#">Franquiciatarios</a>
            <a href="#">Personalización</a>
            <a href="#">Nosotros</a>
            <a href="#">Contacto</a>
          </nav>
          <div className="header-actions">
            <div className="search-pill">
              <input type="text" placeholder="Buscar productos..." />
              <span>🔍</span>
            </div>
            <div
              className="cart-pill"
              onClick={() => setCartOpen(true)}
              style={{ cursor: 'pointer', position: 'relative', userSelect: 'none' }}
            >
              🛒
              <span
                className="count"
                style={{
                  background: count > 0 ? '#00A859' : undefined,
                  color: count > 0 ? 'white' : undefined,
                  minWidth: 18,
                  height: 18,
                  borderRadius: 9,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '0 4px',
                  transition: 'background 0.2s'
                }}
              >
                {count}
              </span>
            </div>
            <Link to="/admin" className="admin-trigger">⚙️</Link>
          </div>
        </div>
      </header>

      <section className="hero-section" style={{ backgroundColor: config.hero_bg_color || '#fdf2f4' }}>
        <div className="container hero-layout">
          <div className="hero-text-content">
            <div className="hero-tag">💖 {config.hero_tag || '10 DE MAYO'}</div>
            <h1 className="hero-display-title">
              Para quien siempre ha <br />
              <span className="highlight">creído</span> en ti.
            </h1>
            <p className="hero-description">
              {config.hero_subtitle || 'Celebra a mamá con detalles que inspiran, acompañan y perduran todos los días.'}
            </p>
            <div className="hero-actions">
              <button className="btn-primary-rect">Ver regalos para mamá →</button>
            </div>
          </div>
        </div>
        <div className="hero-image-side">
          <HeroSlider images={config.hero_images_list} />
        </div>
      </section>

      <section className="categories-pill-bar">
        <div className="container">
          <div className="floating-pill-inner">
            {categories.map(cat => (
              <div key={cat.id} className="pill-item">
                <div className="pill-icon">
                  {config[`cat_${cat.id}_img`] ? (
                    <img src={getImageUrl(config[`cat_${cat.id}_img`])} alt={cat.name} style={{ width: 32, height: 32, objectFit: 'contain' }} />
                  ) : cat.i}
                </div>
                <span>{cat.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <main className="catalog-container">
        <div className="container">
          <div className="section-header">
            <h2 className="catalog-general-title">Catálogo General</h2>
          </div>
          <div className="products-grid-v3">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} onQuickview={handleQuickview} />
            ))}
          </div>
        </div>
      </main>

      <QuickviewModal
        key={selectedProduct?.id || 'none'}
        product={selectedProduct}
        origin={originRect}
        onClose={closeQuickview}
      />

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />

      <footer className="footer-dark">
        <div className="container">
          <p>© 2024 Tecnocasa Group. Productos oficiales.</p>
        </div>
      </footer>
    </div>
  );
};

// ─── APP ROOT ─────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <CartProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<FrontStore />} />
          <Route path="/admin" element={<AdminConfig />} />
        </Routes>
      </BrowserRouter>
    </CartProvider>
  );
}
