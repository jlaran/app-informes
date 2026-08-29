import { Controller, Get, Injectable, Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check() {
    let db = 'ok';
    try {
      await this.prisma.client.$queryRaw`SELECT 1`;
    } catch {
      db = 'error';
    }
    return { status: db === 'ok' ? 'ok' : 'degraded', db, ts: new Date().toISOString() };
  }
}

@Controller('health')
class HealthController {
  constructor(private readonly service: HealthService) {}

  @Get()
  check() {
    return this.service.check();
  }
}

@Module({
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
