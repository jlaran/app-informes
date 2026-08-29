import { Controller, Get, Injectable, Query } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { Prisma } from '@informes/db';
import { normalizeText, normalizeCedula } from '@informes/shared';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PaginationQuery, paginated, type Paginated } from '../../common/pagination.js';

class DeceasedQuery extends PaginationQuery {
  @IsOptional() @IsString() cedula?: string;
  @IsOptional() @IsString() name?: string;
}

@Injectable()
class DeceasedService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: DeceasedQuery): Promise<Paginated<unknown>> {
    const where: Prisma.DeceasedPersonWhereInput = {};
    if (q.cedula) where.cedulaNorm = normalizeCedula(q.cedula);
    if (q.name) where.fullNameNorm = { contains: normalizeText(q.name) };

    const [rows, total] = await Promise.all([
      this.prisma.client.deceasedPerson.findMany({
        where,
        include: { notice: { select: { publishedAt: true, expediente: true, despacho: true } } },
        orderBy: { notice: { publishedAt: 'desc' } },
        skip: q.skip,
        take: q.pageSize,
      }),
      this.prisma.client.deceasedPerson.count({ where }),
    ]);

    const data = rows.map((r) => ({
      id: r.id,
      noticeId: r.noticeId,
      fullName: r.fullName,
      cedula: r.cedula,
      fechaDefuncion: r.fechaDefuncion,
      sucesorioTipo: r.sucesorioTipo,
      publishedAt: r.notice.publishedAt,
      expediente: r.notice.expediente,
      despacho: r.notice.despacho,
    }));

    return paginated(data, total, q);
  }
}

@Controller('deceased')
class DeceasedController {
  constructor(private readonly service: DeceasedService) {}

  @Get()
  list(@Query() query: DeceasedQuery) {
    return this.service.list(query);
  }
}

@Module({
  controllers: [DeceasedController],
  providers: [DeceasedService],
})
export class DeceasedModule {}
