# Gulf Way Auto Service · Dashboard

Service Analytics & Fleet Intelligence Dashboard for **Gulf Way Auto Service LLC**.

Branded React dashboard that ingests garage CSV exports and produces:

- 8 live KPIs (each with one-click XLSX export)
- Crew leaderboard, workload donut, mileage histogram, job timeline
- Mileage Fleet Registry — 5 deduplicated vehicle buckets (0–25k, 25–50k, 50–75k, 75–100k, 100k+)
- Per-vehicle history XLSX
- Branded PDF letterhead reports (click any bike number)
- Multi-sheet Master Excel report

---

## 🚀 Quick Start (Local)

Requires **Node.js 18+** ([download here](https://nodejs.org)).

```bash
npm install
npm run dev
```

Open http://localhost:5173 — drop your `GWAS_CSV_DATA.csv` and explore.

For a production build:

```bash
npm run build
npm run preview      # local preview of the production build
```

The `dist/` folder is your deployable output.

---

## 🌍 Deployment Options

### Option A — Vercel (Recommended · Free, 5 min)

**Easiest, gives you a live URL like `gulfway-dashboard.vercel.app`**

1. Create a free GitHub account at https://github.com (if you don't have one).
2. Create a new repository called `gulfway-dashboard`.
3. Upload all files from this folder to the repo (drag & drop in GitHub web UI works).
4. Go to https://vercel.com → Sign in with GitHub → "Add New Project".
5. Select your `gulfway-dashboard` repo → Click **Deploy**.
6. Done! Vercel auto-detects Vite and gives you a live URL.

To use a custom domain like `dashboard.gwauto.ae`:
- In Vercel → Project Settings → Domains → Add `dashboard.gwauto.ae`
- Add the CNAME record Vercel shows you to your Namecheap/GoDaddy DNS panel.

### Option B — Netlify (Free, 5 min)

1. Push code to GitHub (steps 1–3 above).
2. Go to https://app.netlify.com → "Add new site" → "Import an existing project".
3. Connect GitHub → Pick your repo → Click **Deploy**.
4. Free `*.netlify.app` URL is ready instantly. Custom domain in site settings.

### Option C — StackBlitz (Instant share, 2 min)

For a quick shareable demo without GitHub:

1. Go to https://stackblitz.com → "Create" → Vite → React.
2. Copy `src/App.jsx`, `package.json`, `tailwind.config.js`, `postcss.config.js`, and `src/index.css` from this folder into the StackBlitz project.
3. Click "Share" — anyone with the link can use the dashboard live.

### Option D — Self-hosted on your server

If you have a VPS / cPanel hosting:

```bash
npm install
npm run build
# Upload contents of dist/ folder to your web server's public_html
```

The dashboard is **fully static** — works on any web host (Hostinger, GoDaddy, AWS S3, Cloudflare Pages, GitHub Pages, etc.).

---

## 🔐 Restricting Access

The dashboard is currently public (anyone with the URL can use it). To restrict access:

**Vercel:** Project Settings → Deployment Protection → Enable "Vercel Authentication" (free for teams).

**Netlify:** Site Settings → Visitor access → Enable Password Protection (paid feature).

**Cloudflare Access** (free for up to 50 users): Put your dashboard behind email-based login. Works with any host.

---

## 🗄️ Adding a Database (Multi-User Persistence)

Currently each user uploads their own CSV. To have **everyone see the same shared data**, you need a backend + database. Recommended free stack:

- **Frontend:** This dashboard (deploy as above)
- **Backend API:** Vercel Serverless Functions (or Express on Railway)
- **Database:** Supabase (PostgreSQL) or Neon — both have generous free tiers
- **Auth:** Supabase Auth or Clerk (also free tiers)

I can scaffold this entire backend if needed — just ask. The schema would be:

```sql
CREATE TABLE service_records (
  id INT PRIMARY KEY,
  business_id INT,
  customer_name VARCHAR(255),
  vehicle_no VARCHAR(50),
  crew_code VARCHAR(50),
  odometer_reading INT,
  service_date DATE,
  invoice_value DECIMAL(10, 2),
  service_type VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_crew ON service_records(crew_code);
CREATE INDEX idx_customer ON service_records(customer_name);
CREATE INDEX idx_vehicle ON service_records(vehicle_no);
```

---

## 📁 Project Structure

```
gulfway-dashboard/
├── package.json           # Dependencies
├── vite.config.js         # Vite bundler config
├── tailwind.config.js     # Tailwind theme (Gulf Way colors)
├── postcss.config.js      # PostCSS / Tailwind processor
├── index.html             # HTML entry point + favicon
├── vercel.json            # Vercel SPA routing
├── netlify.toml           # Netlify SPA routing
├── .gitignore
├── README.md              # This file
└── src/
    ├── main.jsx           # React mount point
    ├── App.jsx            # Main dashboard component (all logic)
    └── index.css          # Tailwind directives
```

---

## 🎨 Brand Tokens

Defined in `tailwind.config.js` and the `BRAND` constant at the top of `src/App.jsx`:

| Token         | Hex       | Usage                          |
| ------------- | --------- | ------------------------------ |
| `gw-red`      | `#C8102E` | Primary accent, CTAs, KPI tops |
| `gw-red-dark` | `#9A0E26` | Hover states                   |
| `gw-navy`     | `#0F1B2D` | Headers, table heads, text     |
| `gw-cream`    | `#FAF7F2` | Background                     |
| `gw-gold`     | `#D4A017` | Disclaimer / accent badges     |

---

## 📞 Company Contact (in PDF letterhead)

- **Gulf Way Auto Service LLC**
- 5 4a St, Ras Al Khor Industrial Area 1, Dubai, UAE
- Tel: +971 50 605 0030 · Hotline: 800 GULFWAY
- enquiry@gwauto.ae · gwauto.ae

To update these, edit the `COMPANY` object at the top of `src/App.jsx`.
