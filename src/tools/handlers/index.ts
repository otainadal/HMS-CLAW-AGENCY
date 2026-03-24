import { handleHostexTool } from './hostex.js';
import { handleDatabaseTool } from './database.js';
import { handlePricingTool } from './pricing.js';
import { handleDocsTool } from './docs.js';
import { handleFinanceTool } from './finance.js';
import { handleSystemTool } from './system.js';
import { requestApproval, requiresApproval } from '../../lib/approval.js';
import { logAudit } from '../../lib/audit.js';
import type { ToolResult } from '../../types/index.js';

/**
 * Router central de tools para FRANK.
 * Aplica validación, approval workflow y auditoría antes de ejecutar.
 */
export async function executeTool(
  tool_name: string,
  tool_input: Record<string, unknown>,
): Promise<string> {
  const result = await routeTool(tool_name, tool_input);

  if (!result.success) {
    return JSON.stringify({ error: result.error, success: false });
  }

  return JSON.stringify({ success: true, data: result.data });
}

async function routeTool(
  tool_name: string,
  input: Record<string, unknown>,
): Promise<ToolResult> {
  // ── Approval gate ─────────────────────────────────────────────────────────
  const approvalNeeded = checkApprovalRequired(tool_name, input);

  if (approvalNeeded) {
    const approval = await requestApproval({
      action: `${tool_name}.${input.operation}`,
      summary: buildApprovalSummary(tool_name, input),
      impact: buildImpactDescription(tool_name, input),
      preview: input as Record<string, unknown>,
      risk_level: 'high',
    });

    if (approval.status !== 'approved') {
      await logAudit({
        action: 'approval_rejected',
        tool: tool_name,
        summary: `Acción rechazada: ${tool_name}.${input.operation}`,
        risk_level: 'high',
        result: 'failure',
      });
      return { success: false, error: 'Acción rechazada por operador.' };
    }
  }

  // ── Route to handler ──────────────────────────────────────────────────────
  switch (tool_name) {
    case 'hostex_tool':
      return handleHostexTool(input);

    case 'hms_db_tool':
      return handleDatabaseTool(input);

    case 'pricing_tool':
      return handlePricingTool(input);

    case 'docs_tool':
      return handleDocsTool(input);

    case 'finance_tool':
      return handleFinanceTool(input);

    case 'system_tool':
      return handleSystemTool(input);

    default:
      return { success: false, error: `Tool desconocida: ${tool_name}` };
  }
}

// ─── Approval Logic ───────────────────────────────────────────────────────────

function checkApprovalRequired(tool_name: string, input: Record<string, unknown>): boolean {
  const operation = input.operation as string;

  // Pricing: apply_change SIEMPRE requiere aprobación
  if (tool_name === 'pricing_tool' && operation === 'apply_change') return true;

  // Hostex: bloquear fechas
  if (tool_name === 'hostex_tool' && operation === 'block_dates') return true;

  // Hostex: enviar mensajes de queja, reembolso o cancelación
  if (tool_name === 'hostex_tool' && operation === 'send_message') {
    const msg = ((input.message as string) ?? '').toLowerCase();
    const sensitiveKeywords = [
      'queja', 'complaint', 'cancelar', 'cancel', 'reembolso', 'refund',
      'inconveniente', 'problema grave', 'reclamo', 'disputa',
    ];
    if (sensitiveKeywords.some((kw) => msg.includes(kw))) return true;
  }

  // Finance: gastos > USD 200
  if (tool_name === 'finance_tool' && operation === 'create_expense') {
    const amount = (input.expense as Record<string, unknown>)?.amount as number;
    if (amount && amount > 200) return true;
  }

  // Docs: owner statement (revisar antes de enviar)
  if (tool_name === 'docs_tool' && operation === 'generate_owner_statement') return true;

  return requiresApproval(operation);
}

function buildApprovalSummary(tool: string, input: Record<string, unknown>): string {
  const op = input.operation as string;
  const prop = input.property_id ? ` en propiedad ${input.property_id}` : '';
  return `${tool}.${op}${prop}`;
}

function buildImpactDescription(tool: string, input: Record<string, unknown>): string {
  const op = input.operation as string;

  const impacts: Record<string, string> = {
    'pricing_tool.apply_change': 'Cambia precios visibles para huéspedes en plataformas',
    'hostex_tool.block_dates': 'Bloquea fechas del calendario — impacta disponibilidad',
    'hostex_tool.send_message': 'Envía mensaje directo al huésped',
    'docs_tool.generate_owner_statement': 'Genera documento financiero para el propietario',
    'finance_tool.create_expense': 'Registra gasto que afecta el estado de cuenta del propietario',
  };

  return impacts[`${tool}.${op}`] ?? 'Acción con impacto operativo o financiero';
}
