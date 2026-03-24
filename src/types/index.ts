// ─── Enums ────────────────────────────────────────────────────────────────────

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type AuditAction =
  | 'price_change'
  | 'reservation_cancel'
  | 'message_sent'
  | 'block_dates'
  | 'expense_created'
  | 'statement_generated'
  | 'maintenance_approved'
  | 'tool_executed'
  | 'approval_requested'
  | 'approval_granted'
  | 'approval_rejected'
  | 'error';

// ─── Audit ────────────────────────────────────────────────────────────────────

export interface AuditEntry {
  id?: string;
  timestamp: string;
  action: AuditAction;
  tool: string;
  entity_type?: string;
  entity_id?: string;
  summary: string;
  payload?: Record<string, unknown>;
  risk_level: RiskLevel;
  approved_by?: string;
  result?: 'success' | 'failure' | 'pending';
  error?: string;
}

// ─── Approval ─────────────────────────────────────────────────────────────────

export interface ApprovalRequest {
  id: string;
  created_at: string;
  action: string;
  summary: string;
  impact: string;
  preview?: Record<string, unknown>;
  risk_level: RiskLevel;
  status: ApprovalStatus;
  approved_by?: string;
  approved_at?: string;
}

// ─── Hostex ───────────────────────────────────────────────────────────────────

export interface Property {
  id: string;
  name: string;
  address?: string;
  owner_id?: string;
  platform_ids?: Record<string, string>;
  active: boolean;
}

export interface Reservation {
  id: string;
  property_id: string;
  guest_name: string;
  guest_email?: string;
  check_in: string;
  check_out: string;
  status: string;
  total_amount?: number;
  currency?: string;
  platform?: string;
  nights?: number;
}

export interface CalendarBlock {
  property_id: string;
  start_date: string;
  end_date: string;
  reason?: string;
}

// ─── Pricing ──────────────────────────────────────────────────────────────────

export interface PricingRule {
  property_id: string;
  base_price: number;
  weekend_price?: number;
  min_nights?: number;
  currency: string;
  platform?: string;
}

export interface PricingPreview {
  property_id: string;
  property_name: string;
  current: PricingRule;
  proposed: PricingRule;
  diff: Record<string, { from: unknown; to: unknown }>;
  requires_approval: true;
}

// ─── Finance ──────────────────────────────────────────────────────────────────

export interface Expense {
  id?: string;
  property_id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  currency: string;
  vendor?: string;
  requires_owner_approval: boolean;
  approved?: boolean;
}

export interface OwnerStatement {
  property_id: string;
  property_name: string;
  period_start: string;
  period_end: string;
  gross_revenue: number;
  expenses: Expense[];
  total_expenses: number;
  hms_commission: number;
  net_payout: number;
  currency: string;
}

// ─── Tool I/O ─────────────────────────────────────────────────────────────────

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  requires_approval?: boolean;
  approval_request?: ApprovalRequest;
  audit_logged?: boolean;
}
