import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/auth/auth.guard.js';
import { AlertsService } from './alerts.service.js';
import { CreateAlertDto, UpdateAlertDto } from './dto.js';

/** Endpoints tenant-scoped de alertas. Requieren autenticación. */
@Controller('alerts')
@UseGuards(AuthGuard)
export class AlertsController {
  constructor(private readonly service: AlertsService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Get('matches')
  matches() {
    return this.service.matches();
  }

  @Post()
  create(@Body() dto: CreateAlertDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAlertDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
