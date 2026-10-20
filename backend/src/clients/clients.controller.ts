import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseInterceptors, UploadedFile, ParseIntPipe, DefaultValuePipe,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { AddKycDocumentDto } from './dto/add-kyc-document.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireFeature } from '../common/decorators/feature.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole, FeatureKey, AuthenticatedUser } from '@mfi/shared';

@Controller('clients')
@RequireFeature(FeatureKey.LOANS)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  @Roles(UserRole.TENANT_ADMIN, UserRole.BRANCH_MANAGER, UserRole.LOAN_OFFICER)
  create(@Body() dto: CreateClientDto) {
    return this.clientsService.create(dto);
  }

  @Get()
  list(
    @Query('search') search?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit = 20,
  ) {
    return this.clientsService.list(search, page, Math.min(limit, 100));
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.clientsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.TENANT_ADMIN, UserRole.BRANCH_MANAGER, UserRole.LOAN_OFFICER)
  update(@Param('id') id: string, @Body() dto: UpdateClientDto) {
    return this.clientsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.TENANT_ADMIN, UserRole.BRANCH_MANAGER)
  softDelete(@Param('id') id: string) {
    return this.clientsService.softDelete(id);
  }

  @Get(':id/kyc')
  listKyc(@Param('id') id: string) {
    return this.clientsService.listKyc(id);
  }

  @Post(':id/kyc')
  @Roles(UserRole.TENANT_ADMIN, UserRole.BRANCH_MANAGER, UserRole.LOAN_OFFICER)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  addKyc(
    @Param('id') id: string,
    @Body() dto: AddKycDocumentDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.clientsService.addKycDocument(id, dto, file);
  }

  @Get(':id/kyc/:docId/url')
  getKycUrl(@Param('id') id: string, @Param('docId') docId: string) {
    return this.clientsService.getKycDownloadUrl(id, docId);
  }

  @Post(':id/kyc/:docId/verify')
  @Roles(UserRole.TENANT_ADMIN, UserRole.BRANCH_MANAGER)
  verifyKyc(
    @Param('id') id: string,
    @Param('docId') docId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clientsService.verifyKyc(id, docId, user.id);
  }
}
