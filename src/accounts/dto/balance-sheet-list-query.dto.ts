import { IsOptional, IsUUID } from 'class-validator';
import { CompanyListQueryDto } from '../../common/company-list-query.dto';

export class BalanceSheetListQueryDto extends CompanyListQueryDto {
  @IsOptional()
  @IsUUID()
  accountTypeId?: string;
}
