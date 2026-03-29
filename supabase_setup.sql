-- ============================================================
-- KC SARSWAT ERP v3.0 — SUPABASE COMPLETE SETUP SCRIPT
-- Run this ENTIRE file in Supabase → SQL Editor → New Query
-- Project: xgchjtiiwqraolnrnxxg.supabase.co
-- ============================================================

-- ============================================================
-- STEP 1: ENABLE UUID EXTENSION
-- ============================================================
create extension if not exists "uuid-ossp";

-- ============================================================
-- STEP 2: CREATE ALL TABLES
-- ============================================================

-- TABLE: sales (mirror of Firebase 'sales' collection)
create table if not exists sales (
  id              uuid default uuid_generate_v4() primary key,
  firebase_id     text unique,
  date            text,
  shift           text,
  staff_name      text,
  staff_id        text,
  cash_deposited  numeric default 0,
  expected_cash   numeric default 0,
  cash_diff       numeric default 0,
  phone_pe_sales  numeric default 0,
  paytm_sales     numeric default 0,
  total_fuel_revenue numeric default 0,
  fuel_margin     numeric default 0,
  has_discrepancy boolean default false,
  auto_transfer_used boolean default false,
  readings        jsonb,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- TABLE: supply (tanker deliveries)
create table if not exists supply (
  id          uuid default uuid_generate_v4() primary key,
  firebase_id text unique,
  date        text,
  unit        text,
  fuel_type   text,
  litres      numeric default 0,
  truck       text,
  supplier    text,
  saved_by    text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- TABLE: lubricants (lube sales with GST)
create table if not exists lubricants (
  id            uuid default uuid_generate_v4() primary key,
  firebase_id   text unique,
  date          text,
  unit          text,
  product       text,
  qty           numeric default 0,
  price         numeric default 0,
  cost_price    numeric default 0,
  revenue       numeric default 0,
  cogs          numeric default 0,
  gross_profit  numeric default 0,
  cgst          numeric default 0,
  sgst          numeric default 0,
  total_with_gst numeric default 0,
  hsn           text default '3811',
  staff_name    text,
  staff_id      text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- TABLE: expenses (daily OPEX)
create table if not exists expenses (
  id          uuid default uuid_generate_v4() primary key,
  firebase_id text unique,
  date        text,
  category    text,
  amount      numeric default 0,
  note        text,
  paid_by     text default 'Cash',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- TABLE: transport (truck trips P&L)
create table if not exists transport (
  id            uuid default uuid_generate_v4() primary key,
  firebase_id   text unique,
  date          text,
  truck         text,
  km            numeric default 0,
  rate          numeric default 0,
  driver_pay    numeric default 0,
  diesel        numeric default 0,
  loading_cost  numeric default 0,
  note          text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- TABLE: staff (employee records)
create table if not exists staff (
  id          uuid default uuid_generate_v4() primary key,
  firebase_id text unique,
  name        text,
  role        text,
  salary      numeric default 0,
  joining     text,
  unit        text,
  active      boolean default true,
  email       text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ============================================================
-- MODULE 3: KHATA / CREDIT LEDGER TABLES
-- ============================================================

-- TABLE: khata_customers
create table if not exists khata_customers (
  id                  uuid default uuid_generate_v4() primary key,
  firebase_id         text unique,
  name                text not null,
  vehicle_numbers     text[],
  phone               text,
  credit_limit        numeric default 50000,
  outstanding_balance numeric default 0,
  last_payment        text,
  last_payment_amt    numeric default 0,
  created_by          text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- TABLE: khata_txns (credit sales & payments)
create table if not exists khata_txns (
  id               uuid default uuid_generate_v4() primary key,
  firebase_id      text unique,
  customer_id      text,
  customer_name    text,
  date             text,
  shift            text,
  type             text check (type in ('credit_sale','payment')),
  fuel_type        text,
  litres           numeric default 0,
  rate_per_litre   numeric default 0,
  amount           numeric default 0,
  vehicle_number   text,
  running_balance  numeric default 0,
  staff_id         text,
  staff_name       text,
  unit             text,
  created_at       timestamptz default now()
);

-- ============================================================
-- MODULE 4: GST BILLING TABLE
-- ============================================================

-- TABLE: gst_invoices
create table if not exists gst_invoices (
  id              uuid default uuid_generate_v4() primary key,
  firebase_id     text unique,
  invoice_id      text unique,
  invoice_number  integer,
  bill_type       text check (bill_type in ('Tax Invoice','Bill of Supply')),
  product         text,
  hsn             text,
  qty             numeric default 0,
  rate_per_unit   numeric default 0,
  base_amount     numeric default 0,
  cgst            numeric default 0,
  sgst            numeric default 0,
  gst_rate        numeric default 18,
  total_amount    numeric default 0,
  customer_name   text,
  customer_gstin  text,
  gstin           text,
  station_name    text,
  date            text,
  note            text,
  created_at      timestamptz default now()
);

-- ============================================================
-- MODULE 2: FRAUD & SHRINKAGE DETECTION TABLES
-- ============================================================

-- TABLE: dip_readings (physical dip vs system stock)
create table if not exists dip_readings (
  id              uuid default uuid_generate_v4() primary key,
  firebase_id     text unique,
  date            text,
  unit            text,
  fuel_type       text,
  physical_dip    numeric default 0,
  temperature     numeric default 32,
  vcf             numeric default 1,
  vcf_adjusted    numeric default 0,
  system_stock    numeric default 0,
  variance        numeric default 0,
  variance_pct    numeric default 0,
  flagged         boolean default false,
  created_at      timestamptz default now()
);

-- TABLE: cash_integrity_log (per-shift integrity scores)
create table if not exists cash_integrity_log (
  id              uuid default uuid_generate_v4() primary key,
  firebase_id     text,
  staff_id        text,
  staff_name      text,
  date            text,
  shift           text,
  expected_cash   numeric default 0,
  actual_cash     numeric default 0,
  cash_diff       numeric default 0,
  integrity_score numeric default 100,
  created_at      timestamptz default now()
);

-- TABLE: audit_trail (immutable — NEVER delete rows)
create table if not exists audit_trail (
  id            uuid default uuid_generate_v4() primary key,
  action        text not null,
  table_name    text,
  record_data   text,
  performed_by  text,
  ts            text,
  created_at    timestamptz default now()
);

-- ============================================================
-- MODULE 9: FUTURE-PROOF TABLES (create now, use later)
-- ============================================================

-- TABLE: loyalty_points (future fleet loyalty program)
create table if not exists loyalty_points (
  id           uuid default uuid_generate_v4() primary key,
  customer_id  text,
  vehicle_no   text,
  points       numeric default 0,
  total_spend  numeric default 0,
  last_visit   text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- TABLE: ev_charging (future EV bays — OCPP 1.6 compatible)
create table if not exists ev_charging (
  id             uuid default uuid_generate_v4() primary key,
  session_id     text unique,
  connector_id   text,
  kwh_dispensed  numeric default 0,
  duration_mins  integer default 0,
  amount         numeric default 0,
  vehicle_no     text,
  started_at     timestamptz,
  ended_at       timestamptz,
  created_at     timestamptz default now()
);

-- TABLE: rfid_authorizations (fleet RFID/ANPR credit)
create table if not exists rfid_authorizations (
  id           uuid default uuid_generate_v4() primary key,
  rfid_token   text unique,
  vehicle_no   text,
  customer_id  text,
  credit_limit numeric default 0,
  status       text default 'active' check (status in ('active','blocked','suspended')),
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- TABLE: settings_log (settings change history)
create table if not exists settings_log (
  id         uuid default uuid_generate_v4() primary key,
  petrol_price numeric,
  diesel_price numeric,
  monthly_opex numeric,
  station_gstin text,
  tanks      jsonb,
  saved_at   text,
  created_at timestamptz default now()
);

-- ============================================================
-- STEP 3: CREATE INDEXES (for query performance)
-- ============================================================
create index if not exists idx_sales_date        on sales(date);
create index if not exists idx_sales_staff        on sales(staff_id);
create index if not exists idx_sales_firebase     on sales(firebase_id);
create index if not exists idx_supply_date        on supply(date);
create index if not exists idx_lubricants_date    on lubricants(date);
create index if not exists idx_expenses_date      on expenses(date);
create index if not exists idx_transport_date     on transport(date);
create index if not exists idx_khata_customer     on khata_txns(customer_id);
create index if not exists idx_khata_date         on khata_txns(date);
create index if not exists idx_dip_date           on dip_readings(date);
create index if not exists idx_integrity_staff    on cash_integrity_log(staff_id);
create index if not exists idx_integrity_date     on cash_integrity_log(date);
create index if not exists idx_audit_action       on audit_trail(action);
create index if not exists idx_audit_created      on audit_trail(created_at desc);
create index if not exists idx_gst_invoice_num    on gst_invoices(invoice_number desc);
create index if not exists idx_gst_date           on gst_invoices(date);

-- ============================================================
-- STEP 4: DISABLE ROW LEVEL SECURITY (development mode)
-- Enable + add policies before going to production
-- ============================================================
alter table sales                disable row level security;
alter table supply               disable row level security;
alter table lubricants           disable row level security;
alter table expenses             disable row level security;
alter table transport            disable row level security;
alter table staff                disable row level security;
alter table khata_customers      disable row level security;
alter table khata_txns           disable row level security;
alter table gst_invoices         disable row level security;
alter table dip_readings         disable row level security;
alter table cash_integrity_log   disable row level security;
alter table audit_trail          disable row level security;
alter table loyalty_points       disable row level security;
alter table ev_charging          disable row level security;
alter table rfid_authorizations  disable row level security;
alter table settings_log         disable row level security;

-- ============================================================
-- STEP 5: USEFUL VIEWS (for quick reporting)
-- ============================================================

-- View: monthly P&L summary
create or replace view monthly_pl as
select
  substring(date, 1, 7)                         as month,
  sum(total_fuel_revenue)                        as fuel_revenue,
  sum(fuel_margin)                               as fuel_margin,
  count(*)                                       as shift_count,
  sum(case when has_discrepancy then 1 else 0 end) as discrepancy_count,
  sum(abs(cash_diff))                            as total_cash_variance
from sales
group by substring(date, 1, 7)
order by month desc;

-- View: staff integrity summary
create or replace view staff_integrity_summary as
select
  staff_id,
  staff_name,
  count(*)                                as total_shifts,
  round(avg(integrity_score)::numeric, 2) as avg_integrity_score,
  sum(cash_diff)                          as total_cash_diff,
  count(case when cash_diff = 0 then 1 end) as zero_error_shifts
from cash_integrity_log
group by staff_id, staff_name
order by avg_integrity_score desc;

-- View: lubricant GST summary by month
create or replace view gst_monthly_summary as
select
  substring(date, 1, 7) as month,
  sum(base_amount)       as total_base,
  sum(cgst)              as total_cgst,
  sum(sgst)              as total_sgst,
  sum(total_amount)      as total_with_gst,
  count(*)               as invoice_count
from gst_invoices
where bill_type = 'Tax Invoice'
group by substring(date, 1, 7)
order by month desc;

-- View: outstanding khata balances
create or replace view khata_outstanding as
select
  firebase_id,
  name,
  phone,
  credit_limit,
  outstanding_balance,
  round((outstanding_balance / nullif(credit_limit, 0) * 100)::numeric, 1) as utilization_pct,
  case
    when outstanding_balance / nullif(credit_limit, 0) > 0.8 then 'HIGH'
    when outstanding_balance / nullif(credit_limit, 0) > 0.5 then 'MEDIUM'
    else 'LOW'
  end as risk_level
from khata_customers
where outstanding_balance > 0
order by outstanding_balance desc;

-- View: fraud alerts (last 30 days)
create or replace view recent_fraud_alerts as
select
  id,
  action,
  table_name,
  performed_by,
  ts,
  created_at
from audit_trail
where action = 'FRAUD_ALERT'
  and created_at > now() - interval '30 days'
order by created_at desc;

-- ============================================================
-- STEP 6: VERIFY EVERYTHING WAS CREATED
-- ============================================================
select
  table_name,
  'TABLE' as object_type
from information_schema.tables
where table_schema = 'public'
  and table_type = 'BASE TABLE'
  and table_name in (
    'sales','supply','lubricants','expenses','transport','staff',
    'khata_customers','khata_txns','gst_invoices','dip_readings',
    'cash_integrity_log','audit_trail','loyalty_points',
    'ev_charging','rfid_authorizations','settings_log'
  )

union all

select
  table_name,
  'VIEW' as object_type
from information_schema.views
where table_schema = 'public'
  and table_name in (
    'monthly_pl','staff_integrity_summary',
    'gst_monthly_summary','khata_outstanding','recent_fraud_alerts'
  )

order by object_type, table_name;

-- ============================================================
-- DONE! You should see 16 TABLES + 5 VIEWS in the result.
-- ============================================================
