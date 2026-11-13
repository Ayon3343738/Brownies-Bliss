const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

// Simple admin password (change this!)
const ADMIN_PASSWORD = "brownies2026";

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

// Create order (customer)
app.post("/api/orders", (req, res) => {
  try {
    const {
      customer_name,
      customer_phone,
      customer_email,
      address,
      city,
      notes,
      items,
      total,
      user_id,
    } = req.body;

    if (
      !customer_name ||
      !customer_phone ||
      !address ||
      !items ||
      !items.length
    ) {
      return res.status(400).json({ error: "Missing required fields" });
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
      total: Number(total),
      currency: "AUD",
      items,
      status: "pending",
      created_at: new Date().toISOString(),
    };

    db.createOrder(order);

    console.log("\n🔔 NEW ORDER RECEIVED!");
    console.log(`   Customer : ${customer_name}`);
    console.log(`   Phone    : ${customer_phone}`);
    console.log(
      `   Total    : ${new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(Number(total) || 0)}`,
    );
    console.log(`   Order ID : ${order.id}`);
    console.log("   → Open /admin to view details\n");

    res.status(201).json({
      success: true,
      orderId: order.id,
      message: "Order placed successfully! We will contact you soon.",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
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
//app.get('/admin', (req, res) => {
// res.sendFile(path.join(__dirname, 'public', 'admin.html'));
//});

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
app.listen(PORT, () => {
  console.log(`\n🍫 Brownies Bliss is running!`);
  console.log(`   Store  → http://localhost:${PORT}`);
  console.log(`   Admin  → http://localhost:${PORT}/admin`);
  console.log(`   Password: ${ADMIN_PASSWORD}\n`);
});
