import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getStoreConfig, setStoreConfig, getProducts, addProduct, updateProduct, softDeleteProduct, getArchivedProducts } from '../../lib/queries';
import { uploadAsset, getImageUrl, isSupabaseConfigured } from '../../lib/supabase';
import { InventoryScanner } from './InventoryScanner';

const GOOGLE_FONTS = [
  // — Serif / Editorial —
  'Playfair Display', 'Merriweather', 'Lora', 'Cormorant Garamond', 'EB Garamond',
  // — Sans-Serif Modernas —
  'Inter', 'Roboto', 'Open Sans', 'Lato', 'Poppins', 'Nunito',
  'Montserrat', 'Outfit', 'Manrope', 'DM Sans', 'Plus Jakarta Sans', 'Figtree',
  // — Display / Impacto —
  'Oswald', 'Raleway', 'Bebas Neue', 'Syne', 'Josefin Sans', 'Righteous',
  // — Técnicas / Premium —
  'Space Grotesk', 'Space Mono', 'IBM Plex Sans', 'Rubik', 'Work Sans', 'Sora',
  // — Amigables / Redondas —
  'Quicksand', 'Nunito Sans', 'Ubuntu', 'Comfortaa',
];

/** Inyecta dinámicamente el link de Google Fonts en el <head> */
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

export const AdminConfig: React.FC = () => {
  const [configs, setConfigs] = useState<Record<string, string>>({});
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'content' | 'categories' | 'products' | 'inventory'>('general');
  const [showModal, setShowModal] = useState(false);
  const [showArchived] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [enlargedQr, setEnlargedQr] = useState<string | null>(null);
  const [savedProduct, setSavedProduct] = useState<any>(null);
  const [newProduct, setNewProduct] = useState({ 
    name: '', badge: '', description: '', purchase_price: '', price: '', stock: '0', category: '', image_url: '' 
  });
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [errorLog, setErrorLog] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [showArchived]);

  const loadData = async () => {
    setLoading(true);
    setErrorLog(null);
    try {
      if (!isSupabaseConfigured) {
        setErrorLog("La configuración de Supabase está incompleta o es inválida en el archivo .env");
        setLoading(false);
        return;
      }

      const [cfg, prods] = await Promise.all([
        getStoreConfig().catch(e => { setErrorLog("Config Table Error: " + e.message); return {}; }),
        (showArchived ? getArchivedProducts() : getProducts()).catch(e => { setErrorLog("Products Table Error: " + e.message); return []; })
      ]);

      setConfigs(cfg || {});
      setProducts(prods || []);
      applyFonts(cfg || {});
    } catch (err: any) {
      setErrorLog("Fallo de red o credenciales: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStockChange = async (id: string, currentStock: number, delta: number) => {
    const newStock = Math.max(0, currentStock + delta);
    const success = await updateProduct(id, { stock: newStock });
    if (success) {
      setProducts(prev => prev.map(p => p.id === id ? { ...p, stock: newStock } : p));
    }
  };

  const [newCategoryMode, setNewCategoryMode] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const handleSaveProduct = async () => {
    if (!newProduct.name.trim()) { alert('El nombre del artículo es obligatorio'); return; }
    if (!newProduct.price) { alert('El precio de venta es obligatorio'); return; }
    setSaving(true);

    const categoryToUse = newCategoryMode && newCategoryName.trim() ? newCategoryName.trim() : newProduct.category;
    const dataToSave = { 
      ...newProduct,
      category: categoryToUse,
      price: parseFloat(newProduct.price) || 0,
      purchase_price: parseFloat(newProduct.purchase_price || '0') || 0,
      stock: parseInt(newProduct.stock || '0') || 0
    };

    try {
      let result;
      if (editingProduct) {
        result = await updateProduct(editingProduct.id, dataToSave);
      } else {
        result = await addProduct(dataToSave);
      }
      if (result) {
        setSavedProduct(result);
        setShowModal(false);
        setEditingProduct(null);
        setNewCategoryMode(false);
        setNewCategoryName('');
        resetForm();
        loadData();
      } else {
        alert('No se pudo guardar. Verifica la conexión con Supabase.');
      }
    } catch (e: any) {
      alert('Error de conexión: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setNewProduct({ name: '', badge: '', description: '', purchase_price: '', price: '', stock: '0', category: '', image_url: '' });
  };

  const startEdit = (prod: any) => {
    setEditingProduct(prod);
    setNewProduct({ 
      name: prod.name, 
      badge: prod.badge || '', 
      description: prod.description || '', 
      purchase_price: prod.purchase_price?.toString() || '', 
      price: prod.price.toString(), 
      stock: prod.stock?.toString() || '0', 
      category: prod.category || '',
      image_url: prod.image_url 
    });
    setShowModal(true);
  };

  const handleSoftDelete = async (id: string) => {
    if (!confirm('¿Mover este artículo a la papelera?')) return;
    const success = await softDeleteProduct(id);
    if (success) loadData();
  };

  const applyFonts = (cfg: Record<string, string>) => {
    const root = document.documentElement;
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
    if (cfg.primary_color) root.style.setProperty('--c-primary', cfg.primary_color);
  };

  const updateField = async (key: string, value: string) => {
    setConfigs(prev => {
      const newCfg = { ...prev, [key]: value };
      applyFonts(newCfg);
      return newCfg;
    });
    await setStoreConfig(key, value);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, key: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        setConfigs(prev => ({ ...prev, [key]: ev.target!.result as string }));
      }
    };
    reader.readAsDataURL(file);

    setUploadingField(key);
    try {
      const path = await uploadAsset(file, key);
      if (path) await updateField(key, path);
    } catch (err: any) {
      alert(`Error al subir: ${err.message}`);
    } finally {
      setUploadingField(null);
    }
  };

  const handleProductImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        setNewProduct((prev) => ({ ...prev, image_url: ev.target!.result as string }));
      }
    };
    reader.readAsDataURL(file);

    setUploadingField('product_image');
    try {
      const path = await uploadAsset(file, 'product');
      if (path) setNewProduct((prev) => ({ ...prev, image_url: path }));
    } catch (err: any) {
      alert(`Error al subir imagen del producto: ${err.message}`);
    } finally {
      setUploadingField(null);
      e.target.value = '';
    }
  };

  if (loading) return <div style={{ background: '#050505', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00A859', fontWeight: 900, letterSpacing: 2 }}>TECNOCASA GROUP: CONECTANDO...</div>;

  const CATEGORIES_LIST = [
    { id: 'agendas', name: 'Agendas' },
    { id: 'bolsas', name: 'Bolsas' },
    { id: 'tazas', name: 'Tazas' },
    { id: 'termos', name: 'Termos y botellas' },
    { id: 'escritorio', name: 'Escritorio' },
    { id: 'tecnologia', name: 'Tecnología' },
    { id: 'textiles', name: 'Textiles' },
    { id: 'mas', name: 'Más categorías' }
  ];

  const allCategories = Array.from(new Set([
    ...CATEGORIES_LIST.map(c => c.name),
    ...products.map((p: any) => p.category).filter(Boolean)
  ])).sort();

  const groupedProducts = products.reduce((acc: any, prod: any) => {
    const rawCat = prod.category || 'Sin Categoría';
    const normalizedCat = rawCat.trim().toUpperCase();
    if (!acc[normalizedCat]) acc[normalizedCat] = { name: rawCat.trim(), items: [] };
    acc[normalizedCat].items.push(prod);
    return acc;
  }, {});

  return (
    <div style={{ background: '#050505', minHeight: '100vh', display: 'flex', color: 'white', fontFamily: 'var(--font-subtitles)' }}>
      
      {/* Sidebar */}
      <aside style={{ width: 240, background: '#111', borderRight: '1px solid #222', padding: '20px', display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ height: 30 }}>
            {configs.logo_url ? <img src={getImageUrl(configs.logo_url)} alt="Logo" style={{ height: '100%' }} /> : <div style={{ width: 30, height: 30, background: '#00A859', borderRadius: 4 }}></div>}
          </div>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: '#00A859', margin: 0, fontFamily: 'var(--font-titles)' }}>TECNOCASA</h2>
            <p style={{ fontSize: 9, color: '#666', letterSpacing: 1, margin: 0 }}>ADMIN DASHBOARD</p>
          </div>
        </div>
        <button onClick={() => setActiveTab('general')} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 6, border: 'none', background: activeTab === 'general' ? '#00A859' : 'transparent', color: activeTab === 'general' ? 'white' : '#888', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>⚙️ CONFIG GENERAL</button>
        <button onClick={() => setActiveTab('content')} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 6, border: 'none', background: activeTab === 'content' ? '#00A859' : 'transparent', color: activeTab === 'content' ? 'white' : '#888', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>🖼️ CONTENIDO HERO</button>
        <button onClick={() => setActiveTab('categories')} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 6, border: 'none', background: activeTab === 'categories' ? '#00A859' : 'transparent', color: activeTab === 'categories' ? 'white' : '#888', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>📁 CATEGORÍAS</button>
        <button onClick={() => setActiveTab('products')} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 6, border: 'none', background: activeTab === 'products' ? '#00A859' : 'transparent', color: activeTab === 'products' ? 'white' : '#888', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>🛒 PRODUCTOS</button>
        <button onClick={() => setActiveTab('inventory')} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 6, border: 'none', background: activeTab === 'inventory' ? '#00A859' : 'transparent', color: activeTab === 'inventory' ? 'white' : '#888', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>📦 INVENTARIO QR</button>
        <div style={{ marginTop: 'auto' }}>
          <Link to="/" style={{ color: '#444', textDecoration: 'none', fontSize: 11 }}>← Volver a la tienda</Link>
        </div>
      </aside>

      <main style={{ flex: 1, padding: '30px 40px', overflowY: 'auto' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-titles)' }}>
            {activeTab === 'general' ? 'Configuración Maestra' : activeTab === 'content' ? 'Hero & Slider' : activeTab === 'categories' ? 'Categorías Oficiales' : activeTab === 'inventory' ? 'Inventario QR' : 'Inventario de Productos'}
          </h1>
        </header>

        {errorLog && (
          <div style={{ background: 'rgba(255,0,0,0.1)', border: '1px solid #ff4444', color: '#ff4444', padding: 20, borderRadius: 15, marginBottom: 30, fontSize: 13 }}>
            <strong>🛑 ERROR DE SUPABASE:</strong> {errorLog}
            <p style={{ marginTop: 10, fontSize: 11, opacity: 0.8 }}>Por favor, verifica que las tablas <strong>'store_config'</strong> y <strong>'products'</strong> existan en tu base de datos y que las credenciales del .env sean las correctas.</p>
          </div>
        )}

        {activeTab === 'general' && (
          <div style={{ display: 'grid', gap: 20 }}>

            {/* ── LOGO ── */}
            <section style={{ background: '#111', padding: 25, borderRadius: 15, border: '1px solid #222' }}>
              <h3 style={{ fontSize: 14, marginBottom: 20, color: '#00A859', fontWeight: 900 }}>🏷️ Identidad de Marca</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 30, alignItems: 'center', marginBottom: 25 }}>
                <div style={{ width: 150, height: 150, background: '#000', borderRadius: 15, border: '1px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {configs.logo_url ? <img src={getImageUrl(configs.logo_url)} style={{ maxWidth: '85%', maxHeight: '85%' }} alt="Logo" /> : <span style={{ fontSize: 40 }}>🖼️</span>}
                </div>
                <div>
                  <label style={{ fontSize: 12, display: 'block', marginBottom: 6, color: '#888' }}>Logotipo Oficial (PNG / SVG recomendado)</label>
                  <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'logo_url')} style={{ fontSize: 12 }} />
                  {uploadingField === 'logo_url' && <p style={{ fontSize: 10, color: '#00A859', marginTop: 8 }}>⏳ Subiendo...</p>}
                  {configs.logo_url && <p style={{ fontSize: 10, color: '#555', marginTop: 6 }}>✅ Logo guardado en Supabase</p>}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, display: 'block', marginBottom: 8, color: '#888' }}>Color Primario de Marca</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
                  <input type="color" value={configs.primary_color || '#00A859'} onChange={(e) => updateField('primary_color', e.target.value)} style={{ width: 60, height: 40, border: 'none', borderRadius: 8, background: 'transparent', cursor: 'pointer' }} />
                  <span style={{ fontSize: 13, color: '#aaa', fontFamily: 'monospace' }}>{configs.primary_color || '#00A859'}</span>
                </div>
              </div>
            </section>

            {/* ── TIPOGRAFÍAS ── */}
            <section style={{ background: '#111', padding: 25, borderRadius: 15, border: '1px solid #222' }}>
              <h3 style={{ fontSize: 14, marginBottom: 6, color: '#00A859', fontWeight: 900 }}>🔤 Sistema Tipográfico</h3>
              <p style={{ fontSize: 11, color: '#555', marginBottom: 20 }}>Los cambios se aplican en tiempo real al sitio. 32 fuentes de Google Fonts disponibles.</p>

              <div style={{ display: 'grid', gap: 20 }}>

                {/* Títulos */}
                <div style={{ background: '#0a0a0a', borderRadius: 12, padding: 20, border: '1px solid #222' }}>
                  <label style={{ fontSize: 11, display: 'block', marginBottom: 4, color: '#888', fontWeight: 700, letterSpacing: 1 }}>TIPOGRAFÍA TÍTULOS</label>
                  <p style={{ fontSize: 10, color: '#555', marginBottom: 12 }}>Usada en: hero principal, títulos de sección, nombre del catálogo</p>
                  <select
                    value={configs.font_titles || 'Playfair Display'}
                    onChange={(e) => updateField('font_titles', e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', background: '#000', color: 'white', border: '1px solid #333', borderRadius: 8, marginBottom: 12, fontSize: 13 }}
                  >
                    {GOOGLE_FONTS.filter(f => !f.startsWith('—')).map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <div style={{ fontFamily: `'${configs.font_titles || 'Playfair Display'}', serif`, fontSize: 28, color: 'white', lineHeight: 1.2 }}>
                    Para quien siempre ha <span style={{ color: '#00A859' }}>creído</span> en ti.
                  </div>
                </div>

                {/* Subtítulos */}
                <div style={{ background: '#0a0a0a', borderRadius: 12, padding: 20, border: '1px solid #222' }}>
                  <label style={{ fontSize: 11, display: 'block', marginBottom: 4, color: '#888', fontWeight: 700, letterSpacing: 1 }}>TIPOGRAFÍA SUBTÍTULOS</label>
                  <p style={{ fontSize: 10, color: '#555', marginBottom: 12 }}>Usada en: menú de navegación, botones, etiquetas, categorías</p>
                  <select
                    value={configs.font_subtitles || 'Inter'}
                    onChange={(e) => updateField('font_subtitles', e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', background: '#000', color: 'white', border: '1px solid #333', borderRadius: 8, marginBottom: 12, fontSize: 13 }}
                  >
                    {GOOGLE_FONTS.filter(f => !f.startsWith('—')).map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <div style={{ fontFamily: `'${configs.font_subtitles || 'Inter'}', sans-serif`, fontSize: 14, color: '#aaa', lineHeight: 1.5 }}>
                    Tienda &nbsp;•&nbsp; Colecciones &nbsp;•&nbsp; Franquiciatarios &nbsp;•&nbsp; Contacto
                  </div>
                </div>

                {/* Cuerpo */}
                <div style={{ background: '#0a0a0a', borderRadius: 12, padding: 20, border: '1px solid #222' }}>
                  <label style={{ fontSize: 11, display: 'block', marginBottom: 4, color: '#888', fontWeight: 700, letterSpacing: 1 }}>TIPOGRAFÍA TEXTO GENERAL</label>
                  <p style={{ fontSize: 10, color: '#555', marginBottom: 12 }}>Usada en: descripciones de productos, párrafos, pie de página</p>
                  <select
                    value={configs.font_body || 'Inter'}
                    onChange={(e) => updateField('font_body', e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', background: '#000', color: 'white', border: '1px solid #333', borderRadius: 8, marginBottom: 12, fontSize: 13 }}
                  >
                    {GOOGLE_FONTS.filter(f => !f.startsWith('—')).map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <div style={{ fontFamily: `'${configs.font_body || 'Inter'}', sans-serif`, fontSize: 14, color: '#777', lineHeight: 1.6 }}>
                    Este producto oficial de Tecnocasa Group ha sido diseñado con los más altos estándares de calidad para acompañarte en cada momento.
                  </div>
                </div>

              </div>
            </section>

          </div>
        )}

        {activeTab === 'content' && (
          <div style={{ display: 'grid', gap: 20 }}>
            <section style={{ background: '#111', padding: 25, borderRadius: 15, border: '1px solid #222' }}>
              <h3 style={{ fontSize: 14, marginBottom: 20, color: '#00A859', fontWeight: 900 }}>Configuración del Hero</h3>
              <div style={{ display: 'grid', gap: 20 }}>
                <div>
                  <label style={{ fontSize: 12, display: 'block', marginBottom: 8, color: '#888' }}>Tag Destacado (Ej: 10 DE MAYO)</label>
                  <input type="text" value={configs.hero_tag || ''} onChange={(e) => updateField('hero_tag', e.target.value)} placeholder="10 DE MAYO" style={{ width: '100%', padding: 12, background: '#000', color: 'white', border: '1px solid #333', borderRadius: 8 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, display: 'block', marginBottom: 8, color: '#888' }}>Subtítulo Hero</label>
                  <textarea value={configs.hero_subtitle || ''} onChange={(e) => updateField('hero_subtitle', e.target.value)} placeholder="Celebra a mamá con detalles..." style={{ width: '100%', padding: 12, background: '#000', color: 'white', border: '1px solid #333', borderRadius: 8, minHeight: 80 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, display: 'block', marginBottom: 8, color: '#888' }}>Color de Fondo Hero</label>
                  <input type="color" value={configs.hero_bg_color || '#fdf2f4'} onChange={(e) => updateField('hero_bg_color', e.target.value)} style={{ width: '100%', height: 40, border: 'none', borderRadius: 8, background: 'transparent', cursor: 'pointer' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, display: 'block', marginBottom: 8, color: '#888' }}>Lista de Imágenes Slider (Separadas por coma)</label>
                  <input type="text" value={configs.hero_images_list || ''} onChange={(e) => updateField('hero_images_list', e.target.value)} placeholder="path1.png, path2.png" style={{ width: '100%', padding: 12, background: '#000', color: 'white', border: '1px solid #333', borderRadius: 8 }} />
                  <p style={{ fontSize: 10, color: '#555', marginTop: 5 }}>Sube imágenes en la sección de productos para obtener los paths.</p>
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'categories' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
            {CATEGORIES_LIST.map(cat => (
              <section key={cat.id} style={{ background: '#111', padding: 20, borderRadius: 15, border: '1px solid #222' }}>
                <h3 style={{ fontSize: 13, marginBottom: 15, color: '#00A859', fontWeight: 900 }}>{cat.name}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
                  <div style={{ width: 60, height: 60, background: '#000', borderRadius: 10, border: '1px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {configs[`cat_${cat.id}_img`] ? <img src={getImageUrl(configs[`cat_${cat.id}_img`])} style={{ maxWidth: '80%', maxHeight: '80%' }} /> : '📁'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <input type="file" onChange={(e) => handleFileUpload(e, `cat_${cat.id}_img`)} style={{ fontSize: 10, width: '100%' }} />
                  </div>
                </div>
              </section>
            ))}
          </div>
        )}

        {activeTab === 'products' && (
          <div style={{ display: 'grid', gap: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
              <button onClick={() => { resetForm(); setEditingProduct(null); setShowModal(true); }} style={{ background: '#00A859', color: 'white', border: 'none', padding: '10px 20px', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>+ NUEVO PRODUCTO</button>
            </div>
            
            {Object.keys(groupedProducts).length === 0 ? (
              <div style={{ padding: 60, textAlign: 'center', color: '#555', background: '#111', borderRadius: 20 }}>No se detectan productos en la base de datos.</div>
            ) : Object.keys(groupedProducts).map(catKey => (
              <div key={catKey} style={{ marginBottom: 30 }}>
                <h2 style={{ fontSize: 12, background: 'rgba(0,168,89,0.1)', color: '#00A859', padding: '10px 20px', borderRadius: '10px 10px 0 0', margin: 0, border: '1px solid #222', display: 'inline-block', fontWeight: 900 }}>📁 {groupedProducts[catKey].name}</h2>
                <div style={{ background: '#111', borderRadius: '0 15px 15px 15px', border: '1px solid #222', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, tableLayout: 'fixed' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #222', background: '#0a0a0a', textAlign: 'left' }}>
                        <th style={{ padding: '15px 20px', width: '80px' }}>FOTO</th>
                        <th style={{ padding: '15px', width: '140px' }}>QR & STOCK</th>
                        <th style={{ padding: '15px' }}>PRODUCTO</th>
                        <th style={{ padding: '15px', width: '100px', textAlign: 'center' }}>EXISTENCIA</th>
                        <th style={{ padding: '15px', width: '100px', textAlign: 'right' }}>ACCIONES</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedProducts[catKey].items.map((prod: any) => (
                        <tr key={prod.id} style={{ borderBottom: '1px solid #222' }}>
                          <td style={{ padding: '15px 20px' }}><div style={{ width: 45, height: 45, background: '#000', borderRadius: 10, border: '1px solid #333', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{prod.image_url ? <img src={getImageUrl(prod.image_url)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🖼️'}</div></td>
                          <td style={{ padding: '15px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(window.location.origin + '/product/' + (prod.sku || prod.id))}`} style={{ width: 35, height: 35, background: 'white', padding: 2, borderRadius: 5, cursor: 'pointer' }} onClick={() => setEnlargedQr(`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(window.location.origin + '/product/' + (prod.sku || prod.id))}`)} />
                                <span style={{ fontSize: 8, color: '#aaa', fontWeight: 600 }}>{prod.sku || prod.id.slice(0, 5)}</span>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                <button onClick={() => handleStockChange(prod.id, prod.stock, 1)} style={{ background: '#00A859', border: 'none', color: 'white', width: 20, height: 20, borderRadius: 5, cursor: 'pointer' }}>+</button>
                                <button onClick={() => handleStockChange(prod.id, prod.stock, -1)} style={{ background: '#ff4444', border: 'none', color: 'white', width: 20, height: 20, borderRadius: 5, cursor: 'pointer' }}>-</button>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '15px' }}><div style={{ fontWeight: 800, color: 'white' }}>{prod.name}</div><div style={{ fontSize: 10, color: '#666' }}>{prod.badge || 'Sin insignia'}</div>{prod.sku && <div style={{ fontSize: 9, color: '#00A859', marginTop: 3, letterSpacing: 1 }}>#{prod.sku}</div>}</td>
                          <td style={{ padding: '15px', textAlign: 'center' }}>
                            <span style={{ background: 'rgba(0,168,89,0.15)', color: '#00A859', border: '1px solid rgba(0,168,89,0.3)', padding: '8px 20px', borderRadius: 12, fontWeight: 900, fontSize: 24, display: 'inline-block', minWidth: '40px' }}>
                              {prod.stock}
                            </span>
                          </td>
                          <td style={{ padding: '15px 20px', textAlign: 'right', display: 'flex', gap: 10, justifyContent: 'flex-end' }}><button onClick={() => startEdit(prod)} style={{ background: 'transparent', border: 'none', color: '#00A859', cursor: 'pointer', fontSize: 16 }}>✏️</button><button onClick={() => handleSoftDelete(prod.id)} style={{ background: 'transparent', border: 'none', color: '#ff4444', cursor: 'pointer', fontSize: 16 }}>🗑️</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal para Editar/Crear Producto */}
        {showModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(12px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: 24, width: '100%', maxWidth: 680, maxHeight: '92vh', overflowY: 'auto' }}>
              {/* Header */}
              <div style={{ background: editingProduct ? '#1565c0' : '#00A859', padding: '20px 28px', borderRadius: '24px 24px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ color: 'white', fontWeight: 900, fontSize: 18 }}>{editingProduct ? '✏️ Editar Producto' : '➕ Nuevo Producto'}</div>
                  <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2 }}>Todos los campos con * son obligatorios</div>
                </div>
                <button onClick={() => setShowModal(false)} style={{ background: 'rgba(0,0,0,0.3)', border: 'none', color: 'white', width: 36, height: 36, borderRadius: '50%', fontSize: 20, cursor: 'pointer' }}>×</button>
              </div>

              <div style={{ padding: 28, display: 'grid', gap: 18 }}>

                {/* Imagen */}
                <div style={{ display: 'flex', gap: 20, alignItems: 'center', background: '#111', borderRadius: 14, padding: 16, border: '1px solid #222' }}>
                  <div style={{ width: 90, height: 90, background: '#000', borderRadius: 12, border: '1px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                    {newProduct.image_url ? <img src={getImageUrl(newProduct.image_url)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="preview" /> : <span style={{ fontSize: 32 }}>🖼️</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 11, color: '#888', fontWeight: 700, letterSpacing: 1, display: 'block', marginBottom: 8 }}>FOTO DEL ARTÍCULO</label>
                    <input type="file" accept="image/*" onChange={handleProductImageUpload} style={{ fontSize: 12, color: '#aaa' }} />
                    {uploadingField === 'product_image' && <p style={{ fontSize: 11, color: '#00A859', marginTop: 6 }}>⏳ Subiendo imagen...</p>}
                  </div>
                </div>

                {/* Nombre */}
                <div>
                  <label style={{ fontSize: 11, color: '#888', fontWeight: 700, letterSpacing: 1, display: 'block', marginBottom: 6 }}>NOMBRE DEL ARTÍCULO *</label>
                  <input type="text" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} placeholder="Ej: Bolsa para vino, Agenda ejecutiva..." style={{ width: '100%', padding: '12px 14px', background: '#111', border: '1px solid #333', color: 'white', borderRadius: 10, fontSize: 15, boxSizing: 'border-box' }} />
                </div>

                {/* Precios */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 11, color: '#888', fontWeight: 700, letterSpacing: 1, display: 'block', marginBottom: 6 }}>PRECIO DE VENTA (MXN) *</label>
                    <input type="number" min="0" step="0.01" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} placeholder="0.00" style={{ width: '100%', padding: '12px 14px', background: '#111', border: '1px solid #333', color: '#00A859', borderRadius: 10, fontSize: 18, fontWeight: 900, boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: '#888', fontWeight: 700, letterSpacing: 1, display: 'block', marginBottom: 6 }}>PRECIO DE COSTO (MXN)</label>
                    <input type="number" min="0" step="0.01" value={newProduct.purchase_price} onChange={e => setNewProduct({...newProduct, purchase_price: e.target.value})} placeholder="0.00" style={{ width: '100%', padding: '12px 14px', background: '#111', border: '1px solid #333', color: '#aaa', borderRadius: 10, fontSize: 18, boxSizing: 'border-box' }} />
                  </div>
                </div>

                {/* Categoría */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label style={{ fontSize: 11, color: '#888', fontWeight: 700, letterSpacing: 1 }}>CATEGORÍA</label>
                    <button type="button" onClick={() => setNewCategoryMode(!newCategoryMode)} style={{ background: 'transparent', border: 'none', color: newCategoryMode ? '#e53935' : '#00A859', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>
                      {newCategoryMode ? '× Cancelar nueva' : '+ Crear nueva categoría'}
                    </button>
                  </div>
                  {newCategoryMode ? (
                    <input type="text" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="Nombre de la nueva categoría..." style={{ width: '100%', padding: '12px 14px', background: '#111', border: '2px solid #00A859', color: 'white', borderRadius: 10, fontSize: 14, boxSizing: 'border-box' }} autoFocus />
                  ) : (
                    <select value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})} style={{ width: '100%', padding: '12px 14px', background: '#111', border: '1px solid #333', color: 'white', borderRadius: 10, fontSize: 14, boxSizing: 'border-box' }}>
                      <option value="">— Seleccionar categoría —</option>
                      {allCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  )}
                </div>

                {/* Número de piezas */}
                <div>
                  <label style={{ fontSize: 11, color: '#888', fontWeight: 700, letterSpacing: 1, display: 'block', marginBottom: 6 }}>NÚMERO DE PIEZAS EN EXISTENCIA</label>
                  <input type="number" min="0" value={newProduct.stock} onChange={e => setNewProduct({...newProduct, stock: e.target.value})} placeholder="0" style={{ width: '100%', padding: '12px 14px', background: '#111', border: '1px solid #333', color: 'white', borderRadius: 10, fontSize: 15, boxSizing: 'border-box' }} />
                </div>

                {/* Descripción */}
                <div>
                  <label style={{ fontSize: 11, color: '#888', fontWeight: 700, letterSpacing: 1, display: 'block', marginBottom: 6 }}>DESCRIPCIÓN DEL ARTÍCULO</label>
                  <textarea value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})} placeholder="Describe el artículo: material, medidas, uso, etc." style={{ width: '100%', padding: '12px 14px', background: '#111', border: '1px solid #333', color: 'white', borderRadius: 10, fontSize: 14, minHeight: 90, resize: 'vertical', boxSizing: 'border-box' }} />
                </div>

                {/* Botones */}
                <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                  <button onClick={handleSaveProduct} disabled={saving} style={{ flex: 1, background: editingProduct ? '#1565c0' : '#00A859', color: 'white', border: 'none', padding: '16px 0', borderRadius: 12, fontWeight: 900, fontSize: 15, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                    {saving ? '⏳ Guardando...' : editingProduct ? '✅ ACTUALIZAR PRODUCTO' : '✅ GUARDAR PRODUCTO'}
                  </button>
                  <button onClick={() => { setShowModal(false); setNewCategoryMode(false); setNewCategoryName(''); }} style={{ background: '#222', color: '#aaa', border: '1px solid #333', padding: '16px 20px', borderRadius: 12, cursor: 'pointer', fontWeight: 700 }}>Cancelar</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Confirmación post-guardado con QR */}
        {savedProduct && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(12px)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ background: '#0f0f0f', border: '1px solid #00A859', borderRadius: 24, width: '100%', maxWidth: 560, overflow: 'hidden' }}>
              <div style={{ background: '#00A859', padding: '18px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ color: 'white', fontWeight: 900, fontSize: 16 }}>✅ Producto Agregado con Éxito</div>
                <button onClick={() => setSavedProduct(null)} style={{ background: 'rgba(0,0,0,0.3)', border: 'none', color: 'white', width: 32, height: 32, borderRadius: '50%', fontSize: 18, cursor: 'pointer' }}>×</button>
              </div>
              <div style={{ padding: 28, display: 'grid', gridTemplateColumns: '1fr auto', gap: 24, alignItems: 'center' }}>
                <div>
                  <div style={{ color: 'white', fontWeight: 900, fontSize: 20, marginBottom: 8 }}>{savedProduct.name}</div>
                  {savedProduct.sku && <div style={{ color: '#00A859', fontWeight: 800, fontSize: 14, marginBottom: 4 }}>Código: #{savedProduct.sku}</div>}
                  <div style={{ color: '#aaa', fontSize: 13, marginBottom: 4 }}>Categoría: {savedProduct.category || 'Sin categoría'}</div>
                  <div style={{ color: '#aaa', fontSize: 13, marginBottom: 4 }}>Precio venta: <strong style={{ color: 'white' }}>${savedProduct.price} MXN</strong></div>
                  {savedProduct.purchase_price > 0 && <div style={{ color: '#aaa', fontSize: 13, marginBottom: 4 }}>Precio costo: ${savedProduct.purchase_price} MXN</div>}
                  <div style={{ color: '#aaa', fontSize: 13 }}>Piezas: <strong style={{ color: 'white' }}>{savedProduct.stock}</strong></div>
                  <button onClick={() => setSavedProduct(null)} style={{ marginTop: 20, background: '#00A859', border: 'none', color: 'white', padding: '12px 24px', borderRadius: 10, fontWeight: 800, cursor: 'pointer', width: '100%' }}>Aceptar</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <div style={{ background: 'white', padding: 10, borderRadius: 12 }}>
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(window.location.origin + '/product/' + (savedProduct.sku || savedProduct.id))}`} style={{ width: 140, height: 140, display: 'block' }} alt="QR" />
                  </div>
                  <div style={{ color: '#00A859', fontSize: 11, fontWeight: 800, letterSpacing: 1 }}>#{savedProduct.sku || savedProduct.id?.slice(0,8)}</div>
                  <div style={{ color: '#555', fontSize: 10, textAlign: 'center' }}>Código QR del producto</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal QR Ampliado */}
        {enlargedQr && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setEnlargedQr(null)}>
            <div style={{ background: 'white', padding: 20, borderRadius: 20 }}>
              <img src={enlargedQr} style={{ width: 400, height: 400 }} />
              <p style={{ textAlign: 'center', color: '#000', fontWeight: 900, marginTop: 10 }}>Toca para cerrar</p>
            </div>
          </div>
        )}
        {activeTab === 'inventory' && <InventoryScanner onUpdate={loadData} />}

      </main>
    </div>
  );
};
