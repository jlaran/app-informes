import { Controller, Get, Injectable, Query } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { Prisma } from '@informes/db';
import { normalizeText, normalizeCedula } from '@informes/shared';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PaginationQuery, paginated, type Paginated } from '../../common/pagination.js';

class DissolutionQuery extends PaginationQuery {
  @IsOptional() @IsString() cedulaJuridica?: string;
  @IsOptional() @IsString() name?: string;
}

@Injectable()
class DissolutionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: DissolutionQuery): Promise<Paginated<unknown>> {
    const where: Prisma.DissolvedCompanyWhereInput = {};
    if (q.cedulaJuridica) where.cedulaJuridicaNorm = normalizeCedula(q.cedulaJuridica);
    if (q.name) where.companyNameNorm = { contains: normalizeText(q.name) };

    const [rows, total] = await Promise.all([
      this.prisma.client.dissolvedCompany.findMany({
        where,
        include: { notice: { select: { publishedAt: true, expediente: true, despacho: true } } },
        orderBy: { notice: { publishedAt: 'desc' } },
        skip: q.skip,
        take: q.pageSize,
      }),
      this.prisma.client.dissolvedCompany.count({ where }),
    ]);

    const data = rows.map((r) => ({
      id: r.id,
      noticeId: r.noticeId,
      companyName: r.companyName,
      cedulaJuridica: r.cedulaJuridica,
      dissolutionType: r.dissolutionType,
      publishedAt: r.notice.publishedAt,
      expediente: r.notice.expediente,
      despacho: r.notice.despacho,
    }));

    return paginated(data, total, q);
  }
}

@Controller('dissolutions')
class DissolutionsController {
  constructor(private readonly service: DissolutionsService) {}

  @Get()
  list(@Query() query: DissolutionQuery) {
    return this.service.list(query);
  }
}

@Module({
  controllers: [DissolutionsController],
  providers: [DissolutionsService],
})
export class DissolutionsModule {}
