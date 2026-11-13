// ===== State =====
let products = [];
let cart = JSON.parse(localStorage.getItem('bb_cart') || '[]');
let currentUser = JSON.parse(localStorage.getItem('bb_user') || 'null');

// ===== Currency =====
// All product and order prices are stored as numeric AUD amounts.
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD'
  }).format(Number(amount) || 0);
}

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
  await handlePaymentReturn();
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
          <span class="product-price">${formatCurrency(p.price)}</span>
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
          <div class="cart-item-price">${formatCurrency(item.price)} each</div>
          <div class="cart-item-qty">
            <button class="qty-btn" data-id="${item.product_id}" data-delta="-1">−</button>
            <span>${item.quantity}</span>
            <button class="qty-btn" data-id="${item.product_id}" data-delta="1">+</button>
          </div>
        </div>
        <div style="font-weight:600;color:var(--brown)">
          ${formatCurrency(item.price * item.quantity)}
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

  cartTotal.textContent = formatCurrency(getCartTotal());
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
    <strong>Total: ${formatCurrency(getCartTotal())}</strong>
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
    items: cart.map(item => ({ product_id: item.product_id, quantity: item.quantity })),
    user_id: currentUser ? currentUser.id : null
  };

  const submitBtn = checkoutForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Redirecting to secure payment...';

  try {
    const res = await fetch('/api/payments/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Unable to start payment');
    if (!data.url) throw new Error('Stripe did not return a checkout URL');
    window.location.assign(data.url);
  } catch (err) {
    alert('Payment could not be started: ' + err.message);
    submitBtn.disabled = false;
    submitBtn.textContent = 'Pay securely with Stripe';
  }
}

async function handlePaymentReturn() {
  const params = new URLSearchParams(window.location.search);
  const paymentState = params.get('payment');
  const orderId = params.get('order_id');

  if (paymentState === 'cancelled') {
    alert('Payment was cancelled. Your cart is still available; you can try again.');
    window.history.replaceState({}, document.title, '/');
    return;
  }

  if (paymentState !== 'success') return;

  const sessionId = params.get('session_id');
  if (!sessionId) return;

  try {
    const response = await fetch(`/api/payments/session/${encodeURIComponent(sessionId)}`);
    const result = await response.json();
    if (!response.ok || !result.paid) {
      alert('Stripe is still confirming your payment. Please contact us if you were charged.');
      return;
    }

    cart = [];
    saveCart();
    updateCartUI();
    orderIdDisplay.textContent = (result.orderId || orderId || '').slice(0, 8).toUpperCase();
    document.getElementById('successMessage').textContent = 'Payment successful! Your order has been received.';
    successModal.classList.add('open');
    window.history.replaceState({}, document.title, '/');
  } catch (err) {
    console.error('Payment return verification failed:', err);
    alert('We could not verify the payment yet. Please contact us with your order reference.');
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
