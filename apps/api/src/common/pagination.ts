import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/** Query params de paginación comunes a todos los listados. */
export class PaginationQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  get skip(): number {
    return (this.page - 1) * this.pageSize;
  }
}

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

export function paginated<T>(data: T[], total: number, q: PaginationQuery): Paginated<T> {
  return { data, total, page: q.page, pageSize: q.pageSize };
}

/**
 * Serializa BigInt (basePrice en céntimos) a number para JSON. Los montos caben
 * de sobra en un number de JS (< 2^53). Úsese al mapear filas a la respuesta.
 */
export function serializeAmount(v: bigint | null | undefined): number | null {
  return v == null ? null : Number(v);
}
