// args.ts — lecture des options de la ligne de commande.
import { Stop } from './core.js';
import { HOST } from './server.js';

export const USAGE = `Usage : bridge [--port <numéro>]
  Lance Bridge en mode SIMULATION sur http://${HOST}:<port> (port par défaut : 4317).
  --real   Mode réel : DÉSACTIVÉ dans cette version (refusé).`;

export function parseArgs(argv: string[]): { port: number } {
  let port = 4317;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--real' || a.startsWith('--real=') || a === '--reel') throw new Stop('MODE_REEL_DESACTIVE',
      "Le mode réel n'est pas activé dans cette version de Bridge. Aucun agent réel ne sera lancé. Relancez sans --real (mode simulation).");
    if (a === '--help' || a === '-h') throw new Stop('AIDE', USAGE);
    if (a === '--port') {
      const v = Number(argv[++i]);
      if (!Number.isInteger(v) || v < 1024 || v > 65535) throw new Stop('PORT_INVALIDE', `Port attendu entre 1024 et 65535. ${USAGE}`);
      port = v; continue;
    }
    throw new Stop('OPTION_INCONNUE', `${a}\n${USAGE}`);
  }
  return { port };
}

