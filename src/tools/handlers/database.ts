import { createClient } from '@supabase/supabase-js';
import { config } from '../../config.js';
import { logToolExecution } from '../../lib/audit.js';
import type { ToolResult } from '../../types/index.js';

let _supabase: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(config.supabase.url, config.supabase.serviceKey);
  }
  return _supabase;
}

// Tablas permitidas para lectura/escritura desde FRANK
const ALLOWED_TABLES = new Set([
  'properties',
  'reservations',
  'expenses',
  'audit_log',
  'pricing_rules',
  'owner_statements',
  'maintenance_tickets',
  'guest_profiles',
  'hms_config',
]);

// Tablas de solo lectura (no se pueden modificar desde tools)
const READ_ONLY_TABLES = new Set(['audit_log']);

export async function handleDatabaseTool(input: Record<string, unknown>): Promise<ToolResult> {
  const operation = input.operation as string;

  try {
    let result: unknown;

    switch (operation) {
      case 'query':
        result = await queryTable(input);
        break;

      case 'insert':
        result = await insertRecord(input);
        break;

      case 'update':
        result = await updateRecord(input);
        break;

      case 'get_properties':
        result = await getPropertiesMaster();
        break;

      case 'get_audit_log':
        result = await getAuditLog(input.limit as number | undefined);
        break;

      default:
        throw new Error(`Operación DB desconocida: ${operation}`);
    }

    await logToolExecution({
      tool: 'hms_db_tool',
      operation,
      entity_type: input.table as string | undefined,
      result: 'success',
      risk_level: operation === 'query' ? 'low' : 'medium',
    });

    return { success: true, data: result };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await logToolExecution({
      tool: 'hms_db_tool',
      operation,
      result: 'failure',
      risk_level: 'medium',
      error,
    });
    return { success: false, error };
  }
}

// ─── DB Operations ────────────────────────────────────────────────────────────

async function queryTable(input: Record<string, unknown>) {
  const table = input.table as string;
  validateTable(table);

  const supabase = getSupabase();
  let query = supabase.from(table).select('*');

  // Apply filters
  const filters = input.filters as Record<string, unknown> | undefined;
  if (filters) {
    for (const [col, val] of Object.entries(filters)) {
      query = query.eq(col, val);
    }
  }

  // Order
  const order_by = input.order_by as string | undefined;
  if (order_by) {
    query = query.order(order_by, { ascending: (input.ascending as boolean) ?? false });
  }

  // Limit
  const limit = (input.limit as number) ?? 50;
  query = query.limit(limit);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

async function insertRecord(input: Record<string, unknown>) {
  const table = input.table as string;
  validateTable(table, true);

  const data = input.data as Record<string, unknown>;
  if (!data) throw new Error('data es requerido para insert');

  const supabase = getSupabase();
  const { data: result, error } = await supabase.from(table).insert(data).select();
  if (error) throw new Error(error.message);
  return result;
}

async function updateRecord(input: Record<string, unknown>) {
  const table = input.table as string;
  validateTable(table, true);

  const data = input.data as Record<string, unknown>;
  const filters = input.filters as Record<string, unknown>;
  if (!data) throw new Error('data es requerido para update');
  if (!filters || Object.keys(filters).length === 0) {
    throw new Error('filters es requerido para update (previene updates masivos)');
  }

  const supabase = getSupabase();
  let query = supabase.from(table).update(data);
  for (const [col, val] of Object.entries(filters)) {
    query = query.eq(col, val);
  }

  const { data: result, error } = await query.select();
  if (error) throw new Error(error.message);
  return result;
}

async function getPropertiesMaster() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('active', true)
    .order('name');
  if (error) throw new Error(error.message);
  return data;
}

async function getAuditLog(limit = 50) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data;
}

function validateTable(table: string, requiresWrite = false): void {
  if (!ALLOWED_TABLES.has(table)) {
    throw new Error(`Tabla no autorizada: ${table}`);
  }
  if (requiresWrite && READ_ONLY_TABLES.has(table)) {
    throw new Error(`Tabla de solo lectura: ${table}`);
  }
}
