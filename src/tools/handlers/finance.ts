import { createClient } from '@supabase/supabase-js';
import { config } from '../../config.js';
import { logAudit } from '../../lib/audit.js';
import type { ToolResult, Expense, OwnerStatement } from '../../types/index.js';

let _supabase: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(config.supabase.url, config.supabase.serviceKey);
  }
  return _supabase;
}

const HMS_COMMISSION_RATE = 0.20; // 20% de comisión por defecto

export async function handleFinanceTool(input: Record<string, unknown>): Promise<ToolResult> {
  const operation = input.operation as string;

  try {
    let result: unknown;

    switch (operation) {
      case 'get_revenue':
        result = await getRevenue(
          input.property_id as string | undefined,
          input.period_start as string | undefined,
          input.period_end as string | undefined,
        );
        break;

      case 'get_expenses':
        result = await getExpenses(
          input.property_id as string | undefined,
          input.period_start as string | undefined,
          input.period_end as string | undefined,
        );
        break;

      case 'calculate_net_payout':
        if (!input.property_id) throw new Error('property_id es requerido');
        result = await calculateNetPayout(
          input.property_id as string,
          input.period_start as string,
          input.period_end as string,
        );
        break;

      case 'create_expense':
        result = await createExpense(input.expense as Record<string, unknown>);
        break;

      case 'get_summary':
        result = await getFinancialSummary(
          input.property_id as string | undefined,
          input.period_start as string | undefined,
          input.period_end as string | undefined,
        );
        break;

      default:
        throw new Error(`Operación financiera desconocida: ${operation}`);
    }

    return { success: true, data: result };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, error };
  }
}

// ─── Finance Operations ───────────────────────────────────────────────────────

async function getRevenue(property_id?: string, period_start?: string, period_end?: string) {
  const supabase = getSupabase();
  let query = supabase
    .from('reservations')
    .select('id, property_id, check_in, check_out, total_amount, currency, platform, status')
    .eq('status', 'confirmed');

  if (property_id) query = query.eq('property_id', property_id);
  if (period_start) query = query.gte('check_in', period_start);
  if (period_end) query = query.lte('check_out', period_end);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const reservations = data ?? [];
  const total = reservations.reduce((sum, r) => sum + (r.total_amount ?? 0), 0);

  return {
    reservations,
    total_revenue: total,
    count: reservations.length,
    period: { start: period_start, end: period_end },
  };
}

async function getExpenses(property_id?: string, period_start?: string, period_end?: string) {
  const supabase = getSupabase();
  let query = supabase.from('expenses').select('*');

  if (property_id) query = query.eq('property_id', property_id);
  if (period_start) query = query.gte('date', period_start);
  if (period_end) query = query.lte('date', period_end);

  const { data, error } = await query.order('date', { ascending: false });
  if (error) throw new Error(error.message);

  const expenses = (data as Expense[]) ?? [];
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  return {
    expenses,
    total_expenses: total,
    count: expenses.length,
  };
}

async function calculateNetPayout(
  property_id: string,
  period_start: string,
  period_end: string,
): Promise<OwnerStatement> {
  const supabase = getSupabase();

  // Get property name
  const { data: prop } = await supabase
    .from('properties')
    .select('name')
    .eq('id', property_id)
    .single();

  // Get revenue
  const { reservations, total_revenue } = (await getRevenue(property_id, period_start, period_end)) as {
    reservations: unknown[];
    total_revenue: number;
  };

  // Get expenses
  const { expenses, total_expenses } = (await getExpenses(property_id, period_start, period_end)) as {
    expenses: Expense[];
    total_expenses: number;
  };

  const hms_commission = total_revenue * HMS_COMMISSION_RATE;
  const net_payout = total_revenue - total_expenses - hms_commission;

  return {
    property_id,
    property_name: prop?.name ?? property_id,
    period_start,
    period_end,
    gross_revenue: total_revenue,
    expenses,
    total_expenses,
    hms_commission,
    net_payout,
    currency: 'USD',
  };
}

async function createExpense(expenseData: Record<string, unknown>): Promise<unknown> {
  if (!expenseData) throw new Error('expense data es requerido');

  const expense: Expense = {
    property_id: expenseData.property_id as string,
    date: (expenseData.date as string) ?? new Date().toISOString().split('T')[0],
    category: expenseData.category as string,
    description: expenseData.description as string,
    amount: expenseData.amount as number,
    currency: (expenseData.currency as string) ?? 'USD',
    vendor: expenseData.vendor as string | undefined,
    requires_owner_approval: (expenseData.amount as number) > 200,
    approved: (expenseData.amount as number) <= 200,
  };

  const supabase = getSupabase();
  const { data, error } = await supabase.from('expenses').insert(expense).select().single();
  if (error) throw new Error(error.message);

  await logAudit({
    action: 'expense_created',
    tool: 'finance_tool',
    entity_id: expense.property_id,
    entity_type: 'property',
    summary: `Gasto registrado: ${expense.description} — ${expense.amount} ${expense.currency}`,
    payload: { expense },
    risk_level: expense.requires_owner_approval ? 'high' : 'low',
    result: 'success',
  });

  return data;
}

async function getFinancialSummary(
  property_id?: string,
  period_start?: string,
  period_end?: string,
) {
  const revenue = await getRevenue(property_id, period_start, period_end);
  const expenses = await getExpenses(property_id, period_start, period_end);

  const gross = (revenue as { total_revenue: number }).total_revenue;
  const exp = (expenses as { total_expenses: number }).total_expenses;
  const commission = gross * HMS_COMMISSION_RATE;

  return {
    period: { start: period_start, end: period_end },
    property_id,
    gross_revenue: gross,
    total_expenses: exp,
    hms_commission: commission,
    net_payout: gross - exp - commission,
    commission_rate: `${HMS_COMMISSION_RATE * 100}%`,
    revenue_details: revenue,
    expense_details: expenses,
  };
}
