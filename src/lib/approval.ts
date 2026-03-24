import { randomUUID } from 'crypto';
import * as readline from 'readline';
import type { ApprovalRequest, RiskLevel } from '../types/index.js';
import { logAudit } from './audit.js';

/**
 * Lista de operaciones que SIEMPRE requieren aprobación humana.
 */
export const REQUIRES_APPROVAL = new Set([
  'price_change',
  'reservation_cancel',
  'block_dates',
  'send_complaint_message',
  'send_refund_message',
  'generate_owner_statement',
  'approve_expense_over_200',
  'contract_change',
]);

/**
 * Evalúa si una operación requiere aprobación.
 */
export function requiresApproval(operation: string, context?: {
  amount?: number;
  isComplaint?: boolean;
  isRefund?: boolean;
}): boolean {
  if (REQUIRES_APPROVAL.has(operation)) return true;
  if (context?.amount && context.amount > 200) return true;
  if (context?.isComplaint) return true;
  if (context?.isRefund) return true;
  return false;
}

/**
 * Solicita aprobación interactiva por CLI.
 * En producción, esto puede extenderse a email/Slack/webhook.
 */
export async function requestApproval(params: {
  action: string;
  summary: string;
  impact: string;
  preview?: Record<string, unknown>;
  risk_level: RiskLevel;
}): Promise<ApprovalRequest> {
  const request: ApprovalRequest = {
    id: randomUUID(),
    created_at: new Date().toISOString(),
    action: params.action,
    summary: params.summary,
    impact: params.impact,
    preview: params.preview,
    risk_level: params.risk_level,
    status: 'pending',
  };

  await logAudit({
    action: 'approval_requested',
    tool: 'approval_system',
    summary: `Aprobación requerida: ${params.action}`,
    payload: { request_id: request.id, summary: params.summary },
    risk_level: params.risk_level,
    result: 'pending',
  });

  // Mostrar preview al operador
  console.log('\n' + '═'.repeat(60));
  console.log('🔐 APROBACIÓN REQUERIDA');
  console.log('═'.repeat(60));
  console.log(`Acción   : ${params.action}`);
  console.log(`Resumen  : ${params.summary}`);
  console.log(`Impacto  : ${params.impact}`);
  console.log(`Riesgo   : ${params.risk_level.toUpperCase()}`);
  if (params.preview) {
    console.log('\nPreview:');
    console.log(JSON.stringify(params.preview, null, 2));
  }
  console.log('═'.repeat(60));

  const approved = await promptYesNo('¿Aprobar esta acción? (s/n): ');

  if (approved) {
    request.status = 'approved';
    request.approved_by = 'Oscar Nadal (CLI)';
    request.approved_at = new Date().toISOString();

    await logAudit({
      action: 'approval_granted',
      tool: 'approval_system',
      summary: `Aprobado: ${params.action}`,
      payload: { request_id: request.id },
      risk_level: params.risk_level,
      approved_by: request.approved_by,
      result: 'success',
    });

    console.log('✅ Acción aprobada. Ejecutando...\n');
  } else {
    request.status = 'rejected';

    await logAudit({
      action: 'approval_rejected',
      tool: 'approval_system',
      summary: `Rechazado: ${params.action}`,
      payload: { request_id: request.id },
      risk_level: params.risk_level,
      result: 'failure',
    });

    console.log('❌ Acción rechazada. No se ejecutará.\n');
  }

  return request;
}

function promptYesNo(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      const normalized = answer.trim().toLowerCase();
      resolve(['s', 'si', 'sí', 'y', 'yes', '1'].includes(normalized));
    });
  });
}
