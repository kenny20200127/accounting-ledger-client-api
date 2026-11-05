import { IsOptional, IsUUID } from 'class-validator';
import { CompanyListQueryDto } from '../../common/company-list-query.dto';

export class MainAccountListQueryDto extends CompanyListQueryDto {
  @IsOptional()
  @IsUUID()
  accountTypeId?: string;
}
