# HMS OS — Host My Spot Operating System

**FRANK** es el agente orquestador principal de Host My Spot. Opera, automatiza, audita y protege la operación de la empresa usando Claude Opus 4.6 como cerebro y un conjunto de tools especializadas.

## Arquitectura

```
HMS-CLAW-AGENCY/
├── src/
│   ├── index.ts              # CLI entry point
│   ├── config.ts             # Environment config
│   ├── types/index.ts        # TypeScript types
│   ├── lib/
│   │   ├── audit.ts          # Audit logging → Supabase
│   │   └── approval.ts       # Approval workflow (CLI/webhook)
│   ├── tools/
│   │   ├── definitions.ts    # Tool definitions para Claude API
│   │   └── handlers/
│   │       ├── hostex.ts     # Hostex API (propiedades, reservas, mensajes)
│   │       ├── database.ts   # Supabase (tablas operacionales)
│   │       ├── pricing.ts    # Pricing (preview + approval)
│   │       ├── docs.ts       # Generación de documentos
│   │       ├── finance.ts    # Finanzas y estados de cuenta
│   │       ├── system.ts     # Estado del sistema y audit log
│   │       └── index.ts      # Tool router + approval gate
│   └── agents/
│       └── frank.ts          # FRANK orchestrator (agentic loop)
└── supabase/
    └── migrations/
        └── 001_hms_os_schema.sql   # Schema inicial de DB
```

## Setup

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
# Editar .env con tus credenciales:
# - ANTHROPIC_API_KEY
# - SUPABASE_URL + SUPABASE_SERVICE_KEY
# - HOSTEX_API_KEY
```

### 3. Crear tablas en Supabase

Ejecutar el archivo `supabase/migrations/001_hms_os_schema.sql` en tu proyecto Supabase.

### 4. Iniciar FRANK

```bash
npm run frank
# o
npm run dev
```

## Uso

```
╔═══════════════════════════════════════════════════════╗
║          HMS OS — Host My Spot Operating System       ║
║          FRANK · Orchestrador Principal               ║
╚═══════════════════════════════════════════════════════╝

Oscar → ver propiedades activas
Oscar → revisar reservas de esta semana en [propiedad]
Oscar → generar estado de cuenta de enero para [propiedad]
Oscar → mostrar los últimos 20 registros del audit log
```

### Comandos especiales

| Comando  | Descripción              |
|----------|--------------------------|
| `/reset` | Reinicia la conversación |
| `/status`| Estado del sistema       |
| `/exit`  | Salir                    |

## Tools Disponibles

| Tool | Descripción |
|------|-------------|
| `hostex_tool` | API Hostex: propiedades, reservas, calendario, mensajes, huéspedes |
| `hms_db_tool` | Supabase: consultas y escritura en tablas operacionales |
| `pricing_tool` | Precios: preview + apply (requiere aprobación) |
| `docs_tool` | Generación de documentos: statements, reportes, guías |
| `finance_tool` | Finanzas: ingresos, gastos, net payouts |
| `system_tool` | Estado del sistema y audit log |

## Reglas de Negocio Críticas

- **NUNCA** modifica precios sin preview + aprobación de Oscar
- **NUNCA** cancela reservas sin aprobación explícita
- **NUNCA** envía mensajes de queja/reclamo sin aprobación
- **SIEMPRE** registra en `audit_log` cada acción importante
- Gastos > USD 200 → requieren aprobación del propietario
- Acciones irreversibles → requieren confirmación

## Modelo

FRANK usa **Claude Opus 4.6** con **adaptive thinking** para análisis complejo y toma de decisiones.

---

**Host My Spot** · `hostmyspot.com.do` · Oscar Nadal · `otainadal@gmail.com`
