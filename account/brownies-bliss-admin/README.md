# 🍫 Brownies Bliss – Online Brownie Delivery

**Version 1.1** – Plain Node.js app with storefront + Admin panel.

No Docker. No MySQL. Just Node.js + a single JSON file.

## Features

### Customer storefront
- Product listing with category filters
- Shopping cart (saved in browser)
- Checkout form → order saved
- Mobile-friendly UI

### Owner Admin panel (`/admin`)
- See all orders (newest first)
- Change order status (Pending → Confirmed → Preparing → Out for delivery → Delivered)
- Add new products
- Edit price / stock / description
- Delete products
- Auto-refreshes orders every 15 seconds
- New order appears in the **terminal** instantly

## How to Run

```bash
cd brownies-bliss
npm install
npm start
```

Then open:

| Page     | URL                          |
|----------|------------------------------|
| Store    | http://localhost:3000        |
| Admin    | http://localhost:3000/admin  |

**Admin password:** `brownies2026`  
(You can change it in `server.js` → `ADMIN_PASSWORD`)

## How the owner knows about a purchase

1. **Terminal notification** – when a customer places an order you will see:

```
🔔 NEW ORDER RECEIVED!
   Customer : Shan
   Phone    : 0771234567
   Total    : Rs. 1450
   Order ID : a1b2c3d4-...
```

2. **Admin panel** – open `/admin`, login, and the new order appears at the top with status **Pending**.

## How the owner adds items

1. Go to http://localhost:3000/admin
2. Login with password `brownies2026`
3. Click the **Products** tab
4. Fill the form (Name + Price are required)
5. Click **Add Product**

You can also Edit or Delete existing products from the same page.

## Project Structure

```
brownies-bliss/
├── package.json
├── server.js           ← Backend + Admin API
├── db.js               ← Single-file database
├── database.json       ← Created automatically
├── public/
│   ├── index.html      ← Customer store
│   ├── admin.html      ← Owner admin panel
│   ├── css/style.css
│   └── js/app.js
└── README.md
```

## Changing the admin password

Open `server.js` and change this line:

```js
const ADMIN_PASSWORD = 'brownies2026';
```

## Notes

- Cart is stored in the browser (`localStorage`)
- Orders & products are stored in `database.json`
- Prices are in Sri Lankan Rupees
- This is still a simple first version – easy to extend later
