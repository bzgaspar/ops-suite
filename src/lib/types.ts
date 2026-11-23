export type SystemKey = 'grain' | 'isp';
export type Role = 'admin' | 'manager' | 'staff';

export interface Profile {
  id: string;
  username: string;
  full_name: string;
  role: Role;
  system: SystemKey | null;
  active: boolean;
  created_at: string;
}

export interface Employee {
  id: string;
  full_name: string;
  position: string | null;
  phone: string | null;
  pay_type: 'daily' | 'monthly';
  rate: number;
  ot_rate_per_hour: number;
  food_allowance_per_day: number;
  trip_rate: number;
  hired_on: string | null;
  active: boolean;
  notes: string | null;
}

export interface PayrollPeriod {
  id: string;
  period_start: string;
  period_end: string;
  status: 'draft' | 'paid';
  paid_on: string | null;
  notes: string | null;
  created_at: string;
}

export interface PayrollLine {
  id: string;
  period_id: string;
  employee_id: string;
  days_worked: number;
  basic_pay: number;
  ot_hours: number;
  ot_pay: number;
  food_allowance: number;
  trip_pay: number;
  other_pay: number;
  cash_advance: number;
  other_deductions: number;
  gross_pay: number;
  net_pay: number;
  remarks: string | null;
}

export interface Expense {
  id: string;
  expense_date: string;
  category: string;
  description: string | null;
  amount: number;
  paid_to: string | null;
  reference: string | null;
  vehicle_id?: string | null;
  sale_id?: string | null;
  created_at: string;
  grain_vehicles?: { plate_no: string } | null;
  grain_sales?: { ref_no: string } | null;
}

// ---- Grain ----
export type VehicleType = 'truck' | 'pickup' | 'van' | 'motorcycle' | 'other';
export interface Vehicle {
  id: string;
  plate_no: string;
  name: string | null;
  vehicle_type: VehicleType;
  capacity_kg: number | null;
  default_driver_id: string | null;
  registration_expiry: string | null;
  insurance_expiry: string | null;
  active: boolean;
  notes: string | null;
  created_at: string;
}

export interface Commodity {
  id: string;
  name: string;
  kind: 'palay' | 'corn' | 'other';
  buy_price: number;
  sell_price: number;
  active: boolean;
}

export interface Farmer {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  notes: string | null;
  active: boolean;
}

export interface Buyer extends Farmer {
  company: string | null;
}

export interface Purchase {
  id: string;
  ref_no: string;
  purchase_date: string;
  farmer_id: string | null;
  seller_name: string;
  commodity_id: string;
  sacks: number;
  gross_kg: number;
  tare_kg: number;
  moisture_pct: number | null;
  moisture_deduction_kg: number;
  net_kg: number;
  price_per_kg: number;
  amount: number;
  other_deductions: number;
  net_payable: number;
  payment_status: 'paid' | 'unpaid';
  remarks: string | null;
  created_at: string;
  grain_commodities?: { name: string } | null;
}

export interface Sale {
  id: string;
  ref_no: string;
  sale_date: string;
  buyer_id: string;
  commodity_id: string;
  sacks: number;
  gross_kg: number;
  tare_kg: number;
  deduction_kg: number;
  net_kg: number;
  price_per_kg: number;
  amount: number;
  hauling_cost: number;
  truck_plate: string | null;
  driver: string | null;
  vehicle_id: string | null;
  driver_id: string | null;
  driver_fee: number;
  amount_paid: number;
  remarks: string | null;
  created_at: string;
  grain_commodities?: { name: string } | null;
  grain_buyers?: { name: string; company: string | null } | null;
  grain_vehicles?: { plate_no: string } | null;
}

export interface SalePayment {
  id: string;
  sale_id: string;
  paid_on: string;
  amount: number;
  method: string;
  reference: string | null;
}

export interface InventoryRow {
  commodity_id: string;
  name: string;
  kind: string;
  buy_price: number;
  sell_price: number;
  purchased_kg: number;
  purchased_cost: number;
  sold_kg: number;
  adjusted_kg: number;
  on_hand_kg: number;
  avg_cost_per_kg: number;
}

export interface StockAdjustment {
  id: string;
  adj_date: string;
  commodity_id: string;
  kg: number;
  reason: string;
  grain_commodities?: { name: string } | null;
}

// ---- ISP ----
export interface Plan {
  id: string;
  name: string;
  speed_mbps: number | null;
  monthly_fee: number;
  active: boolean;
}

export type CustomerStatus = 'active' | 'suspended' | 'disconnected';

export interface Customer {
  id: string;
  account_no: string;
  full_name: string;
  address: string | null;
  area: string | null;
  phone: string | null;
  email: string | null;
  plan_id: string | null;
  monthly_fee: number;
  install_date: string | null;
  billing_day: number;
  status: CustomerStatus;
  pppoe_username: string | null;
  ip_address: string | null;
  notes: string | null;
  created_at: string;
  isp_plans?: { name: string } | null;
}

export interface CustomerBalance {
  customer_id: string;
  total_billed: number;
  total_paid: number;
  balance: number;
  overdue: number;
  oldest_unpaid_due: string | null;
  last_paid_on: string | null;
}

export interface Invoice {
  id: string;
  invoice_no: string;
  customer_id: string;
  kind: 'monthly' | 'installation' | 'other';
  period_month: string | null;
  description: string | null;
  amount: number;
  other_charges: number;
  discount: number;
  total: number;
  amount_paid: number;
  due_date: string;
  created_at: string;
  isp_customers?: { full_name: string; account_no: string; area: string | null } | null;
}

export interface Payment {
  id: string;
  receipt_no: string;
  customer_id: string;
  paid_on: string;
  amount: number;
  method: string;
  reference: string | null;
  collector: string | null;
  notes: string | null;
  created_at: string;
  isp_customers?: { full_name: string; account_no: string; address: string | null } | null;
}

export type NoticeType = 'billing' | 'reminder' | 'disconnection' | 'reconnection' | 'general';

export interface Notice {
  id: string;
  customer_id: string;
  notice_type: NoticeType;
  issued_on: string;
  due_date: string | null;
  amount_due: number;
  message: string;
  created_at: string;
  isp_customers?: { full_name: string; account_no: string; address: string | null; area: string | null } | null;
}
