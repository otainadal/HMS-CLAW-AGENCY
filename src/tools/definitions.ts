import type Anthropic from '@anthropic-ai/sdk';

/**
 * Definiciones de tools para FRANK (Claude tool use).
 * Estas definiciones son las capacidades que FRANK puede ejercer.
 */
export const FRANK_TOOLS: Anthropic.Tool[] = [

  // ─── HOSTEX TOOL ──────────────────────────────────────────────────────────

  {
    name: 'hostex_tool',
    description: `Interactúa con la API de Hostex para gestionar propiedades, reservas, calendario, mensajes y huéspedes de Host My Spot.
Operaciones disponibles:
- get_properties: Lista todas las propiedades activas
- get_reservations: Obtiene reservas (por propiedad, estado, rango de fechas)
- get_reservation_detail: Detalle completo de una reserva específica
- get_calendar: Disponibilidad y calendario de una propiedad
- block_dates: Bloquea fechas en el calendario (requiere aprobación)
- send_message: Envía mensaje a un huésped (mensajes sensibles requieren aprobación)
- get_guest: Información de un huésped`,
    input_schema: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: [
            'get_properties',
            'get_reservations',
            'get_reservation_detail',
            'get_calendar',
            'block_dates',
            'send_message',
            'get_guest',
          ],
          description: 'La operación a ejecutar',
        },
        property_id: {
          type: 'string',
          description: 'ID de la propiedad (requerido para operaciones de propiedad específica)',
        },
        reservation_id: {
          type: 'string',
          description: 'ID de la reserva',
        },
        guest_id: {
          type: 'string',
          description: 'ID del huésped',
        },
        start_date: {
          type: 'string',
          description: 'Fecha inicio (YYYY-MM-DD)',
        },
        end_date: {
          type: 'string',
          description: 'Fecha fin (YYYY-MM-DD)',
        },
        message: {
          type: 'string',
          description: 'Contenido del mensaje a enviar',
        },
        reason: {
          type: 'string',
          description: 'Razón para bloqueo de fechas u otras operaciones',
        },
        status: {
          type: 'string',
          description: 'Filtro de estado para reservas (confirmed, cancelled, pending, etc.)',
        },
      },
      required: ['operation'],
    },
  },

  // ─── HMS DB TOOL ──────────────────────────────────────────────────────────

  {
    name: 'hms_db_tool',
    description: `Accede y modifica la base de datos operacional de HMS OS (Supabase).
Úsalo para consultar tablas internas, registrar información operativa, y mantener la fuente de verdad del sistema.
Operaciones:
- query: SELECT con filtros (nunca modifica datos)
- insert: Inserta nuevos registros
- update: Actualiza registros existentes (con validación)
- get_properties: Tabla maestra de propiedades HMS
- get_audit_log: Últimos registros de auditoría`,
    input_schema: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['query', 'insert', 'update', 'get_properties', 'get_audit_log'],
          description: 'La operación a ejecutar',
        },
        table: {
          type: 'string',
          description: 'Nombre de la tabla (para query/insert/update)',
        },
        filters: {
          type: 'object',
          description: 'Filtros para la consulta (columna: valor)',
        },
        data: {
          type: 'object',
          description: 'Datos para insert o update',
        },
        limit: {
          type: 'number',
          description: 'Límite de resultados (default: 50)',
        },
        order_by: {
          type: 'string',
          description: 'Campo para ordenar resultados',
        },
        ascending: {
          type: 'boolean',
          description: 'Orden ascendente (default: false)',
        },
      },
      required: ['operation'],
    },
  },

  // ─── PRICING TOOL ─────────────────────────────────────────────────────────

  {
    name: 'pricing_tool',
    description: `Gestiona precios de propiedades HMS. NUNCA aplica cambios sin mostrar preview y recibir aprobación explícita de Oscar.
Operaciones:
- get_current_pricing: Precios actuales de una propiedad
- preview_change: Genera preview de cambio de precios (NUNCA aplica el cambio)
- apply_change: Aplica cambio previamente aprobado (SIEMPRE requiere aprobación)
- rollback: Revierte al precio anterior`,
    input_schema: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['get_current_pricing', 'preview_change', 'apply_change', 'rollback'],
          description: 'La operación a ejecutar',
        },
        property_id: {
          type: 'string',
          description: 'ID de la propiedad',
        },
        platform: {
          type: 'string',
          description: 'Plataforma (airbnb, booking, vrbo, etc.)',
        },
        new_pricing: {
          type: 'object',
          description: 'Nuevos precios a aplicar (para preview_change y apply_change)',
          properties: {
            base_price: { type: 'number' },
            weekend_price: { type: 'number' },
            min_nights: { type: 'number' },
            currency: { type: 'string' },
          },
        },
        reason: {
          type: 'string',
          description: 'Justificación del cambio de precio',
        },
      },
      required: ['operation', 'property_id'],
    },
  },

  // ─── DOCS TOOL ────────────────────────────────────────────────────────────

  {
    name: 'docs_tool',
    description: `Genera documentos operativos: owner statements, reportes de mantenimiento, guías de huéspedes, contratos.
Los owner statements deben revisarse antes de enviar.
Operaciones:
- generate_owner_statement: Estado de cuenta para propietario (requiere revisión)
- generate_maintenance_report: Reporte de mantenimiento
- generate_guest_guide: Guía de bienvenida para huéspedes
- generate_expense_report: Reporte de gastos por período`,
    input_schema: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: [
            'generate_owner_statement',
            'generate_maintenance_report',
            'generate_guest_guide',
            'generate_expense_report',
          ],
          description: 'El documento a generar',
        },
        property_id: {
          type: 'string',
          description: 'ID de la propiedad',
        },
        period_start: {
          type: 'string',
          description: 'Inicio del período (YYYY-MM-DD)',
        },
        period_end: {
          type: 'string',
          description: 'Fin del período (YYYY-MM-DD)',
        },
        include_details: {
          type: 'boolean',
          description: 'Incluir desglose detallado',
        },
        language: {
          type: 'string',
          enum: ['es', 'en'],
          description: 'Idioma del documento (default: es)',
        },
      },
      required: ['operation', 'property_id'],
    },
  },

  // ─── FINANCE TOOL ─────────────────────────────────────────────────────────

  {
    name: 'finance_tool',
    description: `Gestiona finanzas de Host My Spot: ingresos, gastos, net payouts, reportes.
Gastos > USD 200 requieren aprobación del propietario.
Operaciones:
- get_revenue: Ingresos por propiedad y período
- get_expenses: Gastos registrados con filtros
- calculate_net_payout: Calcula pago neto al propietario
- create_expense: Registra un nuevo gasto
- get_summary: Resumen financiero consolidado`,
    input_schema: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: [
            'get_revenue',
            'get_expenses',
            'calculate_net_payout',
            'create_expense',
            'get_summary',
          ],
          description: 'La operación financiera',
        },
        property_id: {
          type: 'string',
          description: 'ID de la propiedad (opcional para consolidado)',
        },
        period_start: {
          type: 'string',
          description: 'Inicio del período (YYYY-MM-DD)',
        },
        period_end: {
          type: 'string',
          description: 'Fin del período (YYYY-MM-DD)',
        },
        expense: {
          type: 'object',
          description: 'Datos del gasto (para create_expense)',
          properties: {
            category: { type: 'string' },
            description: { type: 'string' },
            amount: { type: 'number' },
            currency: { type: 'string' },
            vendor: { type: 'string' },
            date: { type: 'string' },
          },
        },
        currency: {
          type: 'string',
          description: 'Moneda para cálculos (default: USD)',
        },
      },
      required: ['operation'],
    },
  },

  // ─── SYSTEM TOOL ──────────────────────────────────────────────────────────

  {
    name: 'system_tool',
    description: `Operaciones del sistema HMS OS: estado, configuración, audit log, métricas.
Operaciones:
- get_status: Estado general del sistema HMS OS
- get_audit_log: Últimas entradas del log de auditoría
- get_properties_summary: Resumen de propiedades activas`,
    input_schema: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['get_status', 'get_audit_log', 'get_properties_summary'],
          description: 'La operación del sistema',
        },
        limit: {
          type: 'number',
          description: 'Límite de resultados (para audit_log)',
        },
      },
      required: ['operation'],
    },
  },
];
