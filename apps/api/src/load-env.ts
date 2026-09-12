/**
 * Carga el archivo .env del monorepo en desarrollo. Busca hacia arriba desde el
 * directorio actual (turbo ejecuta las tareas con cwd = carpeta del paquete).
 *
 * DEBE importarse ANTES que cualquier módulo que lea process.env o instancie el
 * cliente Prisma (@informes/db lo crea al importarse). En AWS las variables las
 * inyecta el entorno, así que la ausencia de .env es inofensiva.
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
