-- =====================================================================
-- Polyhouse OS - MySQL schema
-- Every business table carries org_id (one row in `organizations` per
-- customer = tenant). Super admin users have org_id = NULL.
-- Run with:  npm run migrate   (src/migrate.js executes this file)
-- =====================================================================

CREATE TABLE IF NOT EXISTS organizations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,                 -- display name, e.g. "XYZ Polyhouse"
  company_name VARCHAR(200),
  customer_type VARCHAR(40) NOT NULL DEFAULT 'single_polyhouse',
  owner_name VARCHAR(150),
  phone VARCHAR(30),
  email VARCHAR(150),
  address VARCHAR(300),
  district VARCHAR(100),
  state VARCHAR(100),
  gstin VARCHAR(30),
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- active | suspended
  plan VARCHAR(40) DEFAULT 'standard',
  settings JSON,                               -- modules toggles, thresholds, sale frequency ...
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  org_id INT NULL,
  name VARCHAR(150) NOT NULL,
  login VARCHAR(150) NOT NULL UNIQUE,          -- phone number or email
  password_hash VARCHAR(200) NOT NULL,
  role VARCHAR(20) NOT NULL,                   -- superadmin|admin|manager|supervisor|delivery|labour|vendor
  worker_id INT NULL,                          -- for role=labour
  party_id INT NULL,                           -- for role=vendor
  active TINYINT(1) NOT NULL DEFAULT 1,
  last_login DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (org_id)
);

-- Farm / site: a polyhouse, net house, open field or nursery. A farmer with
-- land at different places or an FPO simply has many rows here.
CREATE TABLE IF NOT EXISTS farms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  org_id INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  type VARCHAR(30) NOT NULL DEFAULT 'polyhouse',
  member_name VARCHAR(150),                    -- FPO member / land owner
  location VARCHAR(200),
  district VARCHAR(100),
  area_acres DECIMAL(10,3) DEFAULT 0,
  length_m DECIMAL(10,2),
  width_m DECIMAL(10,2),
  height_m DECIMAL(10,2),
  ownership VARCHAR(20) DEFAULT 'owned',       -- owned | leased
  monthly_rent DECIMAL(12,2) DEFAULT 0,
  lease_end DATE NULL,
  structure_date DATE NULL,
  polyfilm_date DATE NULL,
  water_source VARCHAR(100),
  power_connection VARCHAR(100),
  notes TEXT,
  active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (org_id)
);

CREATE TABLE IF NOT EXISTS bays (
  id INT AUTO_INCREMENT PRIMARY KEY,
  org_id INT NOT NULL,
  farm_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  area_sqm DECIMAL(10,2) DEFAULT 0,
  notes VARCHAR(300),
  INDEX (org_id)
);

CREATE TABLE IF NOT EXISTS crops (
  id INT AUTO_INCREMENT PRIMARY KEY,
  org_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  variety VARCHAR(100),
  unit VARCHAR(20) DEFAULT 'kg',
  color VARCHAR(20) DEFAULT '#16a34a',
  default_price DECIMAL(10,2) DEFAULT 0,
  target_yield_per_sqm DECIMAL(10,2),
  active TINYINT(1) DEFAULT 1,
  INDEX (org_id)
);

CREATE TABLE IF NOT EXISTS crop_cycles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  org_id INT NOT NULL,
  farm_id INT NOT NULL,
  bay_id INT NULL,
  crop_id INT NOT NULL,
  name VARCHAR(150),
  seed_lot VARCHAR(100),
  nursery_date DATE NULL,
  transplant_date DATE NULL,
  plants INT,
  area_sqm DECIMAL(10,2),
  harvest_start DATE NULL,
  harvest_end DATE NULL,
  target_yield_kg DECIMAL(12,2),
  budget DECIMAL(12,2),
  status VARCHAR(20) DEFAULT 'growing',        -- planned|growing|harvesting|closed
  notes TEXT,
  INDEX (org_id)
);

-- Parties = vendors. Buyers (who buy produce) and suppliers (who sell inputs).
CREATE TABLE IF NOT EXISTS parties (
  id INT AUTO_INCREMENT PRIMARY KEY,
  org_id INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'buyer',   -- buyer | supplier | both
  buyer_kind VARCHAR(40),
  contact_person VARCHAR(150),
  phone VARCHAR(30),
  email VARCHAR(150),
  address VARCHAR(300),
  gstin VARCHAR(30),
  credit_days INT DEFAULT 0,
  opening_balance DECIMAL(12,2) DEFAULT 0,     -- buyer owes us (+)
  notes VARCHAR(500),
  active TINYINT(1) DEFAULT 1,
  INDEX (org_id)
);

-- Vendor-specific selling price per crop & grade (admin input)
CREATE TABLE IF NOT EXISTS price_list (
  id INT AUTO_INCREMENT PRIMARY KEY,
  org_id INT NOT NULL,
  party_id INT NOT NULL,
  crop_id INT NOT NULL,
  grade VARCHAR(10) DEFAULT 'A',
  price DECIMAL(10,2) NOT NULL,
  effective_from DATE NOT NULL,
  INDEX (org_id), INDEX (party_id, crop_id)
);

CREATE TABLE IF NOT EXISTS harvests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  org_id INT NOT NULL,
  date DATE NOT NULL,
  farm_id INT NULL,
  bay_id INT NULL,
  crop_cycle_id INT NULL,
  crop_id INT NOT NULL,
  grade VARCHAR(10) DEFAULT 'A',
  quantity DECIMAL(12,2) NOT NULL,
  culls DECIMAL(12,2) DEFAULT 0,
  worker_id INT NULL,
  notes VARCHAR(300),
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (org_id, date)
);

-- Orders placed by buyers (from vendor login or entered by owner)
CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  org_id INT NOT NULL,
  date DATE NOT NULL,
  party_id INT NOT NULL,
  crop_id INT NOT NULL,
  grade VARCHAR(10) DEFAULT 'A',
  quantity DECIMAL(12,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'open',           -- open | fulfilled | cancelled
  notes VARCHAR(300),
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (org_id, date)
);

-- A sale / delivery to a vendor. amount = (quantity - rejected_qty) * rate
CREATE TABLE IF NOT EXISTS sales (
  id INT AUTO_INCREMENT PRIMARY KEY,
  org_id INT NOT NULL,
  date DATE NOT NULL,
  party_id INT NOT NULL,
  crop_id INT NOT NULL,
  grade VARCHAR(10) DEFAULT 'A',
  farm_id INT NULL,
  order_id INT NULL,
  quantity DECIMAL(12,2) NOT NULL,
  rejected_qty DECIMAL(12,2) DEFAULT 0,
  rate DECIMAL(10,2) NOT NULL DEFAULT 0,
  amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  invoice_no VARCHAR(50),
  status VARCHAR(20) DEFAULT 'delivered',      -- delivered | accepted | disputed
  vendor_note VARCHAR(300),
  notes VARCHAR(300),
  delivered_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (org_id, date), INDEX (party_id)
);

CREATE TABLE IF NOT EXISTS payments_received (
  id INT AUTO_INCREMENT PRIMARY KEY,
  org_id INT NOT NULL,
  date DATE NOT NULL,
  party_id INT NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  mode VARCHAR(20) DEFAULT 'cash',
  reference VARCHAR(100),
  notes VARCHAR(300),
  INDEX (org_id, date)
);

CREATE TABLE IF NOT EXISTS other_income (
  id INT AUTO_INCREMENT PRIMARY KEY,
  org_id INT NOT NULL,
  date DATE NOT NULL,
  source VARCHAR(150) NOT NULL,                -- subsidy, scrap sale, nursery plants ...
  farm_id INT NULL,
  amount DECIMAL(14,2) NOT NULL,
  notes VARCHAR(300),
  INDEX (org_id, date)
);

CREATE TABLE IF NOT EXISTS expense_categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  org_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  kind VARCHAR(30) DEFAULT 'other',            -- input|labour|rent|utility|transport|packaging|repair|interest|other
  INDEX (org_id)
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  org_id INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  category_id INT NULL,
  unit VARCHAR(20) DEFAULT 'nos',
  opening_stock DECIMAL(12,2) DEFAULT 0,
  reorder_level DECIMAL(12,2) DEFAULT 0,
  INDEX (org_id)
);

-- Every purchase / payment. farm_id NULL = shared cost, crop_cycle_id = direct cost
CREATE TABLE IF NOT EXISTS expenses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  org_id INT NOT NULL,
  date DATE NOT NULL,
  category_id INT NOT NULL,
  description VARCHAR(250),
  farm_id INT NULL,
  crop_cycle_id INT NULL,
  party_id INT NULL,
  item_id INT NULL,
  quantity DECIMAL(12,2),
  rate DECIMAL(12,2),
  amount DECIMAL(14,2) NOT NULL,
  paid_amount DECIMAL(14,2) NULL,              -- NULL = fully paid
  payment_mode VARCHAR(20) DEFAULT 'cash',
  bill_no VARCHAR(60),
  bill_file VARCHAR(255),
  recurring_id INT NULL,
  wage_payment_id INT NULL,
  loan_repayment_id INT NULL,
  notes VARCHAR(300),
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (org_id, date)
);

CREATE TABLE IF NOT EXISTS stock_moves (
  id INT AUTO_INCREMENT PRIMARY KEY,
  org_id INT NOT NULL,
  item_id INT NOT NULL,
  date DATE NOT NULL,
  type VARCHAR(10) NOT NULL,                   -- in | out | adjust
  quantity DECIMAL(12,2) NOT NULL,
  rate DECIMAL(12,2),
  farm_id INT NULL,
  crop_cycle_id INT NULL,
  expense_id INT NULL,
  notes VARCHAR(300),
  INDEX (org_id), INDEX (item_id)
);

CREATE TABLE IF NOT EXISTS recurring_expenses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  org_id INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  category_id INT NOT NULL,
  farm_id INT NULL,
  party_id INT NULL,
  amount DECIMAL(14,2) NOT NULL,
  frequency VARCHAR(20) DEFAULT 'monthly',     -- weekly | monthly | quarterly | yearly
  next_due DATE NOT NULL,
  auto_post TINYINT(1) DEFAULT 1,
  active TINYINT(1) DEFAULT 1,
  INDEX (org_id)
);

CREATE TABLE IF NOT EXISTS workers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  org_id INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(30),
  skill VARCHAR(40) DEFAULT 'helper',
  farm_id INT NULL,
  pay_type VARCHAR(20) DEFAULT 'daily',        -- daily | monthly | piece
  daily_wage DECIMAL(10,2) DEFAULT 0,
  monthly_salary DECIMAL(12,2) DEFAULT 0,
  piece_rate DECIMAL(10,2) DEFAULT 0,          -- per kg harvested
  joining_date DATE NULL,
  active TINYINT(1) DEFAULT 1,
  INDEX (org_id)
);

CREATE TABLE IF NOT EXISTS attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  org_id INT NOT NULL,
  worker_id INT NOT NULL,
  date DATE NOT NULL,
  status VARCHAR(10) NOT NULL DEFAULT 'present', -- present | half | absent | leave
  check_in TIME NULL,
  check_out TIME NULL,
  farm_id INT NULL,
  task VARCHAR(150),
  overtime_hours DECIMAL(5,2) DEFAULT 0,
  UNIQUE KEY uq_att (worker_id, date),
  INDEX (org_id, date)
);

CREATE TABLE IF NOT EXISTS advances (
  id INT AUTO_INCREMENT PRIMARY KEY,
  org_id INT NOT NULL,
  worker_id INT NOT NULL,
  date DATE NOT NULL,
  type VARCHAR(20) DEFAULT 'advance',          -- advance | bonus | deduction
  amount DECIMAL(12,2) NOT NULL,
  notes VARCHAR(300),
  INDEX (org_id)
);

CREATE TABLE IF NOT EXISTS wage_payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  org_id INT NOT NULL,
  worker_id INT NOT NULL,
  date DATE NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  days_worked DECIMAL(6,2) DEFAULT 0,
  gross DECIMAL(12,2) NOT NULL,
  bonus DECIMAL(12,2) DEFAULT 0,
  deductions DECIMAL(12,2) DEFAULT 0,          -- advances recovered + deductions
  net_paid DECIMAL(12,2) NOT NULL,
  mode VARCHAR(20) DEFAULT 'cash',
  notes VARCHAR(300),
  INDEX (org_id)
);

CREATE TABLE IF NOT EXISTS tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  org_id INT NOT NULL,
  date DATE NOT NULL,
  farm_id INT NULL,
  bay_id INT NULL,
  title VARCHAR(200) NOT NULL,
  task_type VARCHAR(30) DEFAULT 'other',
  worker_id INT NULL,
  status VARCHAR(20) DEFAULT 'todo',           -- todo | done
  notes VARCHAR(300),
  INDEX (org_id, date)
);

CREATE TABLE IF NOT EXISTS fertigation_recipes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  org_id INT NOT NULL,
  crop_id INT NOT NULL,
  stage VARCHAR(60) NOT NULL,
  ec_min DECIMAL(5,2), ec_max DECIMAL(5,2),
  ph_min DECIMAL(4,2), ph_max DECIMAL(4,2),
  recipe TEXT,
  INDEX (org_id)
);

CREATE TABLE IF NOT EXISTS fertigation_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  org_id INT NOT NULL,
  date DATE NOT NULL,
  farm_id INT NOT NULL,
  bay_id INT NULL,
  crop_cycle_id INT NULL,
  feed_ec DECIMAL(5,2), feed_ph DECIMAL(4,2),
  drain_ec DECIMAL(5,2), drain_ph DECIMAL(4,2),
  water_litres DECIMAL(10,2),
  notes VARCHAR(300),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (org_id, date)
);

CREATE TABLE IF NOT EXISTS climate_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  org_id INT NOT NULL,
  date DATE NOT NULL,
  time TIME NULL,
  farm_id INT NOT NULL,
  temperature DECIMAL(5,2),
  humidity DECIMAL(5,2),
  notes VARCHAR(300),
  INDEX (org_id, date)
);

CREATE TABLE IF NOT EXISTS scouting_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  org_id INT NOT NULL,
  date DATE NOT NULL,
  farm_id INT NOT NULL,
  bay_id INT NULL,
  pest VARCHAR(100),
  trap_count INT DEFAULT 0,
  severity VARCHAR(10) DEFAULT 'low',          -- low | medium | high
  notes VARCHAR(300),
  INDEX (org_id, date)
);

CREATE TABLE IF NOT EXISTS spray_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  org_id INT NOT NULL,
  date DATE NOT NULL,
  farm_id INT NOT NULL,
  bay_id INT NULL,
  product VARCHAR(150) NOT NULL,
  dose VARCHAR(60),
  target_pest VARCHAR(100),
  phi_days INT DEFAULT 0,                      -- pre-harvest interval -> harvest lock
  worker_id INT NULL,
  notes VARCHAR(300),
  INDEX (org_id, date)
);

CREATE TABLE IF NOT EXISTS assets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  org_id INT NOT NULL,
  farm_id INT NULL,
  name VARCHAR(150) NOT NULL,
  type VARCHAR(30) DEFAULT 'other',
  purchase_date DATE NOT NULL,
  cost DECIMAL(14,2) NOT NULL,
  life_years DECIMAL(5,2) DEFAULT 5,
  salvage_value DECIMAL(14,2) DEFAULT 0,
  next_service DATE NULL,
  notes VARCHAR(300),
  INDEX (org_id)
);

CREATE TABLE IF NOT EXISTS loans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  org_id INT NOT NULL,
  lender VARCHAR(150) NOT NULL,
  principal DECIMAL(14,2) NOT NULL,
  interest_rate DECIMAL(6,2) DEFAULT 0,
  start_date DATE NOT NULL,
  tenure_months INT DEFAULT 12,
  emi DECIMAL(12,2) DEFAULT 0,
  notes VARCHAR(300),
  INDEX (org_id)
);

CREATE TABLE IF NOT EXISTS loan_repayments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  org_id INT NOT NULL,
  loan_id INT NOT NULL,
  date DATE NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  interest_part DECIMAL(14,2) DEFAULT 0,
  notes VARCHAR(300),
  INDEX (org_id)
);

CREATE TABLE IF NOT EXISTS documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  org_id INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  doc_type VARCHAR(30) DEFAULT 'other',
  farm_id INT NULL,
  doc_date DATE NULL,
  expiry_date DATE NULL,
  file_path VARCHAR(255),
  file_name VARCHAR(255),
  notes VARCHAR(300),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (org_id)
);
