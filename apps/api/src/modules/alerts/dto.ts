import { IsBoolean, IsEnum, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AlertChannel, NoticeCategory } from '@informes/shared';

export class CreateAlertDto {
  @IsString() @MinLength(1) @MaxLength(120) name!: string;

  @IsEnum(NoticeCategory) category!: NoticeCategory;

  @IsOptional() @IsEnum(AlertChannel) channel?: AlertChannel;

  /** Criterios crudos; se validan con el esquema Zod según la categoría. */
  @IsObject() criteria!: Record<string, unknown>;
}

export class UpdateAlertDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) name?: string;
  @IsOptional() @IsEnum(AlertChannel) channel?: AlertChannel;
  @IsOptional() @IsObject() criteria?: Record<string, unknown>;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
