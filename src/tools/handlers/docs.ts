import { config } from '../../config.js';
import { logAudit } from '../../lib/audit.js';
import type { ToolResult, OwnerStatement } from '../../types/index.js';
import { handleFinanceTool } from './finance.js';

export async function handleDocsTool(input: Record<string, unknown>): Promise<ToolResult> {
  const operation = input.operation as string;

  try {
    let result: unknown;

    switch (operation) {
      case 'generate_owner_statement':
        result = await generateOwnerStatement(input);
        break;

      case 'generate_maintenance_report':
        result = await generateMaintenanceReport(input);
        break;

      case 'generate_guest_guide':
        result = await generateGuestGuide(input);
        break;

      case 'generate_expense_report':
        result = await generateExpenseReport(input);
        break;

      default:
        throw new Error(`Operación de documentos desconocida: ${operation}`);
    }

    return { success: true, data: result };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, error };
  }
}

// ─── Document Generators ──────────────────────────────────────────────────────

async function generateOwnerStatement(input: Record<string, unknown>) {
  const property_id = input.property_id as string;
  const period_start = input.period_start as string;
  const period_end = input.period_end as string;
  const language = (input.language as string) ?? 'es';

  // Get financial data
  const financeResult = await handleFinanceTool({
    operation: 'calculate_net_payout',
    property_id,
    period_start,
    period_end,
  });

  if (!financeResult.success) throw new Error(financeResult.error);

  const statement = financeResult.data as OwnerStatement;
  const doc = formatOwnerStatement(statement, language);

  await logAudit({
    action: 'statement_generated',
    tool: 'docs_tool',
    entity_id: property_id,
    entity_type: 'property',
    summary: `Owner statement generado: ${property_id} (${period_start} → ${period_end})`,
    payload: {
      gross_revenue: statement.gross_revenue,
      net_payout: statement.net_payout,
    },
    risk_level: 'medium',
    result: 'success',
  });

  return {
    document_type: 'owner_statement',
    property_id,
    period: { start: period_start, end: period_end },
    statement,
    formatted: doc,
    requires_review_before_sending: true,
    generated_at: new Date().toISOString(),
    generated_by: 'FRANK / HMS OS',
  };
}

async function generateMaintenanceReport(input: Record<string, unknown>) {
  const property_id = input.property_id as string;

  // This would query maintenance_tickets table in production
  return {
    document_type: 'maintenance_report',
    property_id,
    generated_at: new Date().toISOString(),
    note: 'Conectar con tabla maintenance_tickets para datos reales',
    template: buildMaintenanceTemplate(property_id),
  };
}

async function generateGuestGuide(input: Record<string, unknown>) {
  const property_id = input.property_id as string;
  const language = (input.language as string) ?? 'es';

  return {
    document_type: 'guest_guide',
    property_id,
    language,
    generated_at: new Date().toISOString(),
    sections: [
      { title: 'Bienvenida', content: 'Bienvenido a tu alojamiento en Host My Spot.' },
      { title: 'Check-in / Check-out', content: 'Instrucciones de entrada y salida.' },
      { title: 'WiFi y Amenidades', content: 'Acceso a servicios y comodidades.' },
      { title: 'Normas de la Casa', content: 'Reglas y políticas del alojamiento.' },
      { title: 'Contacto de Emergencia', content: config.hms.ownerEmail },
    ],
    note: 'Personalizar con datos específicos de la propiedad desde la DB.',
  };
}

async function generateExpenseReport(input: Record<string, unknown>) {
  const property_id = input.property_id as string;
  const period_start = input.period_start as string;
  const period_end = input.period_end as string;

  const financeResult = await handleFinanceTool({
    operation: 'get_expenses',
    property_id,
    period_start,
    period_end,
  });

  if (!financeResult.success) throw new Error(financeResult.error);

  return {
    document_type: 'expense_report',
    property_id,
    period: { start: period_start, end: period_end },
    data: financeResult.data,
    generated_at: new Date().toISOString(),
    generated_by: 'FRANK / HMS OS',
  };
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatOwnerStatement(statement: OwnerStatement, language: string): string {
  const fmt = (n: number) => `$${n.toFixed(2)} ${statement.currency}`;

  if (language === 'es') {
    return `
══════════════════════════════════════════
       HOST MY SPOT — ESTADO DE CUENTA
══════════════════════════════════════════
Propiedad  : ${statement.property_name}
Período    : ${statement.period_start} → ${statement.period_end}
Generado   : ${new Date().toLocaleDateString('es-DO')}
──────────────────────────────────────────
Ingreso Bruto          : ${fmt(statement.gross_revenue)}
Gastos Totales         : ${fmt(statement.total_expenses)}
Comisión HMS (20%)     : ${fmt(statement.hms_commission)}
──────────────────────────────────────────
NETO AL PROPIETARIO    : ${fmt(statement.net_payout)}
══════════════════════════════════════════
⚠️  Revisar antes de enviar al propietario.
`.trim();
  }

  return `
══════════════════════════════════════════
       HOST MY SPOT — OWNER STATEMENT
══════════════════════════════════════════
Property   : ${statement.property_name}
Period     : ${statement.period_start} → ${statement.period_end}
Generated  : ${new Date().toLocaleDateString('en-US')}
──────────────────────────────────────────
Gross Revenue          : ${fmt(statement.gross_revenue)}
Total Expenses         : ${fmt(statement.total_expenses)}
HMS Commission (20%)   : ${fmt(statement.hms_commission)}
──────────────────────────────────────────
NET TO OWNER           : ${fmt(statement.net_payout)}
══════════════════════════════════════════
⚠️  Review before sending to owner.
`.trim();
}

function buildMaintenanceTemplate(property_id: string): string {
  return `
HOST MY SPOT — REPORTE DE MANTENIMIENTO
Propiedad: ${property_id}
Fecha: ${new Date().toLocaleDateString('es-DO')}

[Ticket #] | Fecha | Descripción | Estado | Costo | Proveedor
──────────────────────────────────────────────────────────
(Consultar tabla maintenance_tickets en Supabase)
`.trim();
}
