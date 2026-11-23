-- =============================================================================
-- OpsSuite — one Supabase project, two isolated systems
--
--   grain_*  : Palay / Corn buying station
--   isp_*    : Internet service provider billing & collection
--
-- Isolation model
--   * Every user has a row in public.profiles with a role and a system.
--   * role = 'admin'   → sees and manages BOTH systems and all users.
--   * role = 'manager' → full access to ONE system (incl. employees & payroll).
--   * role = 'staff'   → day-to-day records in ONE system (no payroll, no deletes).
--   * Row Level Security on every table enforces this in the database itself,
--     so a grain user cannot read ISP data even by calling the API directly.
--   * There is no public sign-up. Only the admin creates users
--     (via /admin/users, which uses the service-role key on the server).
--
-- Run this whole file once in Supabase → SQL Editor. It is safe to re-run.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Profiles & access helpers
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text unique not null,
  full_name   text not null,
  role        text not null check (role in ('admin','manager','staff')),
  system      text check (system in ('grain','isp')),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  constraint profiles_system_required check (role = 'admin' or system is not null)
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and active and role = 'admin');
$$;

-- Can the current user work in this system at all?
create or replace function public.has_system(sys text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and active and (role = 'admin' or system = sys)
  );
$$;

-- Is the current user a manager (or admin) of this system?
create or replace function public.is_system_manager(sys text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and active
      and (role = 'admin' or (system = sys and role = 'manager'))
  );
$$;

alter table public.profiles enable row level security;
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (id = (select auth.uid()) or (select public.is_admin()));
-- Writes to profiles happen only through the server (service role) in /api/admin/users.

-- -----------------------------------------------------------------------------
-- Shared shape, created once per system: employees, payroll, expenses
-- -----------------------------------------------------------------------------
do $$
declare sys text;
begin
  foreach sys in array array['grain','isp'] loop
    execute format($f$
      create table if not exists public.%1$s_employees (
        id                     uuid primary key default gen_random_uuid(),
        full_name              text not null,
        position               text,
        phone                  text,
        pay_type               text not null default 'daily' check (pay_type in ('daily','monthly')),
        rate                   numeric(12,2) not null default 0,   -- daily rate or monthly salary
        ot_rate_per_hour       numeric(12,2) not null default 0,
        food_allowance_per_day numeric(12,2) not null default 0,
        hired_on               date,
        active                 boolean not null default true,
        notes                  text,
        created_at             timestamptz not null default now()
      );

      create table if not exists public.%1$s_payroll_periods (
        id            uuid primary key default gen_random_uuid(),
        period_start  date not null,
        period_end    date not null,
        status        text not null default 'draft' check (status in ('draft','paid')),
        paid_on       date,
        notes         text,
        created_by    uuid references auth.users(id) default auth.uid(),
        created_at    timestamptz not null default now(),
        check (period_end >= period_start)
      );

      create table if not exists public.%1$s_payroll_lines (
        id                uuid primary key default gen_random_uuid(),
        period_id         uuid not null references public.%1$s_payroll_periods(id) on delete cascade,
        employee_id       uuid not null references public.%1$s_employees(id) on delete restrict,
        days_worked       numeric(6,2) not null default 0,
        basic_pay         numeric(12,2) not null default 0,
        ot_hours          numeric(6,2) not null default 0,
        ot_pay            numeric(12,2) not null default 0,
        food_allowance    numeric(12,2) not null default 0,
        other_pay         numeric(12,2) not null default 0,  -- bonus, incentives, holiday pay
        cash_advance      numeric(12,2) not null default 0,  -- deducted
        other_deductions  numeric(12,2) not null default 0,  -- SSS, PhilHealth, Pag-IBIG, shortages
        gross_pay         numeric(12,2) generated always as (basic_pay + ot_pay + food_allowance + other_pay) stored,
        net_pay           numeric(12,2) generated always as
                            (basic_pay + ot_pay + food_allowance + other_pay - cash_advance - other_deductions) stored,
        remarks           text,
        unique (period_id, employee_id)
      );

      create table if not exists public.%1$s_expenses (
        id            uuid primary key default gen_random_uuid(),
        expense_date  date not null default current_date,
        category      text not null,
        description   text,
        amount        numeric(12,2) not null check (amount >= 0),
        paid_to       text,
        reference     text,
        created_by    uuid references auth.users(id) default auth.uid(),
        created_at    timestamptz not null default now()
      );
      create index if not exists %1$s_expenses_date_idx on public.%1$s_expenses (expense_date);
    $f$, sys);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- GRAIN: Palay / Corn buying station
-- -----------------------------------------------------------------------------
create table if not exists public.grain_commodities (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,                  -- e.g. "Palay - Dry", "Yellow Corn - Wet"
  kind        text not null check (kind in ('palay','corn','other')),
  buy_price   numeric(10,2) not null default 0,     -- current buying price / kg
  sell_price  numeric(10,2) not null default 0,     -- current selling price / kg
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.grain_farmers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  address     text,
  phone       text,
  notes       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.grain_buyers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  company     text,
  address     text,
  phone       text,
  notes       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create sequence if not exists public.grain_purchase_no_seq;
create table if not exists public.grain_purchases (
  id                     uuid primary key default gen_random_uuid(),
  ref_no                 text not null unique default ('P-' || lpad(nextval('public.grain_purchase_no_seq')::text, 6, '0')),
  purchase_date          date not null default current_date,
  farmer_id              uuid references public.grain_farmers(id) on delete set null,
  seller_name            text not null,           -- snapshot (or walk-in name)
  commodity_id           uuid not null references public.grain_commodities(id),
  sacks                  integer not null default 0,
  gross_kg               numeric(12,2) not null check (gross_kg >= 0),
  tare_kg                numeric(12,2) not null default 0,   -- total sack weight
  moisture_pct           numeric(5,2),
  moisture_deduction_kg  numeric(12,2) not null default 0,
  net_kg                 numeric(12,2) generated always as (gross_kg - tare_kg - moisture_deduction_kg) stored,
  price_per_kg           numeric(10,2) not null,
  amount                 numeric(14,2) generated always as
                           (round((gross_kg - tare_kg - moisture_deduction_kg) * price_per_kg, 2)) stored,
  other_deductions       numeric(12,2) not null default 0,   -- cash advance repayment, hauling, etc.
  net_payable            numeric(14,2) generated always as
                           (round((gross_kg - tare_kg - moisture_deduction_kg) * price_per_kg, 2) - other_deductions) stored,
  payment_status         text not null default 'paid' check (payment_status in ('paid','unpaid')),
  remarks                text,
  created_by             uuid references auth.users(id) default auth.uid(),
  created_at             timestamptz not null default now()
);
create index if not exists grain_purchases_date_idx on public.grain_purchases (purchase_date);

create sequence if not exists public.grain_sale_no_seq;
create table if not exists public.grain_sales (
  id             uuid primary key default gen_random_uuid(),
  ref_no         text not null unique default ('S-' || lpad(nextval('public.grain_sale_no_seq')::text, 6, '0')),
  sale_date      date not null default current_date,
  buyer_id       uuid not null references public.grain_buyers(id),
  commodity_id   uuid not null references public.grain_commodities(id),
  sacks          integer not null default 0,
  gross_kg       numeric(12,2) not null check (gross_kg >= 0),
  tare_kg        numeric(12,2) not null default 0,
  deduction_kg   numeric(12,2) not null default 0,    -- buyer's moisture / quality deduction
  net_kg         numeric(12,2) generated always as (gross_kg - tare_kg - deduction_kg) stored,
  price_per_kg   numeric(10,2) not null,
  amount         numeric(14,2) generated always as
                   (round((gross_kg - tare_kg - deduction_kg) * price_per_kg, 2)) stored,
  hauling_cost   numeric(12,2) not null default 0,    -- trucking cost of this delivery
  truck_plate    text,
  driver         text,
  amount_paid    numeric(14,2) not null default 0,    -- maintained by trigger from grain_sale_payments
  remarks        text,
  created_by     uuid references auth.users(id) default auth.uid(),
  created_at     timestamptz not null default now()
);
create index if not exists grain_sales_date_idx on public.grain_sales (sale_date);

create table if not exists public.grain_sale_payments (
  id          uuid primary key default gen_random_uuid(),
  sale_id     uuid not null references public.grain_sales(id) on delete cascade,
  paid_on     date not null default current_date,
  amount      numeric(14,2) not null check (amount > 0),
  method      text not null default 'cash',
  reference   text,
  created_by  uuid references auth.users(id) default auth.uid(),
  created_at  timestamptz not null default now()
);

create or replace function public.grain_sync_sale_paid()
returns trigger language plpgsql security definer set search_path = public as $$
declare sid uuid := coalesce(new.sale_id, old.sale_id);
begin
  update grain_sales
     set amount_paid = coalesce((select sum(amount) from grain_sale_payments where sale_id = sid), 0)
   where id = sid;
  return null;
end $$;

drop trigger if exists grain_sale_payments_sync on public.grain_sale_payments;
create trigger grain_sale_payments_sync
  after insert or update or delete on public.grain_sale_payments
  for each row execute function public.grain_sync_sale_paid();

-- Drying loss, spoilage, physical count corrections (+ or - kg)
create table if not exists public.grain_stock_adjustments (
  id            uuid primary key default gen_random_uuid(),
  adj_date      date not null default current_date,
  commodity_id  uuid not null references public.grain_commodities(id),
  kg            numeric(12,2) not null,
  reason        text not null,
  created_by    uuid references auth.users(id) default auth.uid(),
  created_at    timestamptz not null default now()
);

create or replace view public.grain_inventory with (security_invoker = true) as
select
  c.id   as commodity_id,
  c.name,
  c.kind,
  c.buy_price,
  c.sell_price,
  coalesce(p.kg, 0)  as purchased_kg,
  coalesce(p.cost, 0) as purchased_cost,
  coalesce(s.kg, 0)  as sold_kg,
  coalesce(a.kg, 0)  as adjusted_kg,
  coalesce(p.kg, 0) - coalesce(s.kg, 0) + coalesce(a.kg, 0) as on_hand_kg,
  case when coalesce(p.kg, 0) > 0 then round(p.cost / p.kg, 2) else 0 end as avg_cost_per_kg
from public.grain_commodities c
left join (select commodity_id, sum(net_kg) kg, sum(amount) cost from public.grain_purchases group by 1) p on p.commodity_id = c.id
left join (select commodity_id, sum(net_kg) kg from public.grain_sales group by 1) s on s.commodity_id = c.id
left join (select commodity_id, sum(kg) kg from public.grain_stock_adjustments group by 1) a on a.commodity_id = c.id;

-- Sales not yet fully paid by the buyer (dashboard receivables).
create or replace view public.grain_sales_open with (security_invoker = true) as
select id, amount, amount_paid
from public.grain_sales
where amount_paid < amount - 0.005;

-- -----------------------------------------------------------------------------
-- ISP: internet billing & collection
-- -----------------------------------------------------------------------------
create table if not exists public.isp_plans (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique,
  speed_mbps   integer,
  monthly_fee  numeric(10,2) not null,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create sequence if not exists public.isp_account_no_seq;
create table if not exists public.isp_customers (
  id              uuid primary key default gen_random_uuid(),
  account_no      text not null unique default ('AC-' || lpad(nextval('public.isp_account_no_seq')::text, 5, '0')),
  full_name       text not null,
  address         text,
  area            text,                  -- barangay / zone / route
  phone           text,
  email           text,
  plan_id         uuid references public.isp_plans(id),
  monthly_fee     numeric(10,2) not null default 0,
  install_date    date,
  billing_day     integer not null default 1 check (billing_day between 1 and 28),
  status          text not null default 'active' check (status in ('active','suspended','disconnected')),
  pppoe_username  text,
  ip_address      text,
  notes           text,
  created_at      timestamptz not null default now()
);

create sequence if not exists public.isp_invoice_no_seq;
create table if not exists public.isp_invoices (
  id             uuid primary key default gen_random_uuid(),
  invoice_no     text not null unique default ('INV-' || lpad(nextval('public.isp_invoice_no_seq')::text, 6, '0')),
  customer_id    uuid not null references public.isp_customers(id) on delete cascade,
  kind           text not null default 'monthly' check (kind in ('monthly','installation','other')),
  period_month   date,                       -- first day of the billed month (monthly bills)
  description    text,
  amount         numeric(12,2) not null default 0,
  other_charges  numeric(12,2) not null default 0,
  discount       numeric(12,2) not null default 0,   -- rebates for downtime, promos
  total          numeric(12,2) generated always as (amount + other_charges - discount) stored,
  amount_paid    numeric(12,2) not null default 0,   -- maintained by isp_reallocate()
  due_date       date not null,
  created_by     uuid references auth.users(id) default auth.uid(),
  created_at     timestamptz not null default now()
);
create unique index if not exists isp_invoices_one_monthly
  on public.isp_invoices (customer_id, period_month) where kind = 'monthly';
create index if not exists isp_invoices_due_idx on public.isp_invoices (due_date);

create sequence if not exists public.isp_receipt_no_seq;
create table if not exists public.isp_payments (
  id           uuid primary key default gen_random_uuid(),
  receipt_no   text not null unique default ('OR-' || lpad(nextval('public.isp_receipt_no_seq')::text, 6, '0')),
  customer_id  uuid not null references public.isp_customers(id) on delete cascade,
  paid_on      date not null default current_date,
  amount       numeric(12,2) not null check (amount > 0),
  method       text not null default 'cash',
  reference    text,
  collector    text,
  notes        text,
  created_by   uuid references auth.users(id) default auth.uid(),
  created_at   timestamptz not null default now()
);
create index if not exists isp_payments_date_idx on public.isp_payments (paid_on);

create table if not exists public.isp_notices (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.isp_customers(id) on delete cascade,
  notice_type  text not null check (notice_type in ('billing','reminder','disconnection','reconnection','general')),
  issued_on    date not null default current_date,
  due_date     date,
  amount_due   numeric(12,2) not null default 0,
  message      text not null,
  created_by   uuid references auth.users(id) default auth.uid(),
  created_at   timestamptz not null default now()
);

-- Apply all of a customer's payments to their bills, oldest bill first.
-- Called automatically whenever payments or bill amounts change, so
-- amount_paid on every invoice is always consistent. Overpayment = credit.
create or replace function public.isp_reallocate(cust uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  remaining numeric := coalesce((select sum(amount) from isp_payments where customer_id = cust), 0);
  inv record;
  pay numeric;
begin
  for inv in
    select id, total from isp_invoices
    where customer_id = cust
    order by due_date, created_at
  loop
    pay := greatest(least(inv.total, remaining), 0);
    remaining := remaining - pay;
    update isp_invoices set amount_paid = pay where id = inv.id and amount_paid is distinct from pay;
  end loop;
end $$;

create or replace function public.isp_reallocate_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('UPDATE','DELETE') then perform isp_reallocate(old.customer_id); end if;
  if tg_op in ('INSERT','UPDATE') and (tg_op = 'INSERT' or new.customer_id <> old.customer_id) then
    perform isp_reallocate(new.customer_id);
  end if;
  return null;
end $$;

drop trigger if exists isp_payments_realloc on public.isp_payments;
create trigger isp_payments_realloc
  after insert or delete or update of amount, customer_id on public.isp_payments
  for each row execute function public.isp_reallocate_trigger();

drop trigger if exists isp_invoices_realloc on public.isp_invoices;
create trigger isp_invoices_realloc
  after insert or delete or update of amount, other_charges, discount, due_date, customer_id on public.isp_invoices
  for each row execute function public.isp_reallocate_trigger();

create or replace view public.isp_customer_balances with (security_invoker = true) as
select
  c.id as customer_id,
  coalesce(i.billed, 0) as total_billed,
  coalesce(p.paid, 0)   as total_paid,
  coalesce(i.billed, 0) - coalesce(p.paid, 0) as balance,
  coalesce(i.overdue, 0) as overdue,
  i.oldest_unpaid_due,
  p.last_paid_on
from public.isp_customers c
left join (
  select customer_id,
         sum(total) billed,
         sum(case when due_date < current_date then total - amount_paid else 0 end) overdue,
         min(case when amount_paid < total then due_date end) oldest_unpaid_due
  from public.isp_invoices group by 1
) i on i.customer_id = c.id
left join (
  select customer_id, sum(amount) paid, max(paid_on) last_paid_on
  from public.isp_payments group by 1
) p on p.customer_id = c.id;

-- Bill every active customer for a month. Skips anyone already billed for it.
create or replace function public.isp_generate_monthly_bills(p_month date, p_due_day integer default null)
returns integer language plpgsql security invoker set search_path = public as $$
declare
  m date := date_trunc('month', p_month)::date;
  n integer;
begin
  if not public.has_system('isp') then
    raise exception 'not allowed';
  end if;
  insert into isp_invoices (customer_id, kind, period_month, description, amount, due_date)
  select c.id, 'monthly', m,
         'Internet service ' || to_char(m, 'Mon YYYY'),
         c.monthly_fee,
         m + (coalesce(p_due_day, c.billing_day) - 1)
  from isp_customers c
  where c.status = 'active'
    and c.monthly_fee > 0
    and not exists (
      select 1 from isp_invoices i
      where i.customer_id = c.id and i.kind = 'monthly' and i.period_month = m
    );
  get diagnostics n = row_count;
  return n;
end $$;

-- -----------------------------------------------------------------------------
-- Row Level Security for every system table
--   read / add / edit : anyone in that system (or admin)
--   delete            : managers of that system (or admin)
--   employees/payroll : managers of that system (or admin) only
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
  sys text;
  mgr_only boolean;
begin
  for t in
    select tablename from pg_tables
    where schemaname = 'public' and (tablename like 'grain\_%' or tablename like 'isp\_%')
  loop
    sys := split_part(t, '_', 1);
    mgr_only := t like '%\_employees' or t like '%\_payroll\_%';

    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists sys_select on public.%I', t);
    execute format('drop policy if exists sys_insert on public.%I', t);
    execute format('drop policy if exists sys_update on public.%I', t);
    execute format('drop policy if exists sys_delete on public.%I', t);

    if mgr_only then
      execute format('create policy sys_select on public.%I for select using ((select public.is_system_manager(%L)))', t, sys);
      execute format('create policy sys_insert on public.%I for insert with check ((select public.is_system_manager(%L)))', t, sys);
      execute format('create policy sys_update on public.%I for update using ((select public.is_system_manager(%L))) with check ((select public.is_system_manager(%L)))', t, sys, sys);
    else
      execute format('create policy sys_select on public.%I for select using ((select public.has_system(%L)))', t, sys);
      execute format('create policy sys_insert on public.%I for insert with check ((select public.has_system(%L)))', t, sys);
      execute format('create policy sys_update on public.%I for update using ((select public.has_system(%L))) with check ((select public.has_system(%L)))', t, sys, sys);
    end if;
    execute format('create policy sys_delete on public.%I for delete using ((select public.is_system_manager(%L)))', t, sys);
  end loop;
end $$;

-- Indexes on foreign keys / lookup columns (joins, triggers, per-customer ledgers).
create index if not exists grain_purchases_farmer_idx     on public.grain_purchases (farmer_id);
create index if not exists grain_purchases_commodity_idx  on public.grain_purchases (commodity_id);
create index if not exists grain_sales_buyer_idx          on public.grain_sales (buyer_id);
create index if not exists grain_sales_commodity_idx      on public.grain_sales (commodity_id);
create index if not exists grain_sale_payments_sale_idx   on public.grain_sale_payments (sale_id);
create index if not exists grain_stock_adj_commodity_idx  on public.grain_stock_adjustments (commodity_id);
create index if not exists grain_payroll_lines_emp_idx    on public.grain_payroll_lines (employee_id);
create index if not exists isp_payroll_lines_emp_idx      on public.isp_payroll_lines (employee_id);
create index if not exists isp_customers_plan_idx         on public.isp_customers (plan_id);
create index if not exists isp_invoices_customer_idx      on public.isp_invoices (customer_id, due_date);
create index if not exists isp_payments_customer_idx      on public.isp_payments (customer_id);
create index if not exists isp_notices_customer_idx       on public.isp_notices (customer_id);

-- Table privileges. Newer Supabase projects don't auto-grant API roles access to
-- new tables, so grant explicitly. RLS policies above still decide which rows.
grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke insert, update, delete on public.profiles from authenticated;  -- profiles: server only
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on function public.is_admin(), public.has_system(text), public.is_system_manager(text)
  to authenticated, service_role;

-- Sequences used by default values must be usable by signed-in users.
grant usage, select on all sequences in schema public to authenticated;
grant execute on function public.isp_generate_monthly_bills(date, integer) to authenticated;
revoke execute on function public.isp_reallocate(uuid) from public, anon;

-- -----------------------------------------------------------------------------
-- Starter data (only inserted if empty)
-- -----------------------------------------------------------------------------
insert into public.grain_commodities (name, kind, buy_price, sell_price)
select * from (values
  ('Palay - Dry', 'palay', 22.00, 24.00),
  ('Palay - Wet', 'palay', 17.00, 19.00),
  ('Yellow Corn - Dry', 'corn', 16.00, 18.00),
  ('Yellow Corn - Wet', 'corn', 12.00, 14.00)
) v(name, kind, buy_price, sell_price)
where not exists (select 1 from public.grain_commodities);

insert into public.isp_plans (name, speed_mbps, monthly_fee)
select * from (values
  ('Basic 10 Mbps', 10, 699.00),
  ('Standard 25 Mbps', 25, 999.00),
  ('Premium 50 Mbps', 50, 1499.00)
) v(name, speed_mbps, monthly_fee)
where not exists (select 1 from public.isp_plans);
