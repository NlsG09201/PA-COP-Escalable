import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { IamModule } from './modules/iam/iam.module';
import { PatientsModule } from './modules/patients/patients.module';
import { ClinicalModule } from './modules/clinical/clinical.module';
import { TenancyModule } from './modules/tenancy/tenancy.module';
import { SimulationModule } from './modules/simulation/simulation.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { OdontogramModule } from './modules/odontogram/odontogram.module';
import { HealthController } from './health.controller';
import { OrthoXrayModule } from './modules/ortho-xray/ortho-xray.module';
import { Ortho3dModule } from './modules/ortho-3d/ortho-3d.module';
import { J48ScoringModule } from './modules/j48-scoring/j48-scoring.module';
import { AnalyticsDashboardModule } from './modules/analytics-dashboard/analytics-dashboard.module';
import { PublicSiteModule } from './modules/public-site/public-site.module';
import { ServicesModule } from './modules/services/services.module';
import { OdontologyModule } from './modules/odontology/odontology.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGODB_URL'),
      }),
      inject: [ConfigService],
    }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
    TenancyModule,
    IamModule,
    PatientsModule,
    ClinicalModule,
    SimulationModule,
    AppointmentsModule,
    OdontogramModule,
    OrthoXrayModule,
    Ortho3dModule,
    J48ScoringModule,
    AnalyticsDashboardModule,
    PublicSiteModule,
    ServicesModule,
    OdontologyModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
