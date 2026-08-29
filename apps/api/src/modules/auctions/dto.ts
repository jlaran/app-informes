import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PaginationQuery } from '../../common/pagination.js';

/** Filtros de remates de propiedades (precios en unidad MAYOR: colones/dólares). */
export class PropertyQuery extends PaginationQuery {
  @IsOptional() @IsString() provincia?: string;
  @IsOptional() @IsString() canton?: string;
  @IsOptional() @IsString() distrito?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) priceMin?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) priceMax?: number;

  @IsOptional() @Type(() => Number) @Min(0) areaMin?: number;
  @IsOptional() @Type(() => Number) @Min(0) areaMax?: number;
}

/** Filtros de remates de vehículos. */
export class VehicleQuery extends PaginationQuery {
  @IsOptional() @IsString() brand?: string;
  @IsOptional() @Type(() => Number) @IsInt() yearMin?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) priceMin?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) priceMax?: number;
}
