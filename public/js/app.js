// ===== State =====
let products = [];
let cart = JSON.parse(localStorage.getItem('bb_cart') || '[]');
let currentUser = JSON.parse(localStorage.getItem('bb_user') || 'null');

// ===== DOM Elements =====
const productsGrid = document.getElementById('productsGrid');
const cartBtn = document.getElementById('cartBtn');
const cartCount = document.getElementById('cartCount');
const cartSidebar = document.getElementById('cartSidebar');
const cartOverlay = document.getElementById('cartOverlay');
const closeCart = document.getElementById('closeCart');
const cartItems = document.getElementById('cartItems');
const cartTotal = document.getElementById('cartTotal');
const checkoutBtn = document.getElementById('checkoutBtn');
const checkoutModal = document.getElementById('checkoutModal');
const closeModal = document.getElementById('closeModal');
const checkoutForm = document.getElementById('checkoutForm');
const orderSummary = document.getElementById('orderSummary');
const successModal = document.getElementById('successModal');
const closeSuccess = document.getElementById('closeSuccess');
const orderIdDisplay = document.getElementById('orderIdDisplay');
const filterBtns = document.querySelectorAll('.filter-btn');

// Auth elements
const loginModal = document.getElementById('loginModal');
const signupModal = document.getElementById('signupModal');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const loginBtn = document.getElementById('loginBtn');
const signupBtn = document.getElementById('signupBtn');
const logoutBtn = document.getElementById('logoutBtn');
const authArea = document.getElementById('authArea');
const userArea = document.getElementById('userArea');
const userName = document.getElementById('userName');

// ===== Init =====
async function init() {
  await loadProducts();
  renderProducts();
  updateCartUI();
  updateAuthUI();
  bindEvents();
}

// ===== Auth UI =====
function updateAuthUI() {
  if (currentUser) {
    authArea.style.display = 'none';
    userArea.style.display = 'flex';
    userName.textContent = currentUser.name;
  } else {
    authArea.style.display = 'flex';
    userArea.style.display = 'none';
  }
}

function openLogin() {
  loginModal.classList.add('open');
  document.getElementById('loginError').style.display = 'none';
}

function openSignup() {
  signupModal.classList.add('open');
  document.getElementById('signupError').style.display = 'none';
}

function closeLogin() {
  loginModal.classList.remove('open');
  loginForm.reset();
}

function closeSignup() {
  signupModal.classList.remove('open');
  signupForm.reset();
}

async function handleSignup(e) {
  e.preventDefault();
  const formData = new FormData(signupForm);
  const payload = {
    name: formData.get('name'),
    email: formData.get('email'),
    location: formData.get('location'),
    password: formData.get('password')
  };

  const errEl = document.getElementById('signupError');
  errEl.style.display = 'none';

  try {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Signup failed');

    // Auto login after signup
    currentUser = data.user;
    localStorage.setItem('bb_user', JSON.stringify(currentUser));
    updateAuthUI();
    closeSignup();
    alert('Account created! You are now logged in.');
  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const formData = new FormData(loginForm);
  const payload = {
    email: formData.get('email'),
    password: formData.get('password')
  };

  const errEl = document.getElementById('loginError');
  errEl.style.display = 'none';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Login failed');

    currentUser = data.user;
    localStorage.setItem('bb_user', JSON.stringify(currentUser));
    updateAuthUI();
    closeLogin();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  }
}

function handleLogout() {
  currentUser = null;
  localStorage.removeItem('bb_user');
  updateAuthUI();
}

// ===== Load Products =====
async function loadProducts() {
  try {
    const res = await fetch('/api/products');
    products = await res.json();
  } catch (err) {
    console.error('Failed to load products', err);
    productsGrid.innerHTML = '<p style="text-align:center;color:#7a5c45;">Could not load products. Is the server running?</p>';
  }
}

// ===== Render Products =====
function renderProducts(filter = 'all') {
  const filtered = filter === 'all'
    ? products
    : products.filter(p => p.category === filter);

  if (!filtered.length) {
    productsGrid.innerHTML = '<p style="text-align:center;grid-column:1/-1;">No products in this category.</p>';
    return;
  }

  productsGrid.innerHTML = filtered.map(p => {
    const imageHtml = p.image
      ? `<img src="${p.image}" alt="${p.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
         <div class="product-image-fallback" style="display:none;">${getEmoji(p.category)}</div>`
      : `<div class="product-image-fallback">${getEmoji(p.category)}</div>`;

    return `
    <article class="product-card">
      <div class="product-image">${imageHtml}</div>
      <div class="product-body">
        <div class="product-category">${p.category}</div>
        <h3 class="product-name">${p.name}</h3>
        <p class="product-desc">${p.description || ''}</p>
        <div class="product-footer">
          <span class="product-price">Rs. ${p.price.toLocaleString()}</span>
          <button class="add-btn" data-id="${p.id}" title="Add to cart">+</button>
        </div>
      </div>
    </article>
  `;
  }).join('');

  document.querySelectorAll('.add-btn').forEach(btn => {
    btn.addEventListener('click', () => addToCart(+btn.dataset.id));
  });
}

function getEmoji(category) {
  const map = {
    Classic: '🍫',
    Loaded: '🥜',
    Boxes: '🎁',
    Special: '☕'
  };
  return map[category] || '🍫';
}

// ===== Cart Logic =====
function addToCart(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) return;

  const existing = cart.find(item => item.product_id === productId);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      product_id: product.id,
      product_name: product.name,
      price: product.price,
      quantity: 1
    });
  }

  saveCart();
  updateCartUI();
  openCart();
}

function changeQty(productId, delta) {
  const item = cart.find(i => i.product_id === productId);
  if (!item) return;

  item.quantity += delta;
  if (item.quantity <= 0) {
    cart = cart.filter(i => i.product_id !== productId);
  }

  saveCart();
  updateCartUI();
}

function saveCart() {
  localStorage.setItem('bb_cart', JSON.stringify(cart));
}

function getCartTotal() {
  return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function updateCartUI() {
  const totalItems = cart.reduce((sum, i) => sum + i.quantity, 0);
  cartCount.textContent = totalItems;

  if (cart.length === 0) {
    cartItems.innerHTML = '<p class="empty-cart">Your cart is empty</p>';
    checkoutBtn.disabled = true;
  } else {
    cartItems.innerHTML = cart.map(item => `
      <div class="cart-item">
        <div class="cart-item-info">
          <div class="cart-item-name">${item.product_name}</div>
          <div class="cart-item-price">Rs. ${item.price.toLocaleString()} each</div>
          <div class="cart-item-qty">
            <button class="qty-btn" data-id="${item.product_id}" data-delta="-1">−</button>
            <span>${item.quantity}</span>
            <button class="qty-btn" data-id="${item.product_id}" data-delta="1">+</button>
          </div>
        </div>
        <div style="font-weight:600;color:var(--brown)">
          Rs. ${(item.price * item.quantity).toLocaleString()}
        </div>
      </div>
    `).join('');

    document.querySelectorAll('.qty-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        changeQty(+btn.dataset.id, +btn.dataset.delta);
      });
    });

    checkoutBtn.disabled = false;
  }

  cartTotal.textContent = `Rs. ${getCartTotal().toLocaleString()}`;
}

// ===== Cart Sidebar =====
function openCart() {
  cartSidebar.classList.add('open');
  cartOverlay.classList.add('open');
}

function closeCartSidebar() {
  cartSidebar.classList.remove('open');
  cartOverlay.classList.remove('open');
}

// ===== Checkout =====
function openCheckout() {
  if (cart.length === 0) return;

  // Prefill from logged-in user
  if (currentUser) {
    const form = checkoutForm;
    form.customer_name.value = currentUser.name || '';
    form.customer_email.value = currentUser.email || '';
    form.city.value = currentUser.location || '';
  }

  orderSummary.innerHTML = `
    <strong>Order Summary</strong><br>
    ${cart.map(i => `${i.product_name} × ${i.quantity}`).join('<br>')}
    <br><br>
    <strong>Total: Rs. ${getCartTotal().toLocaleString()}</strong>
  `;

  closeCartSidebar();
  checkoutModal.classList.add('open');
}

function closeCheckout() {
  checkoutModal.classList.remove('open');
}

// ===== Place Order =====
async function placeOrder(e) {
  e.preventDefault();

  const formData = new FormData(checkoutForm);
  const payload = {
    customer_name: formData.get('customer_name'),
    customer_phone: formData.get('customer_phone'),
    customer_email: formData.get('customer_email'),
    address: formData.get('address'),
    city: formData.get('city'),
    notes: formData.get('notes'),
    items: cart,
    total: getCartTotal(),
    user_id: currentUser ? currentUser.id : null
  };

  const submitBtn = checkoutForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Placing order...';

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Order failed');

    cart = [];
    saveCart();
    updateCartUI();
    closeCheckout();
    checkoutForm.reset();

    orderIdDisplay.textContent = data.orderId.slice(0, 8).toUpperCase();
    successModal.classList.add('open');
  } catch (err) {
    alert('Something went wrong: ' + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Place Order';
  }
}

// ===== Events =====
function bindEvents() {
  cartBtn.addEventListener('click', openCart);
  closeCart.addEventListener('click', closeCartSidebar);
  cartOverlay.addEventListener('click', closeCartSidebar);
  checkoutBtn.addEventListener('click', openCheckout);
  closeModal.addEventListener('click', closeCheckout);
  checkoutForm.addEventListener('submit', placeOrder);

  closeSuccess.addEventListener('click', () => {
    successModal.classList.remove('open');
  });

  // Auth
  loginBtn.addEventListener('click', openLogin);
  signupBtn.addEventListener('click', openSignup);
  logoutBtn.addEventListener('click', handleLogout);
  document.getElementById('closeLogin').addEventListener('click', closeLogin);
  document.getElementById('closeSignup').addEventListener('click', closeSignup);
  loginForm.addEventListener('submit', handleLogin);
  signupForm.addEventListener('submit', handleSignup);

  document.getElementById('switchToSignup').addEventListener('click', (e) => {
    e.preventDefault();
    closeLogin();
    openSignup();
  });

  document.getElementById('switchToLogin').addEventListener('click', (e) => {
    e.preventDefault();
    closeSignup();
    openLogin();
  });

  // Filters
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderProducts(btn.dataset.filter);
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeCartSidebar();
      closeCheckout();
      closeLogin();
      closeSignup();
      successModal.classList.remove('open');
    }
  });
}

// Start
init();
