import { Controller, Get, Post, Patch, Body, Param } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, ResetPasswordDto } from './dto/user.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser, UserRole } from '@mfi/shared';

@Controller('users')
@Roles(UserRole.TENANT_ADMIN)
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.service.list(user.tenantId!);
  }

  @Get('stats')
  stats(@CurrentUser() user: AuthenticatedUser) {
    return this.service.stats(user.tenantId!);
  }

  @Post()
  create(@Body() dto: CreateUserDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(user.tenantId!, dto);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.get(user.tenantId!, id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.update(user.tenantId!, id, dto);
  }

  @Post(':id/deactivate')
  deactivate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.deactivate(user.tenantId!, id, user.id);
  }

  @Post(':id/activate')
  activate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.activate(user.tenantId!, id);
  }

  @Post(':id/reset-password')
  resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.resetPassword(user.tenantId!, id, dto);
  }
}
