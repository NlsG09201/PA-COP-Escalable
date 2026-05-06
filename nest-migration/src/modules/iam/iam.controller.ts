import { Controller, Post, Body, HttpCode, HttpStatus, Req, UseGuards, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { IamService } from './iam.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterPublicDto } from './dto/register-public.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('auth')
@Controller('api/auth')
export class IamController {
  constructor(private readonly iamService: IamService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Public patient registration' })
  async register(@Body() dto: RegisterPublicDto, @Req() req: Request) {
    return this.iamService.registerPublicPatient(dto, req.ip, req.headers['user-agent']);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User login' })
  async login(@Body() loginDto: LoginDto, @Req() req: Request) {
    return this.iamService.login(loginDto, req.ip, req.headers['user-agent']);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout: revoke current access token' })
  async logout(@Headers('authorization') authorization?: string) {
    return this.iamService.logout(authorization);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token' })
  async refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return this.iamService.refreshToken(dto.refreshToken, req.ip, req.headers['user-agent']);
  }
}
