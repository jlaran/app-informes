/**
 * Runner local para desarrollo. Permite ejecutar las fases sin AWS:
 *   pnpm --filter @informes/ingestion download   # lista/descarga ediciones
 *   pnpm --filter @informes/ingestion parse <archivo.pdf|texto.txt> <numero>
 *
 * Requiere DATABASE_URL apuntando a una BD local con el esquema migrado.
 */
import './load-env.js'; // debe ir primero: carga .env antes de instanciar Prisma
import { readFile } from 'node:fs/promises';
import { prisma } from '@informes/db';
import { extractText } from './pdf/extract-text.js';
import { parseBoletin } from './parser/index.js';
import { matchNotices } from './matcher/alert-matcher.js';
import { handler as downloadHandler } from './handlers/download.js';

async function main() {
  const [, , cmd, ...args] = process.argv;

  switch (cmd) {
    case 'download': {
      const res = await downloadHandler();
      console.log(res);
      break;
    }
    case 'match-all': {
      // Evalúa TODAS las alertas activas contra todos los avisos (útil en dev).
      const ids = (await prisma.notice.findMany({ select: { id: true } })).map((n) => n.id);
      const matchIds = await matchNotices(ids);
      console.log(`Avisos evaluados: ${ids.length} | Coincidencias creadas: ${matchIds.length}`);
      break;
    }
    case 'parse': {
      const path = args[0];
      const numero = args[1] ?? `local-${Date.now()}`;
      if (!path) throw new Error('Uso: parse <archivo.pdf|.txt> <numero>');

      const boletin = await prisma.boletin.create({
        data: { numero, publishedAt: new Date(), status: 'PARSING' },
      });

      let text: string;
      if (path.endsWith('.pdf')) {
        const bytes = await readFile(path);
        text = (await extractText(new Uint8Array(bytes))).text;
      } else {
        text = await readFile(path, 'utf8');
      }

      const result = await parseBoletin(boletin.id, text, boletin.publishedAt);
      console.log('Parse:', result);

      const matchIds = await matchNotices(result.createdNoticeIds);
      console.log('Coincidencias:', matchIds.length);
      break;
    }
    default:
      console.log('Comandos: download | parse <archivo> <numero> | match-all');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
