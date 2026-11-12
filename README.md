# 🍫 Brownies Bliss – Online Brownie Delivery

**Version 1** – Plain Node.js app with frontend + backend + single-file database.

No Docker. No MySQL. No extra services. Just Node.js.

## Features

- Product listing with category filters (Classic / Loaded / Boxes / Special)
- Shopping cart (saved in browser)
- Checkout form → order saved to a single JSON file
- Clean, mobile-friendly UI
- REST API

## Requirements

- **Node.js 18+** (that’s all)

## How to Run on Your PC

```bash
# 1. Open terminal in the project folder
cd brownies-bliss

# 2. Install dependencies (only needed once)
npm install

# 3. Start the server
npm start
```

Open your browser:

**http://localhost:3000**

That’s it. The database file (`database.json`) is created automatically on first run.

## Project Structure

```
brownies-bliss/
├── package.json
├── server.js           ← Express backend + API
├── db.js               ← Single-file database (JSON)
├── database.json       ← Created automatically (your data)
├── public/
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js
└── README.md
```

## API Endpoints

| Method | Endpoint          | Description             |
|--------|-------------------|-------------------------|
| GET    | /api/products     | List all products       |
| GET    | /api/products/:id | Single product          |
| POST   | /api/orders       | Place a new order       |
| GET    | /api/orders       | List all orders         |
| GET    | /api/orders/:id   | Single order details    |

## Sample Products (seeded automatically)

| Product                     | Price   | Category |
|-----------------------------|---------|----------|
| Classic Chocolate Brownie   | Rs. 450 | Classic  |
| Walnut Crunch Brownie       | Rs. 520 | Loaded   |
| Salted Caramel Brownie      | Rs. 580 | Loaded   |
| Double Chocolate Chip       | Rs. 550 | Classic  |
| Peanut Butter Swirl         | Rs. 560 | Loaded   |
| Mini Brownie Box (6 pcs)    | Rs. 1,200 | Boxes  |
| Gift Box (12 pcs)           | Rs. 2,400 | Boxes  |
| Espresso Brownie            | Rs. 540 | Special  |

## Notes

- Cart lives in the browser (`localStorage`)
- Orders are stored permanently in `database.json`
- Prices are in Sri Lankan Rupees – edit them in `db.js`
- This is the first version so you can easily rebuild / improve it later
- Want real SQLite later? We can swap the `db.js` layer without touching the frontend

Enjoy ordering imaginary brownies 🍫
