import axios, { type AxiosInstance } from 'axios';
import { config } from '../../config.js';
import { logToolExecution } from '../../lib/audit.js';
import type { ToolResult } from '../../types/index.js';

let _client: AxiosInstance | null = null;

function getHostexClient(): AxiosInstance {
  if (!_client) {
    _client = axios.create({
      baseURL: config.hostex.baseUrl,
      headers: {
        Authorization: `Bearer ${config.hostex.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 15_000,
    });
  }
  return _client;
}

export async function handleHostexTool(input: Record<string, unknown>): Promise<ToolResult> {
  const operation = input.operation as string;

  try {
    let result: unknown;

    switch (operation) {
      case 'get_properties':
        result = await getProperties();
        break;

      case 'get_reservations':
        result = await getReservations({
          property_id: input.property_id as string | undefined,
          status: input.status as string | undefined,
          start_date: input.start_date as string | undefined,
          end_date: input.end_date as string | undefined,
        });
        break;

      case 'get_reservation_detail':
        if (!input.reservation_id) throw new Error('reservation_id es requerido');
        result = await getReservationDetail(input.reservation_id as string);
        break;

      case 'get_calendar':
        if (!input.property_id) throw new Error('property_id es requerido');
        result = await getCalendar(
          input.property_id as string,
          input.start_date as string | undefined,
          input.end_date as string | undefined,
        );
        break;

      case 'block_dates':
        // block_dates siempre pasa por approval en FRANK antes de llegar aquí
        if (!input.property_id || !input.start_date || !input.end_date) {
          throw new Error('property_id, start_date y end_date son requeridos');
        }
        result = await blockDates(
          input.property_id as string,
          input.start_date as string,
          input.end_date as string,
          input.reason as string | undefined,
        );
        break;

      case 'send_message':
        if (!input.reservation_id || !input.message) {
          throw new Error('reservation_id y message son requeridos');
        }
        result = await sendMessage(input.reservation_id as string, input.message as string);
        break;

      case 'get_guest':
        if (!input.guest_id) throw new Error('guest_id es requerido');
        result = await getGuest(input.guest_id as string);
        break;

      default:
        throw new Error(`Operación desconocida: ${operation}`);
    }

    await logToolExecution({
      tool: 'hostex_tool',
      operation,
      entity_id: (input.property_id ?? input.reservation_id) as string | undefined,
      result: 'success',
      risk_level: getRiskLevel(operation),
    });

    return { success: true, data: result };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await logToolExecution({
      tool: 'hostex_tool',
      operation,
      result: 'failure',
      risk_level: 'medium',
      error,
    });
    return { success: false, error };
  }
}

// ─── API Calls ────────────────────────────────────────────────────────────────

async function getProperties() {
  const client = getHostexClient();
  const res = await client.get('/properties');
  return res.data;
}

async function getReservations(params: {
  property_id?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
}) {
  const client = getHostexClient();
  const res = await client.get('/reservations', { params });
  return res.data;
}

async function getReservationDetail(id: string) {
  const client = getHostexClient();
  const res = await client.get(`/reservations/${id}`);
  return res.data;
}

async function getCalendar(property_id: string, start_date?: string, end_date?: string) {
  const client = getHostexClient();
  const res = await client.get(`/properties/${property_id}/calendar`, {
    params: { start_date, end_date },
  });
  return res.data;
}

async function blockDates(
  property_id: string,
  start_date: string,
  end_date: string,
  reason?: string,
) {
  const client = getHostexClient();
  const res = await client.post(`/properties/${property_id}/calendar/block`, {
    start_date,
    end_date,
    reason: reason ?? 'Bloqueado por HMS OS',
  });
  return res.data;
}

async function sendMessage(reservation_id: string, message: string) {
  const client = getHostexClient();
  const res = await client.post(`/reservations/${reservation_id}/messages`, {
    content: message,
  });
  return res.data;
}

async function getGuest(guest_id: string) {
  const client = getHostexClient();
  const res = await client.get(`/guests/${guest_id}`);
  return res.data;
}

function getRiskLevel(operation: string) {
  const highRisk = ['block_dates', 'send_message'];
  const mediumRisk = ['get_reservation_detail', 'get_calendar'];
  if (highRisk.includes(operation)) return 'high' as const;
  if (mediumRisk.includes(operation)) return 'medium' as const;
  return 'low' as const;
}
