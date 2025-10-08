// =================== CONFIG ===================
const API = 'https://script.google.com/macros/s/AKfycby1PE8A1GbuEkiSefoqRujAGhnNy-SjLqNDi5rA1bUxBhGuI4YDFWX7ABEe9BrMJFZd/exec';
const IMG_BASE = 'Imagenes/';
const KEY = 'carrito_de_la_huerta';
const fmt = n => Number(n).toFixed(2);

// Control de UX en carga
const MIN_SPINNER_MS = 700;     // spinner mínimo para evitar parpadeo
const FETCH_TIMEOUT_MS = 8000;  // timeout por intento GET
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
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

// =================== CARGA DE PRODUCTOS (API) ===================
async function loadProductos() {
  const start = performance.now();
  showLoader();

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
      const elapsed = performance.now() - start;
      const remaining = Math.max(0, MIN_SPINNER_MS - elapsed);
      await sleep(remaining);
      hideLoader();
      alert(`No se pudieron cargar los productos.\n${e2.message}`);
      productos = [];
      throw e2;
    }
  }

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

  const elapsed = performance.now() - start;
  const remaining = Math.max(0, MIN_SPINNER_MS - elapsed);
  await sleep(remaining);
  hideLoader();
}

// =================== RENDER CATÁLOGO (por categorías) ===================
function renderProductosIfNeeded() {
  const $main = document.getElementById('main-productos');
  if (!$main) return;

  [...$main.children].forEach(n => { if (n.id !== 'cargando') n.remove(); });

  const h2 = document.createElement('h2');
  h2.textContent = 'Productos';
  $main.appendChild(h2);

  if (!Array.isArray(productos) || productos.length === 0) {
    const emptyP = document.createElement('p');
    emptyP.style.cssText = 'padding:1rem;color:#666';
    emptyP.textContent = 'No hay productos disponibles en este momento.';
    $main.appendChild(emptyP);
    return;
  }

  const categorias = {};
  productos.forEach(p => {
    const cat = p.categoria || 'Sin Categoría';
    (categorias[cat] ||= []).push(p);
  });
  const keys = Object.keys(categorias).sort();

  keys.forEach(categoria => {
    const catHeader = document.createElement('h3');
    catHeader.textContent = categoria;
    catHeader.style.cssText = `
      margin-top: 30px; margin-bottom: 15px;
      color: var(--color-header); font-size: 24px; font-weight: 600;
      border-bottom: 3px solid var(--color-header); padding-bottom: 10px; padding-left: 5px;
    `;
    $main.appendChild(catHeader);

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
      const img = art.querySelector('img');
      img.addEventListener('error', onImgError);
      grid.appendChild(art);
    });
  });
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

    const originalText = btn.textContent;
    btn.textContent = '   ✓   ';
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

// =================== PÁGINA CARRITO (con LOADER) ===================
function initCarritoPage() {
  const $lista  = document.getElementById('carrito-lista');
  const $total  = document.getElementById('total');
  const $vaciar = document.getElementById('vaciar');
  const $continuar  = document.getElementById('continuar');

  if (!$lista || !$total) return;

  async function renderCarrito({ withSpinner = true } = {}) {
    const start = performance.now();
    if (withSpinner) showLoader();

    try {
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
            <button class="btn-remove" data-action="del" data-id="${p.id}">
              <img src="Imagenes/basura.png" alt="Quitar">
            </button>
          </div>
          <div class="subtotal">$ ${fmt(subtotal)}</div>
        `;
        $lista.appendChild(li);
      });

      $total.textContent = fmt(total);
    } finally {
      if (withSpinner) {
        const elapsed = performance.now() - start;
        const remaining = Math.max(0, MIN_SPINNER_MS - elapsed);
        await sleep(remaining);
        hideLoader();
      }
    }
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

    renderCarrito({ withSpinner: false }); // sin parpadeo
  });

  $vaciar?.addEventListener('click', async () => {
    if (confirm('¿Vaciar el carrito?')) {
      emptyCart();
      await renderCarrito({ withSpinner: true });
      alert('Carrito vacío');
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

  renderCarrito({ withSpinner: true });
}

// =================== DETALLE + POST PEDIDO ===================
// URL robusta para ir a index.html en la MISMA carpeta del archivo actual
function buildHomeUrl() {
  try {
    const u = new URL(window.location.href);
    const parts = u.pathname.split('/');
    parts.pop(); // quita el archivo actual
    const maybe = parts.join('/') + '/index.html';
    return `${u.origin}${maybe}`;
  } catch {
    return '/index.html'; // fallback
  }
}

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

  const nombre    = document.querySelector('input[name="name"]')?.value?.trim() || '';
  const telefono  = document.querySelector('input[name="telephone"]')?.value?.trim() || '';
  const ciudad    = document.querySelector('select[name="ciudad"]')?.value?.trim() || '';
  const direccion = document.querySelector('input[name="direccion"]')?.value?.trim() || '';
  const otros     = document.querySelector('input[name="otros"]')?.value?.trim() || '';

  const productosStr = items
    .map(it => `${it.nombre} (x${it.cantidad}) - ${fmt(it.precioUnit)} c/u`)
    .join('; ');

  return {
    timestamp: new Date().toISOString(),
    nombre,
    telefono,
    ciudad,
    direccion,
    otros_datos: otros,
    productos: productosStr,
    valor_total: Number(total.toFixed(2)),
    items
  };
}

// Envío NO bloqueante con límite de espera (race) y sin errores visibles
async function enviarPedidoNoBloqueante() {
  const payload = buildOrderPayload();
  const body = JSON.stringify(payload);

  const fetchPromise = (async () => {
    try {
      await fetch(API, {
        method: 'POST',
        body,
        cache: 'no-store',
        keepalive: true,  // sigue enviando aunque naveguemos
        // SIN Content-Type para evitar preflight; GAS usa JSON.parse(e.postData.contents)
      });
    } catch (err) {
      // Silenciamos; muchas veces igual llega al GAS
      console.warn('Aviso: respuesta no legible o CORS/redirect.', err);
    }
  })();

  // Damos una ventanita de 1200ms y seguimos (para no “quedarnos pegados”)
  const timeoutPromise = new Promise(r => setTimeout(r, 1200));
  await Promise.race([fetchPromise, timeoutPromise]);

  // Vaciar ya mismo (y por si acaso al cargar la home también quedará vacío)
  emptyCart();
}

function initDetalleCompraPage() {
  const $pagar = document.getElementById('pagar');
  if (!$pagar) return;

  // Evitar submit nativo del form
  if ($pagar.getAttribute('type') !== 'button') {
    $pagar.setAttribute('type', 'button');
  }

  const form = document.querySelector('form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      $pagar.click();
    });
  }

  $pagar.addEventListener('click', async (e) => {
    e.preventDefault();
    if ($pagar.dataset.loading === '1') return;

    if (form && !form.checkValidity()) {
      form.reportValidity();
      return;
    }

    $pagar.dataset.loading = '1';
    const original = $pagar.textContent;
    $pagar.disabled = true;
    $pagar.textContent = 'Enviando…';

    const homeUrl = buildHomeUrl();

    try {
      // Enviar “fire-and-forget” con ventanita corta y sin errores visibles
      await enviarPedidoNoBloqueante();
    } finally {
      // Restaurar UI por si el usuario cancela la navegación
      $pagar.disabled = false;
      $pagar.textContent = original || 'Pagar';
      delete $pagar.dataset.loading;

      // Redirigir SIEMPRE (pequeño delay para salir del event loop)
      setTimeout(() => { window.location.replace(homeUrl); }, 150);
    }
  });
}

// =================== BOOTSTRAP ===================
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadProductos();
    renderProductosIfNeeded();
    initProductosPage();
    initCarritoPage();
    initDetalleCompraPage();
  } catch (e) {
    hideLoader();
    console.error('Error crítico:', e);
  }
});
