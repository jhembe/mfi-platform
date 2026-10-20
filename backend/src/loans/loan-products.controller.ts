import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { LoanProductsService } from './loan-products.service';
import { CreateLoanProductDto } from './dto/create-loan-product.dto';
import { UpdateLoanProductDto } from './dto/update-loan-product.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireFeature } from '../common/decorators/feature.decorator';
import { UserRole, FeatureKey } from '@mfi/shared';

@Controller('loan-products')
@RequireFeature(FeatureKey.LOANS)
export class LoanProductsController {
  constructor(private readonly loanProductsService: LoanProductsService) {}

  @Post()
  @Roles(UserRole.TENANT_ADMIN, UserRole.BRANCH_MANAGER)
  create(@Body() dto: CreateLoanProductDto) {
    return this.loanProductsService.create(dto);
  }

  @Get()
  list(@Query('all') all?: string) {
    return this.loanProductsService.list(all !== 'true');
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.loanProductsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.TENANT_ADMIN, UserRole.BRANCH_MANAGER)
  update(@Param('id') id: string, @Body() dto: UpdateLoanProductDto) {
    return this.loanProductsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.TENANT_ADMIN)
  deactivate(@Param('id') id: string) {
    return this.loanProductsService.deactivate(id);
  }
}
