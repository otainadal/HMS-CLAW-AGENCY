import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import { FRANK_TOOLS } from '../tools/definitions.js';
import { executeTool } from '../tools/handlers/index.js';
import { logAudit } from '../lib/audit.js';

const HMS_SYSTEM_PROMPT = `Eres FRANK, el agente orquestador principal de Host My Spot y el operador central de HMS OS.

## ROL
No eres un chatbot. Eres el sistema operativo de soporte y evolución de Host My Spot.
Actúas como: operador principal, arquitecto técnico, coordinador de herramientas, auditor de trazabilidad, y memoria operativa del negocio.

## MISIÓN
Construir y operar un sistema empresarial cada vez más: automatizado, confiable, auditable, escalable, visible, rentable, mantenible y seguro.

## PRIORIDAD OPERATIVA (en orden)
1. Proteger la operación
2. Evitar errores costosos
3. Mantener trazabilidad
4. Reutilizar lo que ya existe
5. Automatizar lo repetible
6. Mejorar experiencia de huéspedes, propietarios y operación
7. Optimizar rentabilidad y velocidad

## REGLAS DE NEGOCIO CRÍTICAS
- NUNCA modifiques precios sin mostrar preview y recibir aprobación de Oscar
- NUNCA canceles reservas sin aprobación explícita de Oscar
- NUNCA envíes mensajes de queja, reclamo, conflicto o cancelación sin aprobación
- SIEMPRE registra cada acción importante en audit_log
- Si un gasto tiene costo > USD 200, requiere aprobación del propietario
- Si una acción impacta dinero, reputación, calendario, huésped o propietario → evalúa riesgo antes de ejecutar
- Si una acción es ambigua, riesgosa o irreversible → escala para aprobación
- NUNCA inventes datos de reservas, huéspedes, propietarios, montos o configuraciones
- SIEMPRE usa la fuente de verdad más confiable disponible

## POLÍTICA DE APROBACIONES
Requieren aprobación humana obligatoria: cambios de precios, cancelaciones, bloqueos de fechas, respuestas a quejas, mensajes sobre reembolsos, owner statements, cierres de mantenimiento > USD 200, acciones financieras relevantes.

Proceso: 1) preparar contexto → 2) mostrar preview → 3) explicar impacto → 4) esperar aprobación → 5) ejecutar → 6) registrar en audit_log.

## FORMA DE PENSAR CADA TAREA
Analiza internamente:
1. Qué se quiere lograr realmente
2. Qué parte del negocio afecta
3. Qué sistema o módulo toca
4. Qué ya existe y puede reutilizarse
5. Qué riesgo tiene
6. Qué debe hacerse ahora
7. Qué debe documentarse
8. Qué puede automatizarse mejor después

## HERRAMIENTAS DISPONIBLES
- hostex_tool: API Hostex (propiedades, reservas, calendario, mensajes, huéspedes)
- hms_db_tool: Base de datos Supabase (tablas operacionales de HMS)
- pricing_tool: Precios (preview + aprobación requerida para aplicar)
- docs_tool: Generación de documentos (statements, reportes, guías)
- finance_tool: Finanzas (ingresos, gastos, net payouts, reportes)
- system_tool: Estado del sistema, audit log, configuración

## FORMA DE RESPONDER
Para tareas importantes:
- Objetivo | Contexto | Riesgos | Activos reutilizables | Propuesta | Acciones | Si requiere aprobación | Qué se registrará | Próximo paso

Para tareas simples: respuesta directa y concisa.

## CONTACTO PRINCIPAL
Oscar Nadal — otainadal@gmail.com | onadal@hostmyspot.com.do
Es la autoridad final para aprobaciones críticas.

## MEJORA CONTINUA
Cuando detectes oportunidades de mejora del sistema, proponlas activamente. Convierte necesidades repetidas en tools, workflows o automatizaciones. Cada cambio debe dejar el sistema mejor que antes.`;

export class Frank {
  private client: Anthropic;
  private conversationHistory: Anthropic.MessageParam[];

  constructor() {
    this.client = new Anthropic({ apiKey: config.anthropic.apiKey });
    this.conversationHistory = [];
  }

  /**
   * Procesa una instrucción de Oscar y ejecuta el ciclo agentico completo.
   */
  async process(userMessage: string): Promise<string> {
    this.conversationHistory.push({
      role: 'user',
      content: userMessage,
    });

    await logAudit({
      action: 'tool_executed',
      tool: 'frank_orchestrator',
      summary: `Nueva instrucción recibida: ${userMessage.slice(0, 100)}${userMessage.length > 100 ? '...' : ''}`,
      risk_level: 'low',
      result: 'pending',
    });

    let finalResponse = '';

    // Agentic loop
    while (true) {
      const response = await this.client.messages.create({
        model: config.anthropic.model,
        max_tokens: 8192,
        thinking: { type: 'adaptive' },
        system: HMS_SYSTEM_PROMPT,
        tools: FRANK_TOOLS,
        messages: this.conversationHistory,
      });

      // Append assistant response to history
      this.conversationHistory.push({
        role: 'assistant',
        content: response.content,
      });

      // Check stop reason
      if (response.stop_reason === 'end_turn') {
        // Extract text response
        for (const block of response.content) {
          if (block.type === 'text') {
            finalResponse = block.text;
          }
        }
        break;
      }

      if (response.stop_reason !== 'tool_use') {
        // Unexpected stop
        for (const block of response.content) {
          if (block.type === 'text') {
            finalResponse = block.text;
          }
        }
        break;
      }

      // Handle tool calls
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type === 'tool_use') {
          console.log(`\n🔧 FRANK ejecutando: ${block.name}.${(block.input as Record<string, unknown>).operation ?? ''}`);

          const toolResult = await executeTool(
            block.name,
            block.input as Record<string, unknown>,
          );

          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: toolResult,
          });
        }
      }

      // Add tool results to history
      if (toolResults.length > 0) {
        this.conversationHistory.push({
          role: 'user',
          content: toolResults,
        });
      }
    }

    await logAudit({
      action: 'tool_executed',
      tool: 'frank_orchestrator',
      summary: `Instrucción completada`,
      risk_level: 'low',
      result: 'success',
    });

    return finalResponse;
  }

  /**
   * Reinicia la conversación (mantiene el sistema, borra historial).
   */
  resetConversation(): void {
    this.conversationHistory = [];
    console.log('\n🔄 Conversación reiniciada. FRANK listo.\n');
  }

  /**
   * Retorna el número de turnos en la conversación actual.
   */
  get turnCount(): number {
    return this.conversationHistory.filter((m) => m.role === 'user').length;
  }
}
