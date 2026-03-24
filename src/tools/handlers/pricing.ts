import { createClient } from '@supabase/supabase-js';
import { config } from '../../config.js';
import { logAudit } from '../../lib/audit.js';
import type { ToolResult, PricingRule, PricingPreview } from '../../types/index.js';

let _supabase: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(config.supabase.url, config.supabase.serviceKey);
  }
  return _supabase;
}

export async function handlePricingTool(input: Record<string, unknown>): Promise<ToolResult> {
  const operation = input.operation as string;
  const property_id = input.property_id as string;

  try {
    let result: unknown;

    switch (operation) {
      case 'get_current_pricing':
        result = await getCurrentPricing(property_id, input.platform as string | undefined);
        break;

      case 'preview_change':
        // preview_change NUNCA aplica cambios — solo muestra el diff
        result = await previewPricingChange(
          property_id,
          input.new_pricing as Record<string, unknown>,
          input.platform as string | undefined,
        );
        break;

      case 'apply_change':
        // apply_change solo llega aquí si fue aprobado por FRANK + Oscar
        result = await applyPricingChange(
          property_id,
          input.new_pricing as Record<string, unknown>,
          input.platform as string | undefined,
          input.reason as string | undefined,
        );
        break;

      case 'rollback':
        result = await rollbackPricing(property_id, input.platform as string | undefined);
        break;

      default:
        throw new Error(`Operación de pricing desconocida: ${operation}`);
    }

    return { success: true, data: result };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, error };
  }
}

// ─── Pricing Operations ───────────────────────────────────────────────────────

async function getCurrentPricing(property_id: string, platform?: string): Promise<PricingRule[]> {
  const supabase = getSupabase();
  let query = supabase
    .from('pricing_rules')
    .select('*')
    .eq('property_id', property_id);

  if (platform) query = query.eq('platform', platform);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data as PricingRule[]) ?? [];
}

async function previewPricingChange(
  property_id: string,
  new_pricing: Record<string, unknown>,
  platform?: string,
): Promise<PricingPreview> {
  // Get current pricing
  const current = await getCurrentPricing(property_id, platform);
  const currentRule = current[0];

  if (!currentRule) {
    throw new Error(`No se encontraron reglas de precio para propiedad ${property_id}`);
  }

  // Get property name
  const supabase = getSupabase();
  const { data: prop } = await supabase
    .from('properties')
    .select('name')
    .eq('id', property_id)
    .single();

  // Calculate diff
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  for (const [key, newVal] of Object.entries(new_pricing)) {
    const oldVal = (currentRule as Record<string, unknown>)[key];
    if (oldVal !== newVal) {
      diff[key] = { from: oldVal, to: newVal };
    }
  }

  return {
    property_id,
    property_name: prop?.name ?? property_id,
    current: currentRule,
    proposed: { ...currentRule, ...new_pricing } as PricingRule,
    diff,
    requires_approval: true,
  };
}

async function applyPricingChange(
  property_id: string,
  new_pricing: Record<string, unknown>,
  platform?: string,
  reason?: string,
): Promise<unknown> {
  const supabase = getSupabase();

  // Backup current pricing before changing
  const current = await getCurrentPricing(property_id, platform);
  if (current.length > 0) {
    await supabase.from('pricing_rules_history').insert({
      ...current[0],
      archived_at: new Date().toISOString(),
      archive_reason: reason ?? 'Cambio de precio vía HMS OS',
    });
  }

  // Apply new pricing
  let query = supabase
    .from('pricing_rules')
    .update({ ...new_pricing, updated_at: new Date().toISOString() })
    .eq('property_id', property_id);

  if (platform) query = query.eq('platform', platform);

  const { data, error } = await query.select();
  if (error) throw new Error(error.message);

  await logAudit({
    action: 'price_change',
    tool: 'pricing_tool',
    entity_id: property_id,
    entity_type: 'property',
    summary: `Precio actualizado para propiedad ${property_id}${platform ? ` en ${platform}` : ''}`,
    payload: { new_pricing, reason },
    risk_level: 'high',
    result: 'success',
  });

  return data;
}

async function rollbackPricing(property_id: string, platform?: string): Promise<unknown> {
  const supabase = getSupabase();

  // Get last backup
  let query = supabase
    .from('pricing_rules_history')
    .select('*')
    .eq('property_id', property_id)
    .order('archived_at', { ascending: false })
    .limit(1);

  if (platform) query = query.eq('platform', platform);

  const { data: history, error: histError } = await query;
  if (histError) throw new Error(histError.message);
  if (!history || history.length === 0) throw new Error('No hay historial de precios para rollback');

  const previous = { ...history[0] };
  delete previous.archived_at;
  delete previous.archive_reason;

  // Restore
  let updateQuery = supabase
    .from('pricing_rules')
    .update({ ...previous, updated_at: new Date().toISOString() })
    .eq('property_id', property_id);

  if (platform) updateQuery = updateQuery.eq('platform', platform);

  const { data, error } = await updateQuery.select();
  if (error) throw new Error(error.message);

  await logAudit({
    action: 'price_change',
    tool: 'pricing_tool',
    entity_id: property_id,
    entity_type: 'property',
    summary: `Rollback de precio para propiedad ${property_id}`,
    payload: { restored_to: previous },
    risk_level: 'high',
    result: 'success',
  });

  return { rolled_back_to: previous, current: data };
}
