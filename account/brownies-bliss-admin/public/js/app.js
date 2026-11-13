// ===== Currency =====
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD'
  }).format(Number(amount) || 0);
}

// ===== State =====
let products = [];
let cart = JSON.parse(localStorage.getItem("bb_cart") || "[]");

// ===== DOM Elements =====
const productsGrid = document.getElementById("productsGrid");
const cartBtn = document.getElementById("cartBtn");
const cartCount = document.getElementById("cartCount");
const cartSidebar = document.getElementById("cartSidebar");
const cartOverlay = document.getElementById("cartOverlay");
const closeCart = document.getElementById("closeCart");
const cartItems = document.getElementById("cartItems");
const cartTotal = document.getElementById("cartTotal");
const checkoutBtn = document.getElementById("checkoutBtn");
const checkoutModal = document.getElementById("checkoutModal");
const closeModal = document.getElementById("closeModal");
const checkoutForm = document.getElementById("checkoutForm");
const orderSummary = document.getElementById("orderSummary");
const successModal = document.getElementById("successModal");
const closeSuccess = document.getElementById("closeSuccess");
const orderIdDisplay = document.getElementById("orderIdDisplay");
const filterBtns = document.querySelectorAll(".filter-btn");

// ===== Init =====
async function init() {
  await loadProducts();
  renderProducts();
  updateCartUI();
  bindEvents();
}

// ===== Load Products =====
async function loadProducts() {
  try {
    const res = await fetch("/api/products");
    products = await res.json();
  } catch (err) {
    console.error("Failed to load products", err);
    productsGrid.innerHTML =
      '<p style="text-align:center;color:#7a5c45;">Could not load products. Is the server running?</p>';
  }
}

// ===== Render Products =====
function renderProducts(filter = "all") {
  const filtered =
    filter === "all" ? products : products.filter((p) => p.category === filter);

  if (!filtered.length) {
    productsGrid.innerHTML =
      '<p style="text-align:center;grid-column:1/-1;">No products in this category.</p>';
    return;
  }

  productsGrid.innerHTML = filtered
    .map((p) => {
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
        <p class="product-desc">${p.description || ""}</p>
        <div class="product-footer">
          <span class="product-price">${formatCurrency(p.price)}</span>
          <button class="add-btn" data-id="${p.id}" title="Add to cart">+</button>
        </div>
      </div>
    </article>
  `;
    })
    .join("");

  // Bind add buttons
  document.querySelectorAll(".add-btn").forEach((btn) => {
    btn.addEventListener("click", () => addToCart(+btn.dataset.id));
  });
}

function getEmoji(category) {
  const map = {
    Classic: "🍫",
    Loaded: "🥜",
    Boxes: "🎁",
    Special: "☕",
  };
  return map[category] || "🍫";
}

// ===== Cart Logic =====
function addToCart(productId) {
  const product = products.find((p) => p.id === productId);
  if (!product) return;

  const existing = cart.find((item) => item.product_id === productId);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      product_id: product.id,
      product_name: product.name,
      price: product.price,
      quantity: 1,
    });
  }

  saveCart();
  updateCartUI();
  openCart();
}

function changeQty(productId, delta) {
  const item = cart.find((i) => i.product_id === productId);
  if (!item) return;

  item.quantity += delta;
  if (item.quantity <= 0) {
    cart = cart.filter((i) => i.product_id !== productId);
  }

  saveCart();
  updateCartUI();
}

function saveCart() {
  localStorage.setItem("bb_cart", JSON.stringify(cart));
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
    cartItems.innerHTML = cart
      .map(
        (item) => `
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
    `,
      )
      .join("");

    document.querySelectorAll(".qty-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        changeQty(+btn.dataset.id, +btn.dataset.delta);
      });
    });

    checkoutBtn.disabled = false;
  }

  cartTotal.textContent = formatCurrency(getCartTotal());
}

// ===== Cart Sidebar =====
function openCart() {
  cartSidebar.classList.add("open");
  cartOverlay.classList.add("open");
}

function closeCartSidebar() {
  cartSidebar.classList.remove("open");
  cartOverlay.classList.remove("open");
}

// ===== Checkout =====
function openCheckout() {
  if (cart.length === 0) return;

  orderSummary.innerHTML = `
    <strong>Order Summary</strong><br>
    ${cart.map((i) => `${i.product_name} × ${i.quantity}`).join("<br>")}
    <br><br>
    <strong>Total: ${formatCurrency(getCartTotal())}</strong>
  `;

  closeCartSidebar();
  checkoutModal.classList.add("open");
}

function closeCheckout() {
  checkoutModal.classList.remove("open");
}

// ===== Place Order =====
async function placeOrder(e) {
  e.preventDefault();

  const formData = new FormData(checkoutForm);
  const payload = {
    customer_name: formData.get("customer_name"),
    customer_phone: formData.get("customer_phone"),
    customer_email: formData.get("customer_email"),
    address: formData.get("address"),
    city: formData.get("city"),
    notes: formData.get("notes"),
    items: cart,
    total: getCartTotal(),
  };

  const submitBtn = checkoutForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = "Placing order...";

  try {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.error || "Order failed");

    cart = [];
    saveCart();
    updateCartUI();
    closeCheckout();
    checkoutForm.reset();

    orderIdDisplay.textContent = data.orderId.slice(0, 8).toUpperCase();
    successModal.classList.add("open");
  } catch (err) {
    alert("Something went wrong: " + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Place Order";
  }
}

// ===== Events =====
function bindEvents() {
  cartBtn.addEventListener("click", openCart);
  closeCart.addEventListener("click", closeCartSidebar);
  cartOverlay.addEventListener("click", closeCartSidebar);
  checkoutBtn.addEventListener("click", openCheckout);
  closeModal.addEventListener("click", closeCheckout);
  checkoutForm.addEventListener("submit", placeOrder);

  closeSuccess.addEventListener("click", () => {
    successModal.classList.remove("open");
  });

  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      filterBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderProducts(btn.dataset.filter);
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeCartSidebar();
      closeCheckout();
      successModal.classList.remove("open");
    }
  });
}

// Start
init();
