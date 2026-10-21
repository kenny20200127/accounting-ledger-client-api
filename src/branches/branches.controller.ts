import {
    Body,
    Controller,
    Get,
    Param,
    ParseUUIDPipe,
    Post,
    Query,
} from '@nestjs/common';
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';

@Controller('branches')
export class BranchesController {
    constructor(private readonly branchesService: BranchesService) { }

    @Post()
    create(@Body() dto: CreateBranchDto) {
        return this.branchesService.create(dto);
    }

    @Get()
    findAll(
        @Query('companyId', new ParseUUIDPipe({ version: '4' })) companyId: string,
    ) {
        return this.branchesService.findAll(companyId);
    }

    @Get(':id')
    findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
        return this.branchesService.findOne(id);
    }
}