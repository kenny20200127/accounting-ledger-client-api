import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { CompanyListQueryDto } from '../../common/company-list-query.dto';

export class AccountListQueryDto extends CompanyListQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(30)
  type?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  postable?: 'true' | 'false';

  @IsOptional()
  @IsUUID()
  mainAccountId?: string;
}
