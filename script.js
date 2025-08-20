const productos = [
    {
        id: 1,
        nombre: 'lechuga',
        precio: 1,
        imagen: 'lechuga.jpg'
    },
    {
        id: 2,
        nombre: 'otra_lechuga',
        precio: 1.2,
        imagen: 'otra_lechuga.jpeg'
    },
    {
        id: 3,
        nombre: 'lechuga3',
        precio: 2.1,
        imagen: 'lechuga3.png'
    },
    {
        id: 4,
        nombre: 'ultima_lechuga',
        precio: 0.6,
        imagen: 'ultima_lechuga.jpeg'
    }

];

const carrito = {};
const IMG_BASE = 'productos/';

const fmt = n => Number(n).toFixed(2);

const KEY = 'carrito_de_la_huerta';
function getCart() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
  catch { return {}; }
}
function setCart(cart) { localStorage.setItem(KEY, JSON.stringify(cart)); }


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
  const $items = document.getElementById('items');
  if (!$items) return; 

  $items.innerHTML = '';
  productos.forEach(p => {
    const card = document.createElement('article');
    card.className = 'item-card';
    card.innerHTML = `
      <img src="${IMG_BASE}${p.imagen}" alt="${p.nombre}">
      <div class="item-body">
        <h3 class="item-title">${p.nombre.replaceAll('_',' ')}</h3>
        <p class="item-price">$ ${fmt(p.precio)}</p>

        <div class="add-row">
          <input type="number" class="qty" min="1" step="1" value="1"
                 aria-label="Cantidad para ${p.nombre}">
          <button class="btn btn-primary btn-add" data-id="${p.id}">
            AÑADIR AL CARRITO
          </button>
        </div>
      </div>
    `;
    $items.appendChild(card);
  });

  $items.addEventListener('click', (e) => {
    if (!e.target.classList.contains('btn-add')) return;
    const id = Number(e.target.dataset.id);
    const card = e.target.closest('.item-card');
    const qtyInput = card.querySelector('.qty');

    let cantidad = parseInt(qtyInput.value, 10);
    if (!Number.isFinite(cantidad) || cantidad < 1) cantidad = 1;

    addToCart(id, cantidad);
    qtyInput.value = '1';
  });
}

/* Carrito */
function initCarritoPage() {
  const $lista  = document.getElementById('carrito-lista');
  const $total  = document.getElementById('total');
  const $vaciar = document.getElementById('vaciar');
  const $pagar  = document.getElementById('pagar');
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
        <!-- FOTO ENCIMA -->
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
          <button class="btn-remove" data-action="del" data-id="${p.id}">x</button>
        </div>

        <div class="subtotal">$ ${fmt(subtotal)}</div>
      `;
      $lista.appendChild(li);
    });

    $total.textContent = fmt(total);
  }

  $lista.addEventListener('click', (e) => {
    const action = e.target.dataset.action;
    const id = Number(e.target.dataset.id);
    if (!action || Number.isNaN(id)) return;

    if (action === 'mas')   addToCart(id, 1);
    if (action === 'menos') removeOne(id);
    if (action === 'del')   removeAll(id);

    renderCarrito();
  });

  $vaciar?.addEventListener('click', () => {
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

    emptyCart();
    renderCarrito();
  });

  renderCarrito();
}

document.addEventListener('DOMContentLoaded', () => {
  initProductosPage();
  initCarritoPage();
});