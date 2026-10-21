import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CreateAssetDepreciationDto } from './dto/create-asset-depreciation.dto';
import { CreateFixedAssetDto } from './dto/create-fixed-asset.dto';
import { FixedAssetsService } from './fixed-assets.service';

@Controller('fixed-assets')
export class FixedAssetsController {
  constructor(private readonly fixedAssetsService: FixedAssetsService) {}

  @Post()
  create(@Body() dto: CreateFixedAssetDto) {
    return this.fixedAssetsService.create(dto);
  }

  @Get()
  findAll(
    @Query('companyId', new ParseUUIDPipe({ version: '4' })) companyId: string,
  ) {
    return this.fixedAssetsService.findAll(companyId);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.fixedAssetsService.findOne(id);
  }

  @Post(':id/depreciations')
  createDepreciation(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CreateAssetDepreciationDto,
  ) {
    return this.fixedAssetsService.createDepreciation(id, dto);
  }

  @Get(':id/depreciations')
  findDepreciations(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.fixedAssetsService.findDepreciations(id);
  }
}