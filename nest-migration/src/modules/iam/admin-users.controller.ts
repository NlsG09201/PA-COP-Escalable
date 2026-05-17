import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { IamService } from './iam.service';
import { AssignRoleDto } from './dto/assign-role.dto';

@ApiTags('admin-users')
@ApiBearerAuth()
@Controller('api/admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminUsersController {
  constructor(private readonly iamService: IamService) {}

  @Get()
  @Roles('ADMIN', 'SUPER_ADMIN')
  listUsers(@Query('search') search?: string, @Query('limit') limit?: string) {
    return this.iamService.listUsersForAdmin(search, limit ? Number(limit) : 50);
  }

  @Post('assign-role')
  @Roles('ADMIN', 'SUPER_ADMIN')
  assignRole(@Req() req: Request, @Body() dto: AssignRoleDto) {
    return this.iamService.assignRoleToUser(req.user as any, dto);
  }
}
