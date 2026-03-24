import { createClient } from '@supabase/supabase-js';
import type { AuditEntry, AuditAction, RiskLevel } from '../types/index.js';
import { config } from '../config.js';

let _supabase: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(config.supabase.url, config.supabase.serviceKey);
  }
  return _supabase;
}

/**
 * Registra una acción importante en audit_log.
 * SIEMPRE debe llamarse antes/después de acciones sensibles.
 */
export async function logAudit(entry: Omit<AuditEntry, 'id' | 'timestamp'>): Promise<void> {
  const row: AuditEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  };

  // Print to console always (never lose audit trail even if DB fails)
  const icon = riskIcon(row.risk_level);
  console.log(
    `\n${icon} [AUDIT] ${row.timestamp} | ${row.action} | ${row.tool} | ${row.summary}`,
  );

  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('audit_log').insert(row);
    if (error) {
      console.error('[AUDIT] Warning: No se pudo persistir en audit_log:', error.message);
    }
  } catch (err) {
    console.error('[AUDIT] Warning: Error conectando a Supabase:', err);
  }
}

function riskIcon(risk: RiskLevel): string {
  switch (risk) {
    case 'low': return '📋';
    case 'medium': return '⚠️';
    case 'high': return '🔴';
    case 'critical': return '🚨';
  }
}

/**
 * Helper: log rápido para ejecuciones de tools.
 */
export async function logToolExecution(params: {
  tool: string;
  operation: string;
  entity_id?: string;
  entity_type?: string;
  result: 'success' | 'failure';
  risk_level?: RiskLevel;
  payload?: Record<string, unknown>;
  error?: string;
}): Promise<void> {
  await logAudit({
    action: 'tool_executed',
    tool: params.tool,
    entity_id: params.entity_id,
    entity_type: params.entity_type,
    summary: `${params.tool}.${params.operation} → ${params.result}`,
    payload: params.payload,
    risk_level: params.risk_level ?? 'low',
    result: params.result,
    error: params.error,
  });
}

/**
 * Recupera los últimos N registros del audit log.
 */
export async function getRecentAuditLogs(limit = 50): Promise<AuditEntry[]> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('audit_log')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data as AuditEntry[]) ?? [];
  } catch (err) {
    console.error('[AUDIT] No se pudo leer audit_log:', err);
    return [];
  }
}
