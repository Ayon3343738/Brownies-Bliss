const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const Stripe = require("stripe");
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const db = require("./db");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
// Optional: run the admin on its own port (e.g. 3001). Leave empty to keep /admin on the main port.
const ADMIN_PORT = process.env.ADMIN_PORT ? Number(process.env.ADMIN_PORT) : null;
const SPLIT = ADMIN_PORT && ADMIN_PORT !== PORT;
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;
const APP_URL = (process.env.APP_URL || `http://localhost:${PORT}`).replace(
  /\/$/,
  "",
);

// Simple admin password (change this!)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "brownies2026";

// Ensure images folder exists
const imagesDir = path.join(__dirname, "public", "images");
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

// Multer setup for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, imagesDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    const safeName = file.originalname
      .replace(ext, "")
      .replace(/[^a-z0-9]/gi, "-")
      .toLowerCase()
      .slice(0, 40);
    cb(null, `${Date.now()}-${safeName}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|gif/;
    const ext = path.extname(file.originalname).toLowerCase().slice(1);
    if (allowed.test(ext) || allowed.test(file.mimetype.split("/")[1])) {
      cb(null, true);
    } else {
      cb(new Error("Only image files (jpg, png, webp, gif) are allowed"));
    }
  },
});

// Middleware
app.use(cors());

// ---- Separate ports: store port shows only the store, admin port shows only the admin ----
if (SPLIT) {
  app.use((req, res, next) => {
    const isAdminPort = req.socket.localPort === ADMIN_PORT;
    const p = req.path;
    if (isAdminPort) {
      const allowed =
        p === "/" ||
        p === "/admin" ||
        p.startsWith("/api/admin") ||
        p === "/api/products" ||
        p.startsWith("/images/") ||
        p.startsWith("/css/");
      if (!allowed) return res.status(404).send("Not found");
      if (p === "/" || p === "/admin") {
        const html = fs
          .readFileSync(path.join(__dirname, "public", "admin.html"), "utf8")
          .replace(/href="\/"/g, `href="http://localhost:${PORT}/"`);
        return res.type("html").send(html);
      }
      return next();
    }
    // store port: hide the admin completely
    if (p === "/admin" || p.startsWith("/api/admin")) {
      return res.status(404).send("Not found");
    }
    next();
  });
}

// Stripe requires the unmodified request body to verify webhook signatures.
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
      return res.status(503).send("Stripe webhook is not configured");
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        req.headers["stripe-signature"],
        process.env.STRIPE_WEBHOOK_SECRET,
      );
    } catch (err) {
      console.error(
        "Stripe webhook signature verification failed:",
        err.message,
      );
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      if (
        event.type === "checkout.session.completed" ||
        event.type === "checkout.session.async_payment_succeeded"
      ) {
        const session = event.data.object;
        if (session.payment_status === "paid") {
          db.updateOrderPayment(session.metadata.orderId, {
            payment_status: "paid",
            payment_intent_id: session.payment_intent || null,
            status: "confirmed",
          });
        }
      } else if (
        event.type === "checkout.session.async_payment_failed" ||
        event.type === "checkout.session.expired"
      ) {
        const session = event.data.object;
        db.updateOrderPayment(session.metadata.orderId, {
          payment_status: "failed",
        });
      }
      res.json({ received: true });
    } catch (err) {
      console.error("Stripe webhook processing error:", err);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  },
);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Simple admin auth middleware
function requireAdmin(req, res, next) {
  const password = req.headers["x-admin-password"] || req.query.password;
  if (password === ADMIN_PASSWORD) return next();
  return res.status(401).json({ error: "Unauthorized. Wrong admin password." });
}

// ==================== AUTH API ====================

// Sign up
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { name, email, location, password } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ error: "Name, email and password are required" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email address" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = db.createUser({ name, email, location, passwordHash });

    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    res.status(201).json({
      success: true,
      message: "Account created successfully",
      user: result.user,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = db.findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const { passwordHash, ...safeUser } = user;
    res.json({
      success: true,
      message: "Login successful",
      user: safeUser,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ==================== PUBLIC API ====================

// Get all products
app.get("/api/products", (req, res) => {
  try {
    res.json(db.getProducts());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single product
app.get("/api/products/:id", (req, res) => {
  try {
    const product = db.getProduct(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a pending order and redirect the customer to Stripe-hosted Checkout.
app.post("/api/payments/create-checkout-session", async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({
        error:
          "Stripe is not configured. Add STRIPE_SECRET_KEY to your .env file.",
      });
    }

    const {
      customer_name,
      customer_phone,
      customer_email,
      address,
      city,
      notes,
      items,
      user_id,
    } = req.body;
    if (
      !customer_name ||
      !customer_phone ||
      !address ||
      !Array.isArray(items) ||
      !items.length
    ) {
      return res
        .status(400)
        .json({ error: "Missing required checkout details" });
    }

    // Never trust prices or totals sent by the browser. Re-read products and prices on the server.
    const products = db.getProducts();
    const verifiedItems = items.map((item) => {
      const product = products.find((p) => p.id === Number(item.product_id));
      const quantity = Number(item.quantity);
      if (
        !product ||
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > 99
      ) {
        throw new Error(
          "One or more cart items are invalid. Please refresh your cart.",
        );
      }
      return {
        product_id: product.id,
        product_name: product.name,
        price: Number(product.price),
        quantity,
      };
    });

    const total = verifiedItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    if (!Number.isFinite(total) || total <= 0) {
      return res.status(400).json({ error: "Invalid order total" });
    }

    const order = {
      id: uuidv4(),
      user_id: user_id || null,
      customer_name,
      customer_phone,
      customer_email: customer_email || null,
      address,
      city: city || null,
      notes: notes || null,
      total,
      currency: "AUD",
      items: verifiedItems,
      status: "pending",
      payment_provider: "stripe",
      payment_status: "unpaid",
      created_at: new Date().toISOString(),
    };
    db.createOrder(order);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: verifiedItems.map((item) => ({
        price_data: {
          currency: "aud",
          product_data: { name: item.product_name },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity,
      })),
      customer_email: customer_email || undefined,
      metadata: { orderId: order.id },
      success_url: `${APP_URL}/?payment=success&order_id=${encodeURIComponent(order.id)}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/?payment=cancelled&order_id=${encodeURIComponent(order.id)}`,
    });

    db.updateOrderPayment(order.id, { stripe_session_id: session.id });
    res.status(201).json({ url: session.url });
  } catch (err) {
    console.error("Checkout session error:", err);
    res.status(500).json({ error: err.message || "Unable to start payment" });
  }
});

// Confirm the Checkout Session on return; webhook remains the source of truth for order fulfilment.
app.get("/api/payments/session/:sessionId", async (req, res) => {
  try {
    if (!stripe)
      return res.status(503).json({ error: "Stripe is not configured" });
    const session = await stripe.checkout.sessions.retrieve(
      req.params.sessionId,
    );
    res.json({
      paid: session.payment_status === "paid",
      orderId: session.metadata.orderId || null,
    });
  } catch (err) {
    console.error("Unable to retrieve Stripe session:", err.message);
    res.status(400).json({ error: "Unable to verify payment session" });
  }
});

// ==================== ADMIN API ====================

app.get("/api/admin/orders", requireAdmin, (req, res) => {
  try {
    res.json(db.getOrders());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/admin/orders/:id/status", requireAdmin, (req, res) => {
  try {
    const { status } = req.body;
    const allowed = [
      "pending",
      "confirmed",
      "preparing",
      "out_for_delivery",
      "delivered",
      "cancelled",
    ];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    const order = db.updateOrderStatus(req.params.id, status);
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post(
  "/api/admin/products",
  requireAdmin,
  upload.single("image"),
  (req, res) => {
    try {
      const { name, description, price, category, stock } = req.body;
      if (!name || price === undefined) {
        return res.status(400).json({ error: "Name and price are required" });
      }

      const imagePath = req.file ? `/images/${req.file.filename}` : "";

      const product = db.addProduct({
        name,
        description: description || "",
        price,
        category: category || "Classic",
        stock: stock || 0,
        image: imagePath,
      });

      res.status(201).json(product);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  },
);

app.put(
  "/api/admin/products/:id",
  requireAdmin,
  upload.single("image"),
  (req, res) => {
    try {
      const updates = {
        name: req.body.name,
        description: req.body.description,
        price: req.body.price,
        category: req.body.category,
        stock: req.body.stock,
      };

      if (req.file) {
        updates.image = `/images/${req.file.filename}`;
      }

      Object.keys(updates).forEach((key) => {
        if (updates[key] === undefined) delete updates[key];
      });

      const product = db.updateProduct(req.params.id, updates);
      if (!product) return res.status(404).json({ error: "Product not found" });
      res.json(product);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  },
);

app.delete("/api/admin/products/:id", requireAdmin, (req, res) => {
  try {
    const ok = db.deleteProduct(req.params.id);
    if (!ok) return res.status(404).json({ error: "Product not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve admin page
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// Serve frontend for all other routes
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Error handler for multer
app.use((err, req, res, next) => {
  if (
    err instanceof multer.MulterError ||
    (err.message && err.message.includes("Only image"))
  ) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

// Start server
function logStart() {
  console.log(`\n🍫 Brownies Bliss is running!`);
  console.log(`   Store  → http://localhost:${PORT}`);
  console.log(
    SPLIT
      ? `   Admin  → http://localhost:${ADMIN_PORT}`
      : `   Admin  → http://localhost:${PORT}/admin`,
  );
  console.log(
    stripe
      ? `   Stripe → key loaded (${process.env.STRIPE_SECRET_KEY.slice(0, 8)}...)`
      : `   Stripe → NOT configured (no STRIPE_SECRET_KEY found in ${path.join(__dirname, ".env")})`,
  );
}

// One server process, one database, two ports
function listenOn(port, label, cb) {
  const srv = app.listen(port, cb);
  srv.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `\n❌ Port ${port} (${label}) is already in use.\n` +
          `   Another copy of the app is still running (an old terminal, or the old brownies-bliss-admin folder).\n` +
          `   Close it, or change ${label === "admin" ? "ADMIN_PORT" : "PORT"} in your .env, then run npm start again.\n`,
      );
    } else {
      console.error(`Server error on port ${port}:`, err.message);
    }
    process.exit(1);
  });
  return srv;
}

listenOn(PORT, "store", () => {
  if (!SPLIT) return logStart();
  listenOn(ADMIN_PORT, "admin", logStart);
});
