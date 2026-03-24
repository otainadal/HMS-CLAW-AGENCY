import { config } from '../../config.js';
import { getRecentAuditLogs } from '../../lib/audit.js';
import type { ToolResult } from '../../types/index.js';
import { handleDatabaseTool } from './database.js';

export async function handleSystemTool(input: Record<string, unknown>): Promise<ToolResult> {
  const operation = input.operation as string;

  try {
    let result: unknown;

    switch (operation) {
      case 'get_status':
        result = await getSystemStatus();
        break;

      case 'get_audit_log':
        result = await getRecentAuditLogs((input.limit as number) ?? 20);
        break;

      case 'get_properties_summary':
        result = await getPropertiesSummary();
        break;

      default:
        throw new Error(`Operación de sistema desconocida: ${operation}`);
    }

    return { success: true, data: result };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, error };
  }
}

async function getSystemStatus() {
  return {
    system: 'HMS OS',
    orchestrator: 'FRANK',
    version: '1.0.0',
    model: config.anthropic.model,
    company: `Host My Spot (${config.hms.companyDomain})`,
    owner: config.hms.ownerName,
    timestamp: new Date().toISOString(),
    status: 'operational',
    tools_available: [
      'hostex_tool',
      'hms_db_tool',
      'pricing_tool',
      'docs_tool',
      'finance_tool',
      'system_tool',
    ],
    capabilities: [
      'Gestión de propiedades y reservas (Hostex)',
      'Base de datos operacional (Supabase)',
      'Pricing con aprobación',
      'Generación de documentos',
      'Finanzas y estados de cuenta',
      'Auditoría completa',
    ],
  };
}

async function getPropertiesSummary() {
  const result = await handleDatabaseTool({ operation: 'get_properties' });
  if (!result.success) throw new Error(result.error);

  const properties = (result.data as Array<Record<string, unknown>>) ?? [];

  return {
    total_properties: properties.length,
    active_properties: properties.filter((p) => p.active).length,
    properties: properties.map((p) => ({
      id: p.id,
      name: p.name,
      active: p.active,
    })),
    retrieved_at: new Date().toISOString(),
  };
}
