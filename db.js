const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'database.json');

// Default seed data
const defaultData = {
  users: [],
  products: [
    {
      id: 1,
      name: 'Classic Chocolate Brownie',
      description: 'Rich, fudgy classic brownie made with Belgian dark chocolate. Perfect balance of sweetness and depth.',
      price: 450,
      image: '',
      category: 'Classic',
      stock: 100
    },
    {
      id: 2,
      name: 'Walnut Crunch Brownie',
      description: 'Loaded with toasted walnuts for a perfect crunch in every bite.',
      price: 520,
      image: '',
      category: 'Loaded',
      stock: 80
    },
    {
      id: 3,
      name: 'Salted Caramel Brownie',
      description: 'Swirled with homemade salted caramel and finished with a sprinkle of sea salt.',
      price: 580,
      image: '',
      category: 'Loaded',
      stock: 70
    },
    {
      id: 4,
      name: 'Double Chocolate Chip',
      description: 'Extra chocolate chips melted into our signature batter. For true chocolate lovers.',
      price: 550,
      image: '',
      category: 'Classic',
      stock: 90
    },
    {
      id: 5,
      name: 'Peanut Butter Swirl',
      description: 'Creamy peanut butter swirled through rich chocolate brownie.',
      price: 560,
      image: '',
      category: 'Loaded',
      stock: 60
    },
    {
      id: 6,
      name: 'Mini Brownie Box (6 pcs)',
      description: 'Assorted mini brownies – perfect for gifting or tasting.',
      price: 1200,
      image: '',
      category: 'Boxes',
      stock: 40
    },
    {
      id: 7,
      name: 'Gift Box (12 pcs)',
      description: 'Beautifully packed gift box with mixed classic & loaded brownies.',
      price: 2400,
      image: '',
      category: 'Boxes',
      stock: 25
    },
    {
      id: 8,
      name: 'Espresso Brownie',
      description: 'Infused with real espresso for a subtle coffee kick. Great with ice cream.',
      price: 540,
      image: '',
      category: 'Special',
      stock: 50
    }
  ],
  orders: []
};

function load() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(defaultData, null, 2));
    console.log('✓ Created database.json with seed products');
    return structuredClone(defaultData);
  }
  const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  // Ensure users array exists for older databases
  if (!data.users) data.users = [];
  return data;
}

function save(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function nextProductId(products) {
  if (!products.length) return 1;
  return Math.max(...products.map(p => p.id)) + 1;
}

const db = {
  // ---- Users ----
  findUserByEmail(email) {
    const data = load();
    return data.users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
  },

  createUser({ name, email, location, passwordHash }) {
    const data = load();
    if (!data.users) data.users = [];

    if (data.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      return { error: 'Email already registered' };
    }

    const user = {
      id: require('uuid').v4(),
      name,
      email: email.toLowerCase(),
      location: location || '',
      passwordHash,
      created_at: new Date().toISOString()
    };

    data.users.push(user);
    save(data);

    // Return user without password
    const { passwordHash: _, ...safe } = user;
    return { user: safe };
  },

  // ---- Products ----
  getProducts() {
    return load().products;
  },

  getProduct(id) {
    return load().products.find(p => p.id === Number(id));
  },

  addProduct(product) {
    const data = load();
    const newProduct = {
      id: nextProductId(data.products),
      name: product.name,
      description: product.description || '',
      price: Number(product.price),
      image: product.image || '',
      category: product.category || 'Classic',
      stock: Number(product.stock) || 0
    };
    data.products.push(newProduct);
    save(data);
    return newProduct;
  },

  updateProduct(id, updates) {
    const data = load();
    const idx = data.products.findIndex(p => p.id === Number(id));
    if (idx === -1) return null;

    const p = data.products[idx];
    if (updates.name !== undefined) p.name = updates.name;
    if (updates.description !== undefined) p.description = updates.description;
    if (updates.price !== undefined) p.price = Number(updates.price);
    if (updates.image !== undefined) p.image = updates.image;
    if (updates.category !== undefined) p.category = updates.category;
    if (updates.stock !== undefined) p.stock = Number(updates.stock);

    save(data);
    return p;
  },

  deleteProduct(id) {
    const data = load();
    const before = data.products.length;
    data.products = data.products.filter(p => p.id !== Number(id));
    if (data.products.length === before) return false;
    save(data);
    return true;
  },

  // ---- Orders ----
  createOrder(order) {
    const data = load();
    data.orders.unshift(order);
    save(data);
    return order;
  },

  getOrders() {
    return load().orders;
  },

  getOrder(id) {
    return load().orders.find(o => o.id === id);
  },

  updateOrderStatus(id, status) {
    const data = load();
    const order = data.orders.find(o => o.id === id);
    if (!order) return null;
    order.status = status;
    save(data);
    return order;
  }
};

module.exports = db;
