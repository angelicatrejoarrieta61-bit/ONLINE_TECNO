# 📘 TECNOCASA GROUP — Documentación Técnica Global

> Para desarrolladores que ingresen al proyecto. Cubre arquitectura, sistema QR, inventario, admin y storefront.

---

## 🏗️ Arquitectura General

```
ONLINE_TECNO/
├── src/
│   ├── App.tsx                  # Storefront principal (tienda pública)
│   ├── index.css                # Variables CSS globales (fuentes, colores)
│   ├── lib/
│   │   ├── supabase.ts          # Cliente Supabase + helper getImageUrl()
│   │   └── queries.ts           # Todas las funciones de BD (CRUD)
│   └── pages/
│       └── admin/
│           ├── AdminConfig.tsx  # Panel administrativo completo
│           └── InventoryScanner.tsx  # Escáner de inventario USB/Cámara
├── .env                         # Credenciales Supabase (NO subir a git)
├── supabase_db_setup.sql        # Script para crear tablas en Supabase
└── supabase_storage_setup.sql   # Script para crear bucket de imágenes
```

### Stack tecnológico
| Capa | Tecnología |
|------|-----------|
| Frontend | React + TypeScript + Vite |
| Backend / BD | Supabase (PostgreSQL) |
| Storage | Supabase Storage (bucket: `tecnocasa-assets`) |
| QR Generation | `api.qrserver.com` (API pública) |
| Fuentes | Google Fonts (carga dinámica) |
| Rutas | React Router v6 |

---

## 🗄️ Base de Datos (Supabase)

### Tabla: `products`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID (PK) | Generado automáticamente por Supabase |
| `sku` | TEXT | Código corto único, ej: `TC-A7X2` |
| `name` | TEXT | Nombre del artículo |
| `price` | NUMERIC | Precio de venta al público |
| `purchase_price` | NUMERIC | Precio de costo (interno) |
| `stock` | INTEGER | Existencias actuales |
| `category` | TEXT | Categoría del producto |
| `description` | TEXT | Descripción del artículo |
| `badge` | TEXT | Etiqueta especial (ej: "NUEVO", "OFERTA") |
| `image_url` | TEXT | Path en Supabase Storage |
| `is_deleted` | BOOLEAN | Soft delete (no borra, oculta) |
| `created_at` | TIMESTAMPTZ | Fecha de alta |

### Tabla: `store_config`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `key` | TEXT (PK) | Nombre de la configuración |
| `value` | TEXT | Valor de la configuración |

Configuraciones guardadas: `logo_url`, `primary_color`, `font_titles`, `font_subtitles`, `font_body`, `hero_tag`, `hero_subtitle`, `hero_bg_color`, `hero_images_list`.

---

## 🔲 Sistema de Códigos QR

### ¿Cómo se genera?
Cuando se crea un producto nuevo, la función `generateSKU()` en `queries.ts` genera un código corto único:

```typescript
const generateSKU = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'TC-';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code; // Ejemplo: TC-A7X2
};
```

El SKU se guarda en la base de datos junto al producto.

### ¿Qué contiene el QR?
El código QR **NO es solo el SKU**. Contiene la **URL completa** al producto:

```
https://tudominio.com/product/TC-A7X2
```

o en desarrollo local:

```
http://localhost:5173/product/TC-A7X2
```

Esto permite dos usos:
1. **Clientes finales** escanean con su celular → los lleva directamente a la página del producto.
2. **Pistola USB de inventario** escanea y envía esa URL como texto al sistema → el admin extrae el SKU/ID de la URL.

### ¿Dónde aparece el QR?
| Lugar | Tamaño | Uso |
|-------|--------|-----|
| Tarjeta de producto (tienda) | Mini (35×35px) | Visual decorativo |
| Modal de producto (tienda) | Grande (150×150px) | El cliente lo escanea |
| Tabla de admin → Productos | Pequeño (35×35px) + clic para ampliar | Referencia interna |
| Inventario QR → Confirmación | Grande | Verificación post-escaneo |

---

## 🔫 Escáner de Inventario USB

### ¿Cómo funciona la pistola USB?
Las pistolas escáner USB funcionan como **teclados HID** (Human Interface Device). Al escanear un código, la pistola:
1. "Escribe" los caracteres del código en el campo de texto activo
2. Al final, envía automáticamente la tecla `ENTER`

**Problema conocido:** En Windows con teclado configurado en Español, la pistola (configurada como US) produce caracteres incorrectos:
- `:` → `ñ`
- `-` → `'` (comilla simple)

### Solución implementada
El componente `InventoryScanner.tsx` tiene una función de limpieza en `findProduct()`:

```typescript
// Si contiene "product" es una URL completa del QR
if (c.includes('product')) {
  const parts = c.split(/product[-/'_]+|product\//);
  if (parts.length > 1) c = parts[1];
}
// Corrige comillas simples por guiones (error de teclado US en Windows ES)
c = c.replace(/'/g, '-');
```

**Ejemplo de lectura real de la pistola:**
```
Input:  "HTTPñ--LOCALHOSTñ5173-PRODUCT-179867CA'0ABB'4047'95F9'254D09882775"
Output: "179867ca-0abb-4047-95f9-254d09882775"  ← UUID limpio ✅
```

### Flujo completo del escáner de inventario
```
1. Admin clic en "📥 AÑADIR" o "📤 QUITAR"
2. Modal se abre → campo de texto auto-enfocado
3. Admin apunta pistola al QR del producto
4. Pistola escribe la URL → sistema limpia y extrae ID/SKU
5. Sistema busca el producto por SKU o UUID en la BD
6. Si EXISTE → avanza al Paso 2 (piezas)
7. Si NO EXISTE → muestra error: "Regístralo primero en PRODUCTOS"
8. Admin ingresa cantidad → Confirmar
9. Stock se actualiza en Supabase (suma o resta)
10. Se notifica a la tabla de Productos para refrescarse (onUpdate callback)
```

### Búsqueda de producto por código
```typescript
const found = products.find(p =>
  p.sku?.toLowerCase() === c ||   // Busca por SKU corto (TC-A7X2)
  p.id?.toLowerCase() === c ||    // Busca por UUID completo
  p.name?.toLowerCase().includes(c) // Busca por nombre (fallback)
);
```

---

## 🛒 Panel de Administración

### Acceso
Ruta: `/admin`

### Secciones
| Pestaña | Funcionalidad |
|---------|---------------|
| ⚙️ Config General | Logo, color primario, 3 niveles de tipografía (32 Google Fonts) |
| 🖼️ Contenido Hero | Tag, subtítulo, color de fondo, lista de imágenes del slider |
| 📁 Categorías | Imagen de portada por categoría |
| 🛒 Productos | Alta, edición, baja lógica, QR, stock, precio de costo |
| 📦 Inventario QR | Entrada/salida de stock con pistola USB o cámara |

### Crear un producto nuevo
1. Ir a "🛒 PRODUCTOS"
2. Clic en "+ NUEVO PRODUCTO"
3. Llenar todos los campos con labels visibles
4. Al guardar → aparece modal de confirmación con el QR generado a la derecha
5. El SKU se genera automáticamente (`TC-XXXX`)

---

## 🎨 Sistema de Tipografías

Las fuentes se guardan en `store_config` y se aplican como variables CSS:

| Config Key | Variable CSS | Se usa en |
|-----------|--------------|-----------|
| `font_titles` | `--font-titles` | Hero, títulos de sección |
| `font_subtitles` | `--font-subtitles` | Menú, botones, precios |
| `font_body` | `--font-main` | Descripciones, párrafos, footer |

La función `loadGoogleFont(name)` inyecta dinámicamente el `<link>` de Google Fonts sin recargar la página.

---

## 🖼️ Sistema de Imágenes (Storage)

### Bucket: `tecnocasa-assets`
- Todas las imágenes se suben a Supabase Storage
- La función `uploadAsset(file, type)` sube y devuelve el path relativo
- La función `getImageUrl(path)` devuelve la URL pública completa

```typescript
// Si el path ya es una URL completa, la devuelve tal cual
// Si es un path relativo, construye: SUPABASE_URL/storage/v1/object/public/tecnocasa-assets/PATH
```

---

## ⚠️ Consideraciones Importantes

> [!WARNING]
> **Supabase se pausa automáticamente** después de 7 días de inactividad en el plan gratuito.
> Si el sitio muestra "Failed to fetch", ve al dashboard de Supabase y reactiva el proyecto.

> [!IMPORTANT]
> **El archivo `.env` NUNCA debe subirse a GitHub.** Contiene las claves secretas de Supabase.
> Verificar que `.gitignore` lo incluya.

> [!IMPORTANT]
> **Columna `sku` en la tabla `products`:**
> Si la base de datos es antigua y no tiene la columna `sku`, al agregar productos podría haber problemas. Para solucionarlo permanentemente, ejecuta este comando en el editor SQL de Supabase:
> ```sql
> ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sku text;
> ```
> *Nota: El sistema cuenta con resiliencia automática: si la columna no existe aún, guardará el producto omitiendo el SKU y usará el UUID para el código QR.*

> [!NOTE]
> Los productos creados **antes** de implementar el sistema de SKU no tienen código corto.
> Usarán el UUID completo como fallback en el QR. Para actualizarlos, edita y guarda cada uno desde el panel admin.

---

## 🚀 Arranque en desarrollo

```bash
cd C:\Users\user\Desktop\ONLINE_TECNO
npm run dev
# Storefront: http://localhost:5173/
# Admin:      http://localhost:5173/admin
```
