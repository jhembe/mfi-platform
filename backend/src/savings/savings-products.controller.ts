import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { SavingsProductsService } from './savings-products.service';
import { CreateSavingsProductDto } from './dto/create-savings-product.dto';
import { UpdateSavingsProductDto } from './dto/update-savings-product.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireFeature } from '../common/decorators/feature.decorator';
import { UserRole, FeatureKey } from '@mfi/shared';

@Controller('savings-products')
@RequireFeature(FeatureKey.SAVINGS)
export class SavingsProductsController {
  constructor(private readonly service: SavingsProductsService) {}

  @Get()
  list(@Query('all') all?: string) {
    return this.service.list(all === 'true');
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(UserRole.TENANT_ADMIN, UserRole.BRANCH_MANAGER)
  create(@Body() dto: CreateSavingsProductDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.TENANT_ADMIN, UserRole.BRANCH_MANAGER)
  update(@Param('id') id: string, @Body() dto: UpdateSavingsProductDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.TENANT_ADMIN)
  deactivate(@Param('id') id: string) {
    return this.service.deactivate(id);
  }
}
