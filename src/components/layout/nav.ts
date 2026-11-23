import {
  LayoutDashboard, Users, ShoppingBasket, Truck, Warehouse, Sprout, Building2, Tags, Receipt,
  UserCog, Banknote, BarChart3, Wifi, FileText, Wallet, BellRing, Package, Shield,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '@/lib/types';

export type Area = 'admin' | 'grain' | 'isp';
export interface NavItem { href: string; label: string; icon: LucideIcon; managerOnly?: boolean }

export const AREAS: Record<Area, { name: string; short: string; color: string; icon: LucideIcon }> = {
  admin: { name: 'Admin Console', short: 'Admin', color: 'bg-rose-600', icon: Shield },
  grain: { name: 'Palay & Corn Station', short: 'Grain', color: 'bg-emerald-600', icon: Sprout },
  isp:   { name: 'Internet Billing', short: 'ISP', color: 'bg-primary-600', icon: Wifi },
};

export const NAV: Record<Area, NavItem[]> = {
  admin: [
    { href: '/admin', label: 'Overview', icon: LayoutDashboard },
    { href: '/admin/users', label: 'Users', icon: Users },
  ],
  grain: [
    { href: '/grain', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/grain/purchases', label: 'Buying (Purchases)', icon: ShoppingBasket },
    { href: '/grain/sales', label: 'Selling (Big Buyers)', icon: Truck },
    { href: '/grain/inventory', label: 'Inventory', icon: Warehouse },
    { href: '/grain/farmers', label: 'Farmers / Sellers', icon: Sprout },
    { href: '/grain/buyers', label: 'Big Buyers', icon: Building2 },
    { href: '/grain/commodities', label: 'Commodities & Prices', icon: Tags },
    { href: '/grain/expenses', label: 'Expenses', icon: Receipt },
    { href: '/grain/employees', label: 'Personnel', icon: UserCog, managerOnly: true },
    { href: '/grain/payroll', label: 'Payroll', icon: Banknote, managerOnly: true },
    { href: '/grain/reports', label: 'Reports', icon: BarChart3, managerOnly: true },
  ],
  isp: [
    { href: '/isp', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/isp/customers', label: 'Customers', icon: Users },
    { href: '/isp/billing', label: 'Billing', icon: FileText },
    { href: '/isp/payments', label: 'Collections', icon: Wallet },
    { href: '/isp/notices', label: 'Notices', icon: BellRing },
    { href: '/isp/plans', label: 'Plans', icon: Package },
    { href: '/isp/expenses', label: 'Expenses', icon: Receipt },
    { href: '/isp/employees', label: 'Personnel', icon: UserCog, managerOnly: true },
    { href: '/isp/payroll', label: 'Payroll', icon: Banknote, managerOnly: true },
    { href: '/isp/reports', label: 'Reports', icon: BarChart3, managerOnly: true },
  ],
};

export const canSee = (item: NavItem, role: Role) => !item.managerOnly || role !== 'staff';
