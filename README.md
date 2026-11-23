# OpsSuite

One Next.js app with **two separate systems** on **one Supabase project**:

| System | URL | Who can open it |
|---|---|---|
| **Palay & Corn Buying Station** | `/grain` | admin + users assigned to *grain* |
| **Internet Billing & Collection** | `/isp` | admin + users assigned to *isp* |
| **Admin Console** (users, overview of both) | `/admin` | admin only |

Users of one system cannot see the other system at all. This is enforced by Postgres Row Level Security, so it holds even if someone calls the Supabase API directly. There is no public sign-up. Only the admin creates accounts.

Stack: Next.js 15 (App Router) · Supabase (Auth + Postgres + RLS) · Tailwind CSS 3 · lucide-react · react-hot-toast · chart.js.

---

## Setup

1. **Create a Supabase project** (one project for both systems).

2. **Run the schema.** Supabase → SQL Editor → paste all of [`supabase/schema.sql`](supabase/schema.sql) → Run. It is safe to re-run.

3. **Turn off public sign-ups.** Supabase → Authentication → Sign In / Providers → Email → disable **"Allow new users to sign up"**. Accounts without a profile can't see any data anyway, but turning sign-ups off keeps the user list clean.

4. **Environment.** Copy `.env.example` to `.env.local` and fill in the values from Supabase → Project Settings → API:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...   # server only, never expose
   ```

5. **Create the first admin.**
   ```bash
   npm install
   npm run create-admin -- admin YourStrongPassword "Your Name"
   ```

6. **Run.**
   ```bash
   npm run dev      # http://localhost:3000
   ```
   Sign in as `admin`, then go to **Admin → Users** to add users for each system.

### Deploying (Vercel)
Add the same three env vars in Vercel → Project → Settings → Environment Variables, then deploy.

### Updating the database

`supabase/schema.sql` is safe to re-run. After pulling changes that touch it, run the whole file again in the SQL Editor. Your data is kept.

### Keeping it fast

- **Use asymmetric JWT signing keys.** Supabase → Project Settings → JWT Keys → migrate to the new signing keys. The app checks logins locally with them; on the legacy secret every page load makes an extra call to Supabase Auth.
- **Put Supabase and the app in the same region, close to your users.** For the Philippines, use Singapore (`ap-southeast-1`) for the Supabase project and `sin1` for Vercel functions. Every query crosses this distance.
- **Judge speed in production mode.** `npm run dev` compiles pages on first visit. Use `npm run build && npm start` to see real speed.

---

## Roles

| Role | Access |
|---|---|
| **admin** | Both systems, all data, Admin Console, creates/edits/disables/deletes users. Use the switcher at the top of the sidebar to move between systems. |
| **manager** | Everything in *their* system, including personnel, payroll, reports and deletes. |
| **staff** | Day-to-day records in *their* system: buying/selling, customers, billing, collections, expenses. No payroll, personnel or reports, and no deletes. |

Users sign in with a **username** (no e-mail needed). Internally the username maps to `username@users.ops-suite.local` in Supabase Auth.

---

## Palay & Corn Buying Station (`/grain`)

- **Buying (Purchases):** farmer or walk-in seller, commodity, sacks, gross kg, tare per sack, moisture % with an optional **auto-deduct to 14%** standard, price/kg, other deductions (cash advance, hauling), paid/unpaid. Prints a purchase receipt.
- **Selling (Big Buyers):** deliveries to mills or traders with the buyer's deduction. Each delivery is a **trip**: pick one of your vehicles (or a hired truck), the driver, and the driver's pay for the trip. Supports **partial payments** (receivables) and prints a delivery receipt.
- **Trips & Drivers:** every trip with its vehicle, driver, driver pay, trip expenses (fuel, toll, meals) and hired-truck cost. Totals by driver and by vehicle; filter by either.
- **Vehicles:** plate number, make/model, type, capacity, default driver, and **registration / insurance expiry** with renewal warnings (also shown on the dashboard). Shows trips, kg hauled, expenses and **cost per trip** for each vehicle.
- **Inventory:** stock = bought − sold ± adjustments (drying loss, spoilage, recount), with average cost and stock value.
- **Farmers, Big Buyers, Commodities & Prices:** master lists. Prices move with the market: every purchase and sale keeps its own price per kg, and a new form starts from the **last price used** for that commodity (with today's price range shown). The commodity's reference price is only a fallback.
- **Expenses:** food, fuel, tolls, hauling, kargador/pakyaw labor, drying, sacks, repairs, tires, registration, utilities, etc. An expense can be tagged to a vehicle and/or a trip.
- **Personnel & Payroll:** daily or monthly rate, **overtime/hour**, **food allowance/day**, **pay per trip** (drivers/helpers), other pay, cash advance and other deductions. Entering days worked fills in basic pay and food allowance, and OT hours fills in OT pay. Drivers' **trip pay** for deliveries in the period is added automatically (and can be reloaded with *Load trip pay*). Payroll can be marked paid (locked), and payslips can be printed.
- **Reports:** P&L (sales − cost of grain sold − hired trucking − payroll − expenses), cash movement, and breakdowns by commodity, buyer, farmer and vehicle.

## Internet Billing & Collection (`/isp`)

- **Customers:** account # (auto), plan, monthly fee, due day, area/route, PPPoE/IP, status (active, suspended, disconnected) and a live **balance**. The detail page shows a full ledger with running balance and a printable **statement of account**.
- **Billing:** one click generates the month's bills for all active customers and skips anyone already billed. Supports downtime rebates/discounts, extra charges, installation and other one-off bills.
- **Collections:** record payments (cash, GCash, Maya, bank, check) with reference and collector, and print an acknowledgement receipt. Payments are **applied to the oldest bill first** automatically. Overpayment becomes credit.
- **Notices:** bulk billing statements, payment reminders, **disconnection** and reconnection notices, filtered by balance, overdue or area. Editable templates with `{name} {account} {amount} {due}`. Print them all or export a CSV for SMS blasting.
- **Plans, Expenses, Personnel & Payroll:** same as the buying station (separate data).
- **Reports:** cash-basis income statement, collection efficiency, **receivables aging** (1–30, 31–60, 61–90, 90+ days), by area, and by collector.

---

## Database layout

All tables live in `public` with a prefix per system: `grain_*` and `isp_*`. Payroll, personnel and expenses have the same structure in both systems but are **separate tables** (`grain_payroll_lines` vs `isp_payroll_lines`, etc.).

RLS helpers (in `schema.sql`):
- `has_system('grain' | 'isp')`: user is admin or belongs to that system → read/insert/update.
- `is_system_manager(sys)`: admin or manager of that system → deletes, personnel and payroll.
- `is_admin()`: for profiles.

The money math lives in the database: generated columns for net kg, amounts and net pay; triggers keep `amount_paid` correct on grain sales and ISP bills. The UI can't get those numbers out of sync.

## Project structure

```
src/
  app/
    login/            sign in
    admin/            overview + users (admin only)
    grain/            buying station pages
    isp/              internet billing pages
    api/admin/users/  create/update/delete users (service role, admin-checked)
  components/
    shared/           CrudPage, PayrollPage, ExpensesPage, EmployeesPage (used by both systems)
    grain/  isp/      system-specific pieces
    layout/           AppShell + nav (per-system menus)
    ui/               Button, Modal, inputs, tables, Printable…
  lib/                supabase clients, auth guard, types, formatting
supabase/schema.sql   all tables, views, triggers, RLS
scripts/create-admin.mjs
```
