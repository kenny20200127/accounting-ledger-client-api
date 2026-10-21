import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class CompanyListQueryDto {
  @IsUUID('4') companyId: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1000000) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
  @IsOptional() @IsString() @MaxLength(100) q?: string;
}
