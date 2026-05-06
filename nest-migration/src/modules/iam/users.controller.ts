import { Body, Controller, Get, Patch, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { TenancyInterceptor } from '../tenancy/tenancy.interceptor';
import { IamService } from './iam.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@ApiTags('users')
@Controller('api/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenancyInterceptor)
export class UsersController {
  constructor(private readonly iamService: IamService) {}

  @Get('me')
  async me(@Req() req: Request) {
    return this.iamService.getMyProfile(req.user as any);
  }

  @Patch('me')
  @Roles('PACIENTE', 'MEDICO', 'ADMIN', 'SUPER_ADMIN')
  async updateMe(@Req() req: Request, @Body() dto: UpdateProfileDto) {
    return this.iamService.updateMyProfile(req.user as any, dto);
  }
}

