import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { loadStorefrontData } from './lib/queries';
import { getImageUrl } from './lib/supabase';
import { AdminConfig } from './pages/admin/AdminConfig';

/** Carga dinámicamente una fuente de Google Fonts en el <head> */
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
          style={{ 
            backgroundImage: `url(${getImageUrl(img)})`,
            backgroundAttachment: 'scroll'
          }}
        />
      ))}
    </div>
  );
};

const ProductCard = ({ product, onQuickview }: any) => {
  const [qrExpanded, setQrExpanded] = useState(false);
  // Usa SKU único si existe, sino el UUID — garantiza QR único por producto
  const productCode = product.sku || product.id;
  const qrData = `${window.location.origin}/product/${productCode}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}`;

  return (
    <div className="product-card">
      <div className="product-card__visual">
        <div className="card-wishlist">♡</div>
        
        {/* INTERNAL QR WITH WHITE TITLE */}
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

      <button className="btn-metalized">
        <span className="metal-icon">🛒</span>
        <span>COMPRAR</span>
      </button>
    </div>
  );
};

const QuickviewModal = ({ product, origin, onClose }: any) => {
  if (!product || !origin) return null;
  const productCode = product.sku || product.id;
  const qrData = `${window.location.origin}/product/${productCode}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}`;

  const screenCenterX = window.innerWidth / 2;
  const screenCenterY = window.innerHeight / 2;
  
  const startX = origin.overrideX !== null ? origin.overrideX - screenCenterX : (origin.x + origin.width / 2) - screenCenterX;
  const startY = (origin.y + origin.height / 2) - screenCenterY;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content-pro" 
        onClick={e => e.stopPropagation()}
        style={{ 
          '--start-left': `${startX}px`,
          '--start-top': `${startY}px`,
          '--anim-name': 'perspectiveRight'
        } as any}
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
        <button className="btn-metalized modal-btn-bottom">
          <span className="metal-icon">🛒</span> COMPRAR
        </button>
      </div>
    </div>
  );
};

const FrontStore = () => {
  const [config, setConfig] = useState<any>({});
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchErrors, setFetchErrors] = useState<string[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [originRect, setOriginRect] = useState<any>(null);

  useEffect(() => {
    loadStorefrontData().then(({ config: cfg, products: prods, fetchErrors: errs }) => {
      setConfig(cfg);
      setProducts(prods);
      setFetchErrors(errs);
      setLoading(false);

      const root = document.documentElement;
      if (cfg.primary_color) root.style.setProperty('--c-primary', cfg.primary_color);
      if (cfg.font_titles) {
        loadGoogleFont(cfg.font_titles);
        root.style.setProperty('--font-titles', `'${cfg.font_titles}', serif`);
      }
      if (cfg.font_subtitles) {
        loadGoogleFont(cfg.font_subtitles);
        root.style.setProperty('--font-subtitles', `'${cfg.font_subtitles}', sans-serif`);
      }
      if (cfg.font_body) {
        loadGoogleFont(cfg.font_body);
        root.style.setProperty('--font-main', `'${cfg.font_body}', sans-serif`);
      }
    });
  }, []);

  useEffect(() => {
    if (selectedProduct) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
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

      setOriginRect({ 
        x: rect.left, 
        y: rect.top, 
        width: rect.width, 
        height: rect.height,
        overrideX: overrideX
      });
      setSelectedProduct(product);
    }
  };

  const closeQuickview = () => {
    setSelectedProduct(null);
    setOriginRect(null);
  };

  if (loading) return <div className="loading-screen">Cargando Tecnocasa Boutique...</div>;

  const renderHeroTitle = () => {
    return (
      <>
        Para quien siempre ha <br />
        <span className="highlight">creído</span> en ti.
      </>
    );
  };

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
        <div
          role="alert"
          style={{
            background: '#3d1515',
            color: '#ffb4b4',
            padding: '12px 16px',
            fontSize: 13,
            lineHeight: 1.45,
            borderBottom: '1px solid #662020',
          }}
        >
          <strong style={{ color: '#fff' }}>No se pudo cargar la base de datos correctamente.</strong>
          <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
            {fetchErrors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
          <p style={{ margin: '8px 0 0', opacity: 0.9 }}>
            En Supabase: SQL Editor → pega y ejecuta el archivo <code style={{ color: '#8cffb4' }}>supabase_db_setup.sql</code> de este proyecto (tablas + permisos). Comprueba también API URL y anon key en{' '}
            <strong>Project Settings → API</strong>.
          </p>
        </div>
      )}
      {fetchErrors.length === 0 && products.length === 0 && !loading && (
        <div
          style={{
            background: '#1a2e1f',
            color: '#a8e6c1',
            padding: '12px 16px',
            fontSize: 13,
            borderBottom: '1px solid #2a4a32',
          }}
        >
          Conexión correcta, pero <strong>no hay productos activos</strong>. Entra a <Link to="/admin" style={{ color: '#00ff88' }}>/admin</Link> y crea productos, o revisa en Supabase que la tabla <code>products</code> tenga filas con <code>is_deleted = false</code>.
        </div>
      )}
      <div className="announcement-bar">
        <span>🚚 Envíos a todo el país  •  Productos oficiales Tecnocasa</span>
      </div>

      <header className="main-header dark-header">
        <div className="container header-container">
          <Link to="/" className="brand-logo">
            <Logo url={config.logo_url} />
          </Link>
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
            <div className="cart-pill">🛒 <span className="count">0</span></div>
            <Link to="/admin" className="admin-trigger">⚙️</Link>
          </div>
        </div>
      </header>

      <section className="hero-section" style={{ backgroundColor: config.hero_bg_color || '#fdf2f4' }}>
        <div className="container hero-layout">
          <div className="hero-text-content">
            <div className="hero-tag">💖 {config.hero_tag || '10 DE MAYO'}</div>
            <h1 className="hero-display-title">
              {renderHeroTitle()}
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

      <footer className="footer-dark">
        <div className="container">
          <p>© 2024 Tecnocasa Group. Productos oficiales.</p>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<FrontStore />} />
        <Route path="/admin" element={<AdminConfig />} />
      </Routes>
    </BrowserRouter>
  );
}
