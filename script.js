// =================== CONFIG ===================
const API = 'https://script.google.com/macros/s/AKfycby1PE8A1GbuEkiSefoqRujAGhnNy-SjLqNDi5rA1bUxBhGuI4YDFWX7ABEe9BrMJFZd/exec';
const IMG_BASE = 'Imagenes/';
const KEY = 'carrito_de_la_huerta';
const fmt = n => Number(n).toFixed(2);

// Control de UX en carga
const MIN_SPINNER_MS = 700;     // spinner mínimo para evitar parpadeo
const FETCH_TIMEOUT_MS = 8000;  // timeout por intento
const RETRY_DELAY_MS = 1200;    // backoff antes del reintento

// =================== ESTADO ===================
let productos = [];

// =================== LOADER ===================
function showLoader() {
  const img = document.getElementById('cargando');
  if (img) img.style.display = 'block';
}
function hideLoader() {
  const img = document.getElementById('cargando');
  if (img) img.style.display = 'none';
}

// =================== IMG HELPER ===================
function imgSrc(path) {
  if (!path) return 'Imagenes/placeholder.png';
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith('Imagenes/')) return path;
  return IMG_BASE + path;
}
function onImgError(ev) {
  ev.target.onerror = null;
  ev.target.src = 'Imagenes/placeholder.png';
}

// =================== CARRITO (localStorage) ===================
function getCart() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
  catch { return {}; }
}
function setCart(cart) { localStorage.setItem(KEY, JSON.stringify(cart)); }

function addToCart(id, cantidad = 1) {
  const cart = getCart();
  cart[id] = (cart[id] || 0) + cantidad;
  setCart(cart);
}
function removeOne(id) {
  const cart = getCart();
  if (!cart[id]) return;
  cart[id]--;
  if (cart[id] <= 0) delete cart[id];
  setCart(cart);
}
function removeAll(id) {
  const cart = getCart();
  delete cart[id];
  setCart(cart);
}
function emptyCart() { setCart({}); }

// =================== UTILES DE RED ===================
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchWithTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort('timeout'), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal });
    return res;
  } finally {
    clearTimeout(t);
  }
}

// =================== CARGA DE PRODUCTOS (API) ===================
async function loadProductos() {
  const start = performance.now();
  showLoader();

  // función que hace 1 intento de fetch+parse
  const tryOnce = async () => {
    const res = await fetchWithTimeout(API, { method: 'GET', cache: 'no-store' });
    if (!res.ok) {
      const body = await res.text().catch(() => '(sin cuerpo)');
      throw new Error(`[HTTP ${res.status}] No se pudo cargar productos.\n${body}`);
    }
    let json;
    try { json = await res.json(); }
    catch {
      const body = await res.text().catch(() => '(sin cuerpo)');
      throw new Error(`Respuesta no-JSON de la API.\nCuerpo:\n${body}`);
    }
    if (!Array.isArray(json?.data)) {
      console.warn('JSON recibido SIN data[]:', json);
      throw new Error('La API no contiene "data" como arreglo. Revisa doGet/hoja.');
    }
    return json.data;
  };

  // hasta 2 intentos con backoff
  let rows;
  try {
    rows = await tryOnce();
  } catch (e1) {
    console.warn('Primer intento falló, reintentando…', e1);
    await sleep(RETRY_DELAY_MS);
    try {
      rows = await tryOnce();
    } catch (e2) {
      console.error('Segundo intento falló:', e2);
      // espera mínima del spinner antes de alertar
      const elapsed = performance.now() - start;
      const remaining = Math.max(0, MIN_SPINNER_MS - elapsed);
      await sleep(remaining);
      hideLoader();
      // alerta única después de 2 fallos
      alert(`No se pudieron cargar los productos.\n${e2.message}`);
      productos = [];
      throw e2; // para que el bootstrap haga su catch también
    }
  }

  // Mapear columnas de tu hoja
  productos = rows.map((r, idx) => {
    const id = Number(r.IdProducto ?? r.id ?? (idx + 1));
    const nombre = String(r.Nombre ?? r.nombre ?? `Producto ${id}`);
    const descripcion = String(r['Descripción'] ?? r.Descripción ?? r.descripcion ?? '');
    const precio = Number(
      String(r.Precio ?? r.precio ?? 0)
        .replace(/[^\d.,-]/g, '')
        .replace(/\.(?=\d{3}\b)/g, '')
        .replace(',', '.')
    ) || 0;
    const imagen = String(r.Imagen ?? r.imagen ?? '').trim();
    const categoria = String(r.Categoria ?? r.categoria ?? '').trim();
    return { id, nombre, descripcion, precio, imagen, categoria };
  }).filter(p => p.nombre && Number.isFinite(p.precio));

  console.log('✅ Productos cargados:', productos.length);

  // asegurar spinner mínimo
  const elapsed = performance.now() - start;
  const remaining = Math.max(0, MIN_SPINNER_MS - elapsed);
  await sleep(remaining);
  hideLoader();
}

// =================== RENDER CATÁLOGO (por categorías) ===================
function renderProductosIfNeeded() {
  const $main = document.getElementById('main-productos');
  if (!$main) return;

  // limpia todo menos el loader
  [...$main.children].forEach(n => { if (n.id !== 'cargando') n.remove(); });

  // Título principal
  const h2 = document.createElement('h2');
  h2.textContent = 'Productos';
  $main.appendChild(h2);

  if (!Array.isArray(productos) || productos.length === 0) {
    const emptyP = document.createElement('p');
    emptyP.style.cssText = 'padding:1rem;color:#666';
    emptyP.textContent = 'No hay productos disponibles en este momento.';
    $main.appendChild(emptyP);
    console.warn('⚠️ Array de productos vacío');
    return;
  }

  // Agrupar por categoría
  const categorias = {};
  productos.forEach(p => {
    const cat = p.categoria || 'Sin Categoría';
    (categorias[cat] ||= []).push(p);
  });
  const keys = Object.keys(categorias).sort();
  console.log('📂 Categorías:', keys);

  // Render por categoría
  keys.forEach(categoria => {
    // cabecera visual de categoría
    const catHeader = document.createElement('h3');
    catHeader.textContent = categoria;
    catHeader.style.cssText = `
      margin-top: 30px; margin-bottom: 15px;
      color: var(--color-header); font-size: 24px; font-weight: 600;
      border-bottom: 3px solid var(--color-header); padding-bottom: 10px; padding-left: 5px;
    `;
    $main.appendChild(catHeader);

    // contenedor esperado por tu CSS: <section><div>...</div></section>
    const section = document.createElement('section');
    const grid = document.createElement('div');
    section.appendChild(grid);
    $main.appendChild(section);

    categorias[categoria].forEach(p => {
      const art = document.createElement('article');
      art.innerHTML = `
        <img src="${imgSrc(p.imagen)}" alt="${p.nombre}" id="mix">
        <div>
          <h3>${p.nombre}</h3>
          <p>${p.descripcion || 'Sin descripción'}</p>
          <div>
            <h4>$ ${fmt(p.precio)}</h4>
            <input class="qty" type="number" min="1" value="1" />
            <button class="btn-add" data-id="${p.id}">Agregar</button>
          </div>
        </div>
      `;
      // fallback de imagen si 404
      const img = art.querySelector('img');
      img.addEventListener('error', onImgError);

      grid.appendChild(art);
    });
  });

  console.log(`✅ ${productos.length} productos renderizados en ${keys.length} categorías`);
}

// =================== EVENTOS PÁGINA PRODUCTOS ===================
function initProductosPage() {
  const itemsContainer = document.querySelector('main');
  if (!itemsContainer) return;

  itemsContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-add');
    if (!btn) return;

    const id = Number(btn.dataset.id);
    const card = btn.closest('article');
    const qtyInput = card?.querySelector('.qty');

    let cantidad = 1;
    if (qtyInput) {
      cantidad = parseInt(qtyInput.value, 10);
      if (!Number.isFinite(cantidad) || cantidad < 1) cantidad = 1;
      qtyInput.value = '1';
    }

    addToCart(id, cantidad);
    console.log(`🛒 +${cantidad} x #${id}`);

    // feedback visual
    const originalText = btn.textContent;
    btn.textContent = '✓ Agregado';
    btn.style.backgroundColor = '#28a745';
    btn.style.color = '#fff';
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = originalText;
      btn.style.backgroundColor = '';
      btn.style.color = '';
      btn.disabled = false;
    }, 1200);
  });
}

// =================== PÁGINA CARRITO ===================
function initCarritoPage() {
  const $lista  = document.getElementById('carrito-lista');
  const $total  = document.getElementById('total');
  const $vaciar = document.getElementById('vaciar');
  const $continuar  = document.getElementById('continuar');

  if (!$lista || !$total) return;

  function renderCarrito() {
    const cart = getCart();
    $lista.innerHTML = '';
    let total = 0;

    const entries = Object.entries(cart);
    if (entries.length === 0) {
      $lista.innerHTML = `<li class="empty">Tu carrito está vacío.</li>`;
      $total.textContent = fmt(0);
      return;
    }

    entries.forEach(([idStr, cant]) => {
      const p = productos.find(pp => pp.id === Number(idStr));
      if (!p) return;
      const subtotal = p.precio * cant;
      total += subtotal;

      const li = document.createElement('li');
      li.className = 'carrito-item';
      li.innerHTML = `
        <div class="thumb">
          <img src="${imgSrc(p.imagen)}" alt="${p.nombre}" onerror="this.onerror=null;this.src='Imagenes/placeholder.png'">
        </div>
        <div class="info">
          <strong>${p.nombre.replace(/_/g,' ')}</strong>
          <small>$ ${fmt(p.precio)} c/u</small>
        </div>
        <div class="controls">
          <button class="btn-qty" data-action="menos" data-id="${p.id}">-</button>
          <span class="cant">${cant}</span>
          <button class="btn-qty" data-action="mas" data-id="${p.id}">+</button>
          <button class="btn-remove" data-action="del" data-id="${p.id}"><img src="Imagenes/basura.png" alt="Quitar"></button>
        </div>
        <div class="subtotal">$ ${fmt(subtotal)}</div>
      `;
      $lista.appendChild(li);
    });

    $total.textContent = fmt(total);
  }

  $lista.addEventListener('click', (e) => {
    const btnQty = e.target.closest('.btn-qty, .btn-remove');
    if (!btnQty) return;

    const action = btnQty.dataset.action;
    const id = Number(btnQty.dataset.id);
    if (!action || Number.isNaN(id)) return;

    if (action === 'mas')   addToCart(id, 1);
    if (action === 'menos') removeOne(id);
    if (action === 'del')   removeAll(id);

    renderCarrito();
  });

  $vaciar?.addEventListener('click', () => {
    if (confirm('¿Vaciar el carrito?')) {
      emptyCart();
      renderCarrito();
    }
  });

  $continuar?.addEventListener('click', () => {
    const cart = getCart();
    if (!Object.keys(cart).length) {
      alert("El carrito está vacío");
      return;
    }
    window.location.href = 'detalleCompra.html';
  });

  renderCarrito();
}

// =================== DETALLE + POST PEDIDO ===================
function buildOrderPayload() {
  const cart = getCart();
  const entries = Object.entries(cart);

  const items = entries.map(([idStr, cant]) => {
    const p = productos.find(pp => pp.id === Number(idStr));
    return {
      id: Number(idStr),
      nombre: p?.nombre ?? `id:${idStr}`,
      cantidad: Number(cant),
      precioUnit: p?.precio ?? 0,
      subtotal: (p ? p.precio * cant : 0)
    };
  });

  const total = items.reduce((acc, it) => acc + it.subtotal, 0);

  const nombre    = document.querySelector('input[name="nombre"]')?.value?.trim() || '';
  const telefono  = document.querySelector('input[name="telefono"]')?.value?.trim() || '';
  const ciudad    = document.querySelector('input[name="ciudad"]')?.value?.trim() || '';
  const direccion = document.querySelector('input[name="direccion"]')?.value?.trim() || '';
  const notas     = document.querySelector('textarea[name="notas"]')?.value?.trim() || '';

  // Cadena legible de productos (por si tu hoja la usa)
  const productosStr = items.map(it => `${it.nombre} (x${it.cantidad}) - ${fmt(it.precioUnit)} c/u`).join('; ');

  return {
    timestamp: new Date().toISOString(),
    nombre, telefono, ciudad, direccion,
    otros_datos: notas,
    productos: productosStr,
    valor_total: Number(total.toFixed(2)),
    items // también envío el arreglo crudo por si lo quieres guardar como JSON
  };
}

async function enviarPedido() {
  const payload = buildOrderPayload();

  // Opcional: timeout para evitar que la promesa quede colgada si la red falla
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort('timeout'), 15000);

  try {
    const res = await fetch(API, {
      method: 'POST',
      // 👇 SIN headers Content-Type → evita preflight OPTIONS
      // headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),   // tu GAS seguirá haciendo JSON.parse(e.postData.contents)
      cache: 'no-store',
      redirect: 'follow',
      signal: controller.signal,
    });

    const text = await res.text().catch(() => '');
    if (!res.ok) {
      throw new Error(`Error HTTP ${res.status}: ${text}`);
    }

    // Si el servidor devolviera JSON, lo intento parsear (no es obligatorio):
    try { return JSON.parse(text); } catch { return null; }
  } finally {
    clearTimeout(t);
  }
}


function initDetalleCompraPage() {
  const $pagar = document.getElementById('pagar');
  if (!$pagar) return;

  $pagar.addEventListener('click', async () => {
    const form = document.querySelector('form');
    if (form && !form.checkValidity()) {
      form.reportValidity();
      return;
    }

    try {
      await enviarPedido();
      alert("Pedido finalizado con éxito");
      emptyCart();
      window.location.href = 'index.html';
    } catch (err) {
      console.error(err);
      alert(err.message || 'Error enviando pedido');
    }
  });
}

// =================== BOOTSTRAP ===================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Inicializando…');
  try {
    await loadProductos();          // con espera mínima, retry y sin alertas falsas
    renderProductosIfNeeded();      // vista por categorías
    initProductosPage();
    initCarritoPage();
    initDetalleCompraPage();
    console.log('✅ Listo');
  } catch (e) {
    // loadProductos ya mostró alerta tras 2 fallos; aquí solo garantizamos ocultar loader
    hideLoader();
    console.error('❌ Error crítico:', e);
  }
});
