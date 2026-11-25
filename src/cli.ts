#!/usr/bin/env node
// cli.ts — point d'entrée : `bridge [--port N]`. Mode simulation par défaut. `--real` est reconnu et REFUSÉ en v1.
import { parseArgs } from './args.js';
import { DEFAULT_DATA_DIR, Stop } from './core.js';
import { HOST, startBridge } from './server.js';

async function main() {
  let args;
  try { args = parseArgs(process.argv.slice(2)); }
  catch (e) {
    const s = e as Stop;
    if (s.code === 'AIDE') { console.log(s.detail); return; }
    console.error(`[Bridge] REFUS ${s.code} : ${s.detail}`);
    process.exitCode = 2; return;
  }
  try {
    const b = await startBridge({ dataDir: DEFAULT_DATA_DIR, port: args.port, stepDelayMs: 400 });
    console.log(`[Bridge] Mode SIMULATION. Interface : http://${HOST}:${b.port}/  (Ctrl+C pour arrêter)`);
    console.log(`[Bridge] Données des missions : ${DEFAULT_DATA_DIR}`);
    const shutdown = () => { console.log('[Bridge] Arrêt.'); void b.close().then(() => process.exit(0)); };
    process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
  } catch (e) {
    const err = e as NodeJS.ErrnoException & { code?: string; detail?: string };
    if (err.code === 'EADDRINUSE') console.error(`[Bridge] Le port ${args.port} est déjà utilisé. Essayez : bridge --port 4318`);
    else console.error(`[Bridge] Démarrage impossible : ${err.code ?? ''} ${err.detail ?? err.message}`);
    process.exitCode = 2;
  }
}

void main();
