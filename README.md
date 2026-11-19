# Sannara — E-commerce Website

Redesign of [ootyoriginals.in](https://ootyoriginals.in/) as a custom store.

| Folder | What it is | Stack | Runs on |
|---|---|---|---|
| `frontend/` | Customer storefront | React 19 + Vite + Tailwind CSS 4 | http://localhost:5173 |
| `adminpanel/` | Admin panel | React 19 + Vite + Tailwind CSS 4 | http://localhost:5174 |
| `backend/` | REST API | Node.js + Express 5 + MySQL (XAMPP) | http://localhost:5000 |

## First-time setup

1. **Start MySQL** from the XAMPP Control Panel.
2. **Backend** — creates the `ooty_originals` database, tables, the admin account and the product catalogue:
   ```bash
   cd backend
   npm install
   copy .env.example .env      # then set JWT_SECRET to a long random string
   npm run db:setup
   npm run dev
   ```
3. **Storefront** (new terminal):
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
4. **Admin panel** (new terminal):
   ```bash
   cd adminpanel
   npm install
   npm run dev
   ```

**Admin sign-in:** `admin@ootyoriginals.in` / `Admin@123` — change the password from the user menu (top right) → *My account* after the first sign-in.

## Opening it from a phone or another computer (same Wi-Fi)

The dev servers listen on the whole network, so any device on the same Wi-Fi / LAN can open the sites.

1. Find this computer's address: run `ipconfig` and look for **IPv4 Address** (for example `192.168.0.24`).
2. On the other device open `http://<that address>:5173` (store) or `http://<that address>:5174` (admin).

The address can change when the router restarts — run `ipconfig` again if the link stops working.
If a device cannot connect, allow **Node.js** through Windows Firewall, and check the router does not isolate Wi-Fi devices from each other.

## Going live — settings in `backend/.env`

| Setting | Until it is set | What to add |
|---|---|---|
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Razorpay **test** keys are set — payments open the real Razorpay window but no money moves | Replace with the live keys (`rzp_live_…`) from the Razorpay dashboard |
| `SMTP_USER`, `SMTP_PASS` | Emails are not sent (they are only printed in the API console) | Your Gmail address and a Gmail **App password** (not the normal password). Restart the API, then run `npm run mail:test` in `backend/` to send yourself a test email |
| `JWT_SECRET` | — | A long random string (32+ characters) |
| `CLIENT_URL`, `ADMIN_URL`, `API_URL` | Point to localhost | Your real domains |

Set `VITE_API_URL` in `frontend/.env` and `adminpanel/.env` to the live API address, then run `npm run build` in each; upload the generated `dist/` folders.

## Rate limits (protection against abuse)

Counted per visitor (IP address) in `backend/src/middleware/rateLimit.js`. Over the limit the API answers `429` with a plain message; product photos are never limited.

| What | Limit |
|---|---|
| Browsing the store (all API calls) | 240 a minute — change with `RATE_LIMIT_PER_MINUTE` in `.env` |
| Admin panel | 600 a minute — `ADMIN_RATE_LIMIT_PER_MINUTE` |
| Sign-in (store) / sign-in (admin) | 10 / 8 **wrong** attempts in 15 minutes — correct sign-ins never count |
| New accounts | 10 an hour |
| Password reset emails | 5 in 15 minutes |
| Cart pricing and coupon checks | 90 a minute |
| Placing orders, starting / confirming payment | 30 in 10 minutes |
| Contact form | 10 an hour |
| Admin photo uploads | 60 a minute |

On a live server behind nginx / Cloudflare / cPanel keep `TRUST_PROXY=1` (the default when `NODE_ENV=production`), otherwise every visitor looks like the same address and they share one allowance.

If a request fails (weak signal, server restarting), the store and admin panel retry it by themselves and the page fills in without a refresh.

## How checkout works

1. The shopper picks an address and a payment method on one page; every field is checked before anything is sent.
2. **Pay online** opens the Razorpay window on the same page. The order is confirmed only after the server has verified Razorpay's signature.
3. If the window is closed or the payment fails, the shopper stays on checkout with the cart intact and can press Pay again — the same order is reused, no duplicates.
4. An online order that is still unpaid after 30 minutes is cancelled automatically and its stock returns to the shop. Before cancelling (or re-charging), the server asks Razorpay whether the money did arrive; if it did, the order is confirmed instead.
5. **Cash on Delivery** orders are confirmed immediately.

## What can be changed without touching code (Admin panel)

| Where | What |
|---|---|
| Home banners | The big banners at the top of the home page (one or several — they rotate automatically), with a preview of each |
| Site settings | Announcement bar, the four home page highlights, "Our story" block, About page tagline and values, product page delivery & returns text, contact details, social links, delivery charge, Cash on Delivery on/off, FAQs |
| Categories | Names, descriptions, photos, order and visibility — these also drive the home page "Collections" tiles and the Shop menu |
| Products | Everything about a product, including best seller / new flags used by the home page rows |
| Pages | About, Privacy, Terms and Refund pages |
| Offers & coupons | Coupon codes shown in the cart |

## Folder structure

```
backend/
  server.js                 starts the API
  database/
    schema.sql              all tables
    setup.js                npm run db:setup / db:fresh
    seed/                   catalogue + default site content
  src/
    config/                 environment + MySQL pool
    middleware/             auth (JWT), validation/errors, image upload
    controllers/            storefront API  (auth, catalogue, cart, orders, payments, wishlist, content)
    controllers/admin/      admin API       (dashboard, reports, products, categories, orders, users, coupons, content)
    services/               order + payment gateway logic, report builder (Excel via exceljs, PDF via pdfkit)
    utils/                  pricing, emails, helpers
    routes/                 index.js (store) · admin.js (admin)
  uploads/                  product and content images

frontend/src/
  pages/                    Home, Shop, ProductDetail, Cart, Checkout, OrderResult, Wishlist, Compare,
                            About, Contact, ContentPage, auth/*, account/*
  components/               layout (Header, Footer), product cards, forms, UI kit,
                            Reveal / TextReveal (scroll and headline animations), CircleTransition (circle page transition)
  context/                  Auth, Shop (cart / wishlist / compare / settings), Toast
  lib/                      API client, formatting, payment, motion (button ripple)
  index.css                 design tokens (brand colours, type, components) and the "Motion" section

adminpanel/src/
  pages/                    Dashboard, Reports, Products, ProductForm, Categories, Orders, OrderDetail, Customers,
                            Coupons, SiteSettings, Pages, Messages, Account
  components/               Layout (sidebar), RevenueChart, ImageUploader, RichEditor, UI kit
```

## Modules

| # | Module | Where |
|---|---|---|
| 1 | User — register, login/logout, profile, change password, addresses | `frontend/src/pages/auth`, `account` |
| 2 | Admin — login, dashboard, profile, users, products & orders, content, reports (sales, product sales, stock, customers — download as Excel or PDF) | `adminpanel/` |
| 3 | Products — add/edit/delete, categories & sub-categories, images, options, specifications, stock | Admin → Products / Categories |
| 4 | Order & checkout — cart, quantities, coupons, address, order summary, place order | `Cart.jsx`, `Checkout.jsx` |
| 5 | Payments — Razorpay with server-side signature check, success/failure, transaction details | `backend/src/services/orderService.js`, `OrderResult.jsx` |
| 6 | Order management — customer order history & tracking; admin status, payment and history | `account/Orders*.jsx`, Admin → Orders |
| 7 | Emails — welcome, sign-in alert, order, payment, status update, cancellation, password reset | `backend/src/utils/emailTemplates.js` |
| 8 | Search & filter — name/keyword search, category, price range, availability, sorting | `Shop.jsx` |
| 9 | Wishlist & compare | `Wishlist.jsx`, `Compare.jsx` |
| 10 | Responsive — mobile, tablet, desktop | all pages |
| 11 | Security & performance — hashed passwords, JWT, rate limiting, validation, optimised WebP images, lazy-loaded pages | backend middleware |
| 12 | Pages — Home, About, Shop, Product, Cart, Checkout, Wishlist, Compare, My Account, My Orders, Contact, Login, Register, Privacy, Terms | `frontend/src/pages` |

## Useful commands (in `backend/`)

| Command | What it does |
|---|---|
| `npm run dev` | Start the API and restart on changes |
| `npm run db:setup` | Create anything missing — safe to re-run |
| `npm run db:fresh` | **Deletes all data** and rebuilds the database from the seed |
