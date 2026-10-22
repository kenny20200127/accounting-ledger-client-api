import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Controller, Get, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { LegacyReportsService } from './legacy-reports.service';

export class LegacySummaryQuery {
  @IsUUID() companyId: string;
}
export class LegacyIssuesQuery extends LegacySummaryQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit = 50;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset = 0;
}
// Global JwtAuthGuard and MenuAccessGuard require authenticated REPORTS.canView.
// These endpoints expose counts and accounting issues, never raw source records.
@ApiTags('reports/legacy-migration')
@ApiBearerAuth()
@Controller('reports/legacy-migration')
export class LegacyReportsController {
  constructor(private readonly service: LegacyReportsService) {}
  @Get()
  summary(@Query() query: LegacySummaryQuery) {
    return this.service.summary(query.companyId);
  }
  @Get('issues')
  issues(@Query() query: LegacyIssuesQuery) {
    return this.service.issues(query);
  }
}
