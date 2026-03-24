#!/usr/bin/env node
/**
 * HMS OS — Host My Spot Operating System
 * FRANK: Orchestrador principal
 *
 * Uso: npm run frank
 *      node dist/index.js
 */

import * as readline from 'readline';
import { Frank } from './agents/frank.js';

const BANNER = `
╔═══════════════════════════════════════════════════════╗
║          HMS OS — Host My Spot Operating System       ║
║          FRANK · Orchestrador Principal               ║
║          v1.0.0 · claude-opus-4-6                    ║
╚═══════════════════════════════════════════════════════╝

Comandos especiales:
  /reset   — Reiniciar conversación
  /status  — Estado del sistema
  /exit    — Salir

FRANK listo. Ingresa tu instrucción.
`;

async function main() {
  console.log(BANNER);

  let frank: Frank;

  try {
    frank = new Frank();
  } catch (err) {
    console.error('❌ Error inicializando FRANK:', err instanceof Error ? err.message : err);
    console.error('Verifica que las variables de entorno estén configuradas (.env)');
    process.exit(1);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '\nOscar → ',
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();

    if (!input) {
      rl.prompt();
      return;
    }

    // Special commands
    if (input === '/exit' || input === '/quit') {
      console.log('\nHMS OS apagándose. Hasta luego.\n');
      rl.close();
      process.exit(0);
    }

    if (input === '/reset') {
      frank.resetConversation();
      rl.prompt();
      return;
    }

    if (input === '/status') {
      // Quick status without using FRANK's conversation history
      console.log(`\n📊 Sistema: HMS OS | Modelo: claude-opus-4-6 | Turno: ${frank.turnCount}\n`);
      rl.prompt();
      return;
    }

    // Process with FRANK
    try {
      console.log('\n⏳ FRANK procesando...\n');
      const response = await frank.process(input);

      console.log('\n' + '─'.repeat(60));
      console.log('FRANK →\n');
      console.log(response);
      console.log('─'.repeat(60));
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`\n❌ Error en FRANK: ${errMsg}\n`);

      // If auth error, provide guidance
      if (errMsg.includes('API key') || errMsg.includes('authentication')) {
        console.error('Verifica ANTHROPIC_API_KEY en tu archivo .env\n');
      }
    }

    rl.prompt();
  });

  rl.on('close', () => {
    console.log('\nHMS OS cerrado.\n');
    process.exit(0);
  });

  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    console.log('\n\nInterrumpido. HMS OS cerrando...\n');
    rl.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('Error fatal:', err);
  process.exit(1);
});
