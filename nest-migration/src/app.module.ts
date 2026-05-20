import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
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
import { ApiCompatModule } from './modules/api-compat/api-compat.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PsychologyModule } from './modules/psychology/psychology.module';
import { AiProxyModule } from './modules/ai-proxy/ai-proxy.module';
import { MedicalAiModule } from './modules/medical-ai/medical-ai.module';
import { PaymentsIntlModule } from './modules/payments-intl/payments-intl.module';
import {
  applyNormalizedRedisUrlFromEnv,
  applyResolvedMongoUrlFromEnv,
  loadRenderSecretEnv,
} from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        () => {
          loadRenderSecretEnv();
          applyResolvedMongoUrlFromEnv();
          applyNormalizedRedisUrlFromEnv();
          return {};
        },
      ],
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGODB_URL'),
      }),
      inject: [ConfigService],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 250,
      },
    ]),
    TenancyModule,
    NotificationsModule,
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
    PsychologyModule,
    AiProxyModule,
    MedicalAiModule,
    PaymentsIntlModule,
    ApiCompatModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
