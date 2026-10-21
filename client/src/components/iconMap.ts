import type { ComponentType } from 'react';
import {
  Gauge,
  Building2,
  Calendar,
  CalendarDays,
  BookOpen,
  BookText,
  Users,
  Truck,
  FileText,
  Banknote,
  Landmark,
  CheckCheck,
  Building,
  UserRound,
  ShieldCheck,
  ClipboardList,
  FileChartColumnIncreasing,
  Layers,
  Wallet,
} from 'lucide-react';

type IconComponent = ComponentType<{ size?: number; className?: string }>;

export const iconStringMap: Record<string, IconComponent> = {
  dashboard: Gauge,
  'building-2': Building2,
  'git-branch': Building2,
  calendar: Calendar,
  'calendar-days': CalendarDays,
  'book-open': BookOpen,
  'book-text': BookText,
  users: Users,
  truck: Truck,
  'file-text': FileText,
  wallet: Wallet,
  payments: Banknote,
  landmark: Landmark,
  'check-check': CheckCheck,
  building: Building,
  receipt: Wallet,
  'user-round': UserRound,
  'shield-check': ShieldCheck,
  'clipboard-list': ClipboardList,
  'chart-no-axes-combined': FileChartColumnIncreasing,
};

export const menuCodeIconMap: Record<string, IconComponent> = {
  DASHBOARD: Gauge,
  COMPANIES: Building2,
  BRANCHES: Building2,
  FISCAL_YEARS: Calendar,
  ACCOUNTING_PERIODS: CalendarDays,
  CHART_OF_ACCOUNTS: BookOpen,
  JOURNAL_ENTRIES: BookText,
  CUSTOMERS: Users,
  SUPPLIERS: Truck,
  INVOICES: FileText,
  PAYMENTS: Banknote,
  BANKING: Landmark,
  BANK_RECONCILIATION: CheckCheck,
  FIXED_ASSETS: Building,
  EXPENSES: Wallet,
  USERS: UserRound,
  ROLES: ShieldCheck,
  AUDIT_LOGS: ClipboardList,
  REPORTS: FileChartColumnIncreasing,
};

export function resolveMenuIcon(icon?: string | null, menuCode?: string): IconComponent {
  if (icon && iconStringMap[icon.toLowerCase()]) {
    return iconStringMap[icon.toLowerCase()];
  }
  if (menuCode && menuCodeIconMap[menuCode.toUpperCase()]) {
    return menuCodeIconMap[menuCode.toUpperCase()];
  }
  return Layers;
}
