import React, { useState, useEffect, useRef } from 'react';
import { getProducts, updateProduct } from '../../lib/queries';
import { getImageUrl } from '../../lib/supabase';

type ScanMode = 'add' | 'remove';
type Step = 'scan' | 'quantity' | 'done';

interface LogEntry { product: any; qty: number; mode: ScanMode; }

const S = {
  overlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(12px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal: { background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: 24, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' as const, position: 'relative' as const },
  header: (color: string) => ({ background: color, padding: '20px 28px', borderRadius: '24px 24px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }),
  body: { padding: 28 },
  input: { width: '100%', padding: '14px 16px', background: '#111', border: '2px solid #333', color: 'white', borderRadius: 12, fontSize: 18, fontFamily: 'monospace', boxSizing: 'border-box' as const, outline: 'none' },
  inputFocus: { border: '2px solid #00A859' },
  btn: (color: string) => ({ background: color, border: 'none', color: 'white', padding: '14px 24px', borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: 'pointer', width: '100%' }),
  label: { fontSize: 11, color: '#666', fontWeight: 700, letterSpacing: 1, display: 'block' as const, marginBottom: 8 },
  productCard: { background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 16, padding: 20, display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20 },
};

export const InventoryScanner: React.FC<{ onUpdate?: () => void }> = ({ onUpdate }) => {
  const [showModal, setShowModal] = useState(false);
  const [scanMode, setScanMode] = useState<ScanMode>('add');
  const [step, setStep] = useState<Step>('scan');
  const [codeInput, setCodeInput] = useState('');
  const [foundProduct, setFoundProduct] = useState<any>(null);
  const [quantity, setQuantity] = useState('1');
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [saving, setSaving] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [hasBarcodeDetector, setHasBarcodeDetector] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);
  const detectorRef = useRef<any>(null);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    getProducts().then(setProducts);
    setHasBarcodeDetector('BarcodeDetector' in window);
  }, []);

  const openModal = (mode: ScanMode) => {
    setScanMode(mode);
    setShowModal(true);
    setStep('scan');
    setCodeInput('');
    setFoundProduct(null);
    setQuantity('1');
    setScanError('');
    setTimeout(() => inputRef.current?.focus(), 200);
  };

  const closeModal = () => {
    stopCamera();
    setShowModal(false);
    setLog([]);
  };

  const startCamera = async () => {
    setScanError('');
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } } });
    } catch (err) {
      try {
        // Fallback para PC de escritorio sin cámara "trasera"
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      } catch (fallbackErr) {
        setScanError('No se pudo acceder a la cámara. Revisa los permisos del navegador.');
        return;
      }
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      streamRef.current = stream;
      setIsScanning(true);
      if (hasBarcodeDetector) {
        detectorRef.current = new (window as any).BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13', 'ean_8', 'code_39', 'code_93'] });
        scanLoop();
      }
    }
  };

  const scanLoop = async () => {
    if (!videoRef.current || !detectorRef.current) return;
    try {
      const barcodes = await detectorRef.current.detect(videoRef.current);
      if (barcodes.length > 0) {
        stopCamera();
        const code = barcodes[0].rawValue;
        setCodeInput(code);
        findProduct(code);
        return;
      }
    } catch {}
    frameRef.current = requestAnimationFrame(scanLoop);
  };

  const stopCamera = () => {
    cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setIsScanning(false);
  };

  const findProduct = (code: string) => {
    let c = code.trim().toLowerCase();

    // Si la pistola lee la URL completa del QR (ej. http://localhost:5173/product/ID)
    // O si el teclado de Windows la escribe mal por el idioma (ej. HTTPñ--LOCALHOSTñ5173-PRODUCT-ID)
    if (c.includes('product')) {
      const parts = c.split(/product[-/'_]+|product\//);
      if (parts.length > 1) {
        c = parts[1];
      }
    }

    // Corregir comilla simple por guión medio (pasa cuando la pistola US escribe en Windows Español)
    c = c.replace(/'/g, '-');

    const found = products.find(p =>
      p.sku?.toLowerCase() === c ||
      p.id?.toLowerCase() === c ||
      p.name?.toLowerCase().includes(c)
    );
    if (found) {
      setFoundProduct(found);
      setScanError('');
      setStep('quantity');
      setTimeout(() => qtyRef.current?.focus(), 150);
    } else {
      setScanError(`❌ No se encontró ningún producto con el código "${c}". Debes registrarlo primero en la sección "🛒 PRODUCTOS".`);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Math.max(1, parseInt(quantity) || 1);
    if (!foundProduct) return;
    setSaving(true);
    const currentStock = foundProduct.stock || 0;
    const newStock = scanMode === 'add' ? currentStock + qty : Math.max(0, currentStock - qty);
    const updated = await updateProduct(foundProduct.id, { stock: newStock });
    if (updated) {
      setProducts(prev => prev.map(p => p.id === foundProduct.id ? { ...p, stock: newStock } : p));
      setLog(prev => [{ product: { ...foundProduct, stock: newStock }, qty, mode: scanMode }, ...prev]);
      setStep('done');
      if (onUpdate) onUpdate();
    }
    setSaving(false);
  };

  const continueScanning = () => {
    setStep('scan');
    setCodeInput('');
    setFoundProduct(null);
    setQuantity('1');
    setScanError('');
    setTimeout(() => {
      inputRef.current?.focus();
      startCamera();
    }, 100);
  };

  const modeColor = scanMode === 'add' ? '#00A859' : '#e53935';
  const modeLabel = scanMode === 'add' ? '➕ AÑADIR AL INVENTARIO' : '➖ QUITAR DEL INVENTARIO';

  return (
    <div>
      {/* BOTONES PRINCIPALES */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 30 }}>
        <button
          onClick={() => openModal('add')}
          style={{ flex: 1, background: 'linear-gradient(135deg, #00A859, #006d33)', border: 'none', color: 'white', padding: '22px 20px', borderRadius: 16, fontWeight: 900, fontSize: 16, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, boxShadow: '0 8px 30px rgba(0,168,89,0.3)' }}
        >
          <span style={{ fontSize: 36 }}>📥</span>
          AÑADIR AL INVENTARIO
          <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.8 }}>Escanea o ingresa código de producto</span>
        </button>
        <button
          onClick={() => openModal('remove')}
          style={{ flex: 1, background: 'linear-gradient(135deg, #c62828, #7f0000)', border: 'none', color: 'white', padding: '22px 20px', borderRadius: 16, fontWeight: 900, fontSize: 16, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, boxShadow: '0 8px 30px rgba(229,57,53,0.3)' }}
        >
          <span style={{ fontSize: 36 }}>📤</span>
          QUITAR DEL INVENTARIO
          <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.8 }}>Reduce stock por salida o merma</span>
        </button>
      </div>

      {/* LOG DE MOVIMIENTOS DE SESIÓN */}
      {log.length > 0 && (
        <div style={{ background: '#111', border: '1px solid #222', borderRadius: 16, padding: 20 }}>
          <h3 style={{ color: '#00A859', fontSize: 12, fontWeight: 900, margin: '0 0 15px', letterSpacing: 1 }}>📋 MOVIMIENTOS DE ESTA SESIÓN</h3>
          {log.map((entry, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #1a1a1a' }}>
              <div style={{ width: 36, height: 36, background: '#000', borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
                {entry.product.image_url ? <img src={getImageUrl(entry.product.image_url)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>📦</span>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: 'white', fontWeight: 700, fontSize: 13 }}>{entry.product.name}</div>
                <div style={{ color: '#555', fontSize: 10 }}>{entry.product.sku || entry.product.id?.slice(0,8)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: entry.mode === 'add' ? '#00A859' : '#e53935', fontWeight: 900, fontSize: 16 }}>
                  {entry.mode === 'add' ? '+' : '-'}{entry.qty}
                </div>
                <div style={{ color: '#555', fontSize: 10 }}>Stock: {entry.product.stock}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL */}
      {showModal && (
        <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div style={S.modal}>
            {/* HEADER */}
            <div style={S.header(modeColor)}>
              <div>
                <div style={{ color: 'white', fontWeight: 900, fontSize: 18 }}>{modeLabel}</div>
                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2 }}>
                  {step === 'scan' && 'Paso 1 de 2 — Identifica el producto'}
                  {step === 'quantity' && 'Paso 2 de 2 — Indica las piezas'}
                  {step === 'done' && '✅ Movimiento registrado'}
                </div>
              </div>
              <button onClick={closeModal} style={{ background: 'rgba(0,0,0,0.3)', border: 'none', color: 'white', width: 36, height: 36, borderRadius: 50, fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>

            <div style={S.body}>

              {/* ─── STEP 1: SCAN ─── */}
              {step === 'scan' && (
                <div>
                  <label style={S.label}>CÓDIGO DEL PRODUCTO</label>
                  <p style={{ fontSize: 12, color: '#666', marginBottom: 16 }}>
                    Usa la pistola USB (el cursor debe estar en el campo) o activa la cámara para escanear.
                  </p>
                  <div>
                    <input
                      ref={inputRef}
                      type="text"
                      value={codeInput}
                      onChange={e => setCodeInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const val = e.currentTarget.value;
                          if (val.trim()) findProduct(val);
                        }
                      }}
                      placeholder="Escanea o escribe SKU / código..."
                      style={{ ...S.input, marginBottom: 12 }}
                      autoFocus
                    />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <button type="button" onClick={() => codeInput.trim() && findProduct(codeInput)} style={{ ...S.btn(modeColor) }}>🔍 BUSCAR PRODUCTO</button>
                      <button
                        type="button"
                        onClick={() => isScanning ? stopCamera() : startCamera()}
                        style={{ ...S.btn(isScanning ? '#555' : '#1565c0') }}
                      >
                        {isScanning ? '⏹ DETENER CÁMARA' : '📷 ACTIVAR CÁMARA'}
                      </button>
                    </div>
                  </div>

                  {/* VIDEO */}
                  <div style={{ marginTop: 16, borderRadius: 12, overflow: 'hidden', background: '#000', display: isScanning ? 'block' : 'none' }}>
                    <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', maxHeight: 260, objectFit: 'cover', display: 'block' }} />
                    {isScanning && (
                      <div style={{ background: '#111', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 8, height: 8, background: '#00A859', borderRadius: '50%', animation: 'pulse 1s infinite' }} />
                        <span style={{ color: '#aaa', fontSize: 11 }}>
                          {hasBarcodeDetector ? 'Escáner activo — apunta al código QR o de barras' : 'Cámara activa — BarcodeDetector no disponible en este navegador'}
                        </span>
                      </div>
                    )}
                  </div>

                  {scanError && (
                    <div style={{ marginTop: 12, background: 'rgba(229,57,53,0.1)', border: '1px solid #c62828', borderRadius: 10, padding: '10px 14px', color: '#ef9a9a', fontSize: 12 }}>
                      ⚠️ {scanError}
                    </div>
                  )}
                </div>
              )}

              {/* ─── STEP 2: QUANTITY ─── */}
              {step === 'quantity' && foundProduct && (
                <div>
                  <div style={S.productCard}>
                    <div style={{ width: 70, height: 70, background: '#000', borderRadius: 12, overflow: 'hidden', flexShrink: 0 }}>
                      {foundProduct.image_url
                        ? <img src={getImageUrl(foundProduct.image_url)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ fontSize: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>📦</span>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: 'white', fontWeight: 800, fontSize: 16 }}>{foundProduct.name}</div>
                      {foundProduct.sku && <div style={{ color: '#00A859', fontSize: 11, marginTop: 2 }}>#{foundProduct.sku}</div>}
                      <div style={{ color: '#888', fontSize: 12, marginTop: 4 }}>{foundProduct.category || 'Sin categoría'}</div>
                      <div style={{ marginTop: 8, display: 'flex', gap: 12 }}>
                        <span style={{ color: '#aaa', fontSize: 12 }}>Stock actual: <strong style={{ color: 'white' }}>{foundProduct.stock || 0}</strong></span>
                        <span style={{ color: '#555', fontSize: 12 }}>Precio: ${foundProduct.price} MXN</span>
                      </div>
                    </div>
                  </div>

                  <label style={S.label}>¿CUÁNTAS PIEZAS?</label>
                  <p style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
                    {scanMode === 'add' ? 'Ingresa la cantidad a agregar al inventario.' : 'Ingresa la cantidad a retirar del inventario.'}
                  </p>
                  <form onSubmit={handleConfirm}>
                    <input
                      id="qty-input"
                      ref={qtyRef}
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={e => setQuantity(e.target.value)}
                      style={{ ...S.input, fontSize: 32, textAlign: 'center', marginBottom: 16 }}
                    />
                    <div style={{ background: '#1a1a1a', borderRadius: 10, padding: '10px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#888', fontSize: 12 }}>Nuevo stock resultante:</span>
                      <strong style={{ color: modeColor, fontSize: 20 }}>
                        {scanMode === 'add'
                          ? (foundProduct.stock || 0) + (parseInt(quantity) || 0)
                          : Math.max(0, (foundProduct.stock || 0) - (parseInt(quantity) || 0))}
                      </strong>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <button type="button" onClick={() => { setStep('scan'); setCodeInput(''); setScanError(''); }} style={{ ...S.btn('#333') }}>← Regresar</button>
                      <button type="submit" disabled={saving} style={{ ...S.btn(modeColor) }}>
                        {saving ? '⏳ Guardando...' : '✅ CONFIRMAR'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* ─── STEP 3: DONE ─── */}
              {step === 'done' && foundProduct && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 64, marginBottom: 12 }}>{scanMode === 'add' ? '✅' : '📤'}</div>
                  <h3 style={{ color: 'white', fontWeight: 900, fontSize: 20, margin: '0 0 8px' }}>Movimiento Registrado</h3>
                  <p style={{ color: '#888', fontSize: 14, margin: '0 0 24px' }}>{foundProduct.name}</p>
                  <div style={{ background: '#1a1a1a', borderRadius: 16, padding: 20, marginBottom: 24 }}>
                    <div style={{ color: modeColor, fontSize: 42, fontWeight: 900 }}>
                      {scanMode === 'add' ? '+' : '-'}{quantity}
                    </div>
                    <div style={{ color: '#666', fontSize: 12 }}>piezas</div>
                    <div style={{ marginTop: 10, color: '#aaa', fontSize: 14 }}>
                      Stock actual: <strong style={{ color: 'white', fontSize: 18 }}>{foundProduct.stock}</strong>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <button onClick={continueScanning} style={{ ...S.btn(modeColor) }}>
                      📷 CONTINUAR ESCANEANDO
                    </button>
                    <button onClick={closeModal} style={{ ...S.btn('#333') }}>
                      Cerrar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
