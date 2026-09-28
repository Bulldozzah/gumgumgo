# gumgumgo.

A modern rebuild of the Savvy Spree Saver / WiseUp Shop price-comparison platform,
restyled with a Fiverr-inspired design system and connected to the **same Supabase
project** (same users, roles, stores, products, prices and edge functions).

## Run

```sh
npm install
npm run dev      # http://localhost:8090
npm run build
```

## What's inside

- **Vite + React 18 + TypeScript (strict)** — Tailwind CSS, lucide icons, sonner toasts.
- **Same backend**: Supabase auth (email/password, PKCE), `user_roles`-based routing
  (shopper / store_owner / admin / super_admin), and the deployed edge functions
  (`suggest-budget-alternatives`, `search-users`).
- **Shopper** (`/shop`): shopping lists with budgets, product search + barcode scan,
  store assignment with in-stock/all totals, 2-store comparison, geolocation
  auto-check of the 5 nearest stores, AI budget optimizer, shopper price
  submissions (unverified until the store confirms), store feedback.
- **Store owner** (`/store`): price & stock management with verified badges,
  chunked CSV bulk import with full row validation, store contact details,
  feedback viewer.
- **Admin** (`/admin`): role assignment, store HQ / branch CRUD, owner assignment
  via email search (edge-function fallback), product catalog single + bulk import.

## Design system

Fiverr-style: `#1DBF73` green, charcoal ink (`#222325` / `#404145`), light gray
borders (`#E4E5E7`), white cards, Inter typeface, green-underline tab navigation.
Tokens live in `tailwind.config.ts`; component classes in `src/index.css`.
