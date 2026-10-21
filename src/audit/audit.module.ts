import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErrorLog } from './error-log.entity';
import { ErrorLogService } from './error-log.service';
import { ErrorRecorder } from './error-recorder';
import { GlobalExceptionFilter } from './global-exception.filter';

@Module({
  imports: [TypeOrmModule.forFeature([ErrorLog])],
  providers: [
    ErrorLogService,
    { provide: ErrorRecorder, useClass: ErrorLogService },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
  exports: [ErrorRecorder],
})
export class AuditModule {}
