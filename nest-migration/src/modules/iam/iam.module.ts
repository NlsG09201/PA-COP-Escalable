import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { IamService } from './iam.service';
import { IamController } from './iam.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { BootstrapAdminService } from './bootstrap-admin.service';

import { MongooseModule } from '@nestjs/mongoose';
import { UserAccount, UserAccountSchema } from './user-account.schema';
import { RefreshToken, RefreshTokenSchema } from './schemas/refresh-token.schema';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    MongooseModule.forFeature([
      { name: UserAccount.name, schema: UserAccountSchema },
      { name: RefreshToken.name, schema: RefreshTokenSchema },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [IamController],
  providers: [IamService, JwtStrategy, JwtAuthGuard, RolesGuard, BootstrapAdminService],
  exports: [IamService, JwtAuthGuard, RolesGuard],
})
export class IamModule {}
