/**
 * Carga el .env del monorepo para ejecuciones locales (local-run.ts). Debe
 * importarse ANTES que @informes/db (que instancia Prisma al importarse). En
 * Lambda/Fargate las variables las inyecta el entorno; el .env es solo local.
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { config } from 'dotenv';

let dir = process.cwd();
for (let i = 0; i < 6; i++) {
  const candidate = join(dir, '.env');
  if (existsSync(candidate)) {
    config({ path: candidate });
    break;
  }
  const parent = dirname(dir);
  if (parent === dir) break;
  dir = parent;
}
