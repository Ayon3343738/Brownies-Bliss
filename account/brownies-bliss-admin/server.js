const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3001;

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
      customer_name,
      customer_phone,
      customer_email: customer_email || null,
      address,
      city: city || null,
      notes: notes || null,
      total,
      currency: "AUD",
      items,
      status: "pending",
      created_at: new Date().toISOString(),
    };

    db.createOrder(order);

    // Simple console notification for owner
    console.log("\n🔔 NEW ORDER RECEIVED!");
    console.log(`   Customer : ${customer_name}`);
    console.log(`   Phone    : ${customer_phone}`);
    console.log(
      `   Total    : ${new Intl.NumberFormat("en-AU", {
        style: "currency",
        currency: "AUD",
      }).format(Number(total) || 0)}`,
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

// Get all orders
app.get("/api/admin/orders", requireAdmin, (req, res) => {
  try {
    res.json(db.getOrders());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update order status
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

// Add product (with optional image)
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

// Update product (with optional new image)
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

      // Only update image if a new file was uploaded
      if (req.file) {
        updates.image = `/images/${req.file.filename}`;
      }

      // Remove undefined fields so we don't overwrite with undefined
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

// Delete product
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
  if (err instanceof multer.MulterError || err.message.includes("Only image")) {
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
