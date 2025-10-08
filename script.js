// =================== CONFIG ===================
const API = 'https://script.google.com/macros/s/AKfycby1PE8A1GbuEkiSefoqRujAGhnNy-SjLqNDi5rA1bUxBhGuI4YDFWX7ABEe9BrMJFZd/exec';
const IMG_BASE = 'Imagenes/';
const KEY = 'carrito_de_la_huerta';
const fmt = n => Number(n).toFixed(2);

// =================== ESTADO ===================
let productos = [];        // se carga asíncronamente desde la API

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
// Evita 'Imagenes/Imagenes/...', soporta URL absolutas y placeholder
function imgSrc(path) {
  if (!path) return 'Imagenes/placeholder.png';
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith('Imagenes/')) return path;
  return IMG_BASE + path;
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

// =================== CARGA DE PRODUCTOS (API) ===================
async function loadProductos() {
  showLoader();
  try {
    const res = await fetch(API, { method: 'GET', cache: 'no-store' });

    if (!res.ok) {
      const body = await res.text().catch(() => '(sin cuerpo)');
      throw new Error(`[HTTP ${res.status}] No se pudo cargar la lista de productos.\n${body}`);
    }

    let json;
    try {
      json = await res.json();
    } catch {
      const body = await res.text().catch(() => '(sin cuerpo)');
      throw new Error(`La API no devolvió JSON válido.\nRespuesta cruda:\n${body}`);
    }

    if (!Array.isArray(json?.data)) {
      console.warn('JSON recibido SIN data[]:', json);
      throw new Error('La API no contiene "data" como arreglo. Revisa doGet/hoja.');
    }

    const rows = json.data;
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

    console.log('Productos cargados desde API:', productos.length, productos.slice(0,3));
  } catch (err) {
    console.error('loadProductos() error:', err);
    alert(`No se pudieron cargar los productos:\n${err.message}`);

    // Fallback visual (para comprobar que el render funciona aunque la API falle)
    productos = [];
  } finally {
    hideLoader();
  }
}


// =================== RENDER CATÁLOGO (opcional si lo generas por JS) ===================
function renderProductosIfNeeded() {
  const $main = document.getElementById('main-productos');
  if (!$main) return;

  // Limpia todo menos el loader (por si todavía está visible)
  [...$main.children].forEach(n => {
    if (n.id !== 'cargando') n.remove();
  });

  // Título visible (ayuda a notar que sí se renderizó la sección)
  const h2 = document.createElement('h2');
  h2.textContent = 'Productos';
  $main.appendChild(h2);

  // Estructura esperada por tu CSS: <section><div>...</div></section>
  const section = document.createElement('section');
  const grid = document.createElement('div');
  section.appendChild(grid);
  $main.appendChild(section);

  if (!Array.isArray(productos)) {
    grid.innerHTML = `<p style="padding:1rem;color:#b00">Error: productos no es un arreglo.</p>`;
    console.error('renderProductosIfNeeded(): productos =', productos);
    return;
  }

  if (productos.length === 0) {
    grid.innerHTML = `<p style="padding:1rem">No hay productos disponibles.</p>`;
    console.warn('No hay productos para renderizar (length=0).');
    return;
  }

  productos.forEach(p => {
    const art = document.createElement('article');
    art.innerHTML = `
      <img src="${imgSrc(p.imagen)}" alt="${p.nombre}">
      <div>
        <h3>${p.nombre}</h3>
        <p>${p.descripcion || '&nbsp;'}</p>
        <div>
          <h4>$ ${fmt(p.precio)}</h4>
          <input class="qty" type="number" min="1" value="1" />
          <button class="btn-add" data-id="${p.id}">Agregar</button>
        </div>
      </div>
    `;
    grid.appendChild(art);
  });

  console.log(`Render OK: ${productos.length} productos`);
}


// =================== EVENTOS PÁGINA PRODUCTOS ===================
function initProductosPage() {
  const itemsContainer = document.querySelector('main');
  if (!itemsContainer) return; // no rompe en otras páginas

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
          <img src="${imgSrc(p.imagen)}" alt="${p.nombre}">
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
    alert("Carrito vacio");
    emptyCart();
    renderCarrito();
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
  const direccion = document.querySelector('input[name="direccion"]')?.value?.trim() || '';
  const notas     = document.querySelector('textarea[name="notas"]')?.value?.trim() || '';

  return {
    timestamp: new Date().toISOString(),
    nombre, telefono, direccion, notas,
    items,
    total: Number(total.toFixed(2))
  };
}

async function enviarPedido() {
  const payload = buildOrderPayload();
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`No se pudo enviar el pedido.\n${txt}`);
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
    } catch (err) {
      console.error(err);
      alert(err.message || 'Error enviando pedido');
    }
  });
}

// =================== BOOTSTRAP ===================
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadProductos();                 // muestra/oculta loader internamente
    renderProductosIfNeeded();             // si el HTML del catálogo es dinámico
    initProductosPage();
    initCarritoPage();
    initDetalleCompraPage();
    // testAPI(); // <- opcional para depurar (ver abajo)
  } catch (e) {
    hideLoader();
    console.error(e);
    alert('No se pudieron cargar los productos. Intenta más tarde.');
  }
});
