/* lista de productos */

const productos = [
    // Mixes
    {
      id: 1,
      nombre: 'Mix (125 gr)',
      precio: 8500,
      imagen: 'mix.jpeg'
    },
    {
      id: 2,
      nombre: 'Mix de hojas verdes (125 gr)',
      precio: 8500,
      imagen: 'mixverde.png'
    },

    // Bolsas sencillas
    {
      id: 3,
      nombre: 'Bolsa de lechuga Romana (125 gr)',
      precio: 8500,
      imagen: 'romana.png'
    },
    {
      id: 4,
      nombre: 'Bolsa de Kale (100 gr)',
      precio: 8500,
      imagen: 'kale.png'
    },
    {
      id: 5,
      nombre: 'Bolsa de lechuga Salanova lisa verde',
      precio: 8500,
      imagen: 'bolsaSalanova.png'
    },

    // Lechugas enteras
    {
      id: 6,
      nombre: 'Lechuga Salanova lisa verde',
      precio: 6000,
      imagen: 'SalanovaCompleta.jpeg'
    },
    {
      id: 7,
      nombre: 'Lechuga Salanova lisa morada',
      precio: 6000,
      imagen: 'salanovaLisaMorada.png'
    },
    {
      id: 8,
      nombre: 'Lechuga Salanova crespa verde',
      precio: 6000,
      imagen: 'salanovaCrespaVerde.png'
    },
    {
      id: 9,
      nombre: 'Lechuga Salanova crespa morada',
      precio: 6000,
      imagen: 'salanovaCrespaMorada.png'
    },
    {
      id: 10,
      nombre: 'Lechuga Salanova roble verde',
      precio: 6000,
      imagen: 'salanovaRobleVerde.png'
    },
    {
      id: 11,
      nombre: 'Lechuga Salanova roble morada',
      precio: 6000,
      imagen: 'salanovaRobleMorada.png'
    },

    // Otros productos
    {
      id: 12,
      nombre: 'Chimichurri (180 gr)',
      precio: 18000,
      imagen: 'Chimi.jpeg'
    },
    {
      id: 13,
      nombre: 'Chocoteja',
      precio: 4000,
      imagen: 'chocoteja.png'
    },
    {
      id: 14,
      nombre: 'Mermelada (250 gr)',
      precio: 18000,
      imagen: 'mermelada.png'
    }
];

/* ------------------------------------------------------------------------------ */

const carrito = {};
const IMG_BASE = 'Imagenes/';

const fmt = n => Number(n).toFixed(2);

/* Persistencia del carrito */
const KEY = 'carrito_de_la_huerta';
function getCart() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
  catch { return {}; }
}
function setCart(cart) { localStorage.setItem(KEY, JSON.stringify(cart)); }

/* ------------------------------------------------------------------------------ */

/* Operaciones */
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


/* Productos */

function initProductosPage() {
  // Usa el contenedor donde están los <article> con los botones .btn-add
  const itemsContainer = document.querySelector('main');
  if (!itemsContainer) return; // ← Importante para que no rompa en carrito.html

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
    }

    addToCart(id, cantidad);
    if (qtyInput) qtyInput.value = '1';
  });
}

/* ===================== Página del Carrito ===================== */
function initCarritoPage() {
  const $lista  = document.getElementById('carrito-lista');
  const $total  = document.getElementById('total');
  const $vaciar = document.getElementById('vaciar');
  const $pagar  = document.getElementById('pagar');

  // Si no estamos en carrito.html, salimos sin romper nada
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
          <img src="${IMG_BASE}${p.imagen}" alt="${p.nombre}">
        </div>

        <div class="info">
          <strong>${p.nombre.replaceAll('_',' ')}</strong>
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

  $pagar?.addEventListener('click', () => {
    const cart = getCart();
    const entries = Object.entries(cart);
    if (entries.length === 0) return;

    const itemsStr = entries.map(([idStr, cant]) => {
      const p = productos.find(pp => pp.id === Number(idStr));
      return `${encodeURIComponent(p?.nombre ?? idStr)}:${cant}`;
    }).join('|');

    const totalNum = entries.reduce((acc, [idStr, cant]) => {
      const p = productos.find(pp => pp.id === Number(idStr));
      return acc + (p ? p.precio * cant : 0);
    }, 0);

    const params = new URLSearchParams();
    params.set('items', itemsStr);
    params.set('total', fmt(totalNum));

    const nuevaURL = `${location.origin}${location.pathname}?${params.toString()}`;
    history.replaceState(null, '', nuevaURL);

    alert("Productos comprados");
    emptyCart();
    renderCarrito();
  });

  renderCarrito();
}

/* ===================== Bootstrap ===================== */
document.addEventListener('DOMContentLoaded', () => {
  initProductosPage();
  initCarritoPage();
});