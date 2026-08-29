import { Controller, Get, Query } from '@nestjs/common';
import { AuctionsService } from './auctions.service.js';
import { PropertyQuery, VehicleQuery } from './dto.js';

/** Endpoints públicos de remates (plano público, sin tenant). */
@Controller('auctions')
export class AuctionsController {
  constructor(private readonly service: AuctionsService) {}

  @Get('property')
  listProperty(@Query() query: PropertyQuery) {
    return this.service.listProperty(query);
  }

  @Get('vehicle')
  listVehicle(@Query() query: VehicleQuery) {
    return this.service.listVehicle(query);
  }
}
