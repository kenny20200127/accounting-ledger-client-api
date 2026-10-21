import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Account } from '../accounts/account.entity';
import { AccountingPeriod } from '../accounting-periods/accounting-period.entity';
import { Company } from '../companies/company.entity';
import { JournalEntry } from '../journals/journal-entry.entity';
import { AssetDepreciation } from './asset-depreciation.entity';
import { FixedAsset } from './fixed-asset.entity';
import { FixedAssetsController } from './fixed-assets.controller';
import { FixedAssetsService } from './fixed-assets.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([
			FixedAsset,
			AssetDepreciation,
			Company,
			Account,
			AccountingPeriod,
			JournalEntry,
		]),
	],
	controllers: [FixedAssetsController],
	providers: [FixedAssetsService],
	exports: [FixedAssetsService],
})
export class FixedAssetsModule {}
