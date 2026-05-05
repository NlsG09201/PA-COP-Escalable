import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OdontogramModule } from '../odontogram/odontogram.module';
import { Ortho3dController } from './ortho-3d.controller';
import { Ortho3dService } from './ortho-3d.service';
import { Ortho3dJob, Ortho3dJobSchema } from './schemas/ortho-3d-job.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Ortho3dJob.name, schema: Ortho3dJobSchema }]),
    OdontogramModule,
  ],
  controllers: [Ortho3dController],
  providers: [Ortho3dService],
  exports: [Ortho3dService],
})
export class Ortho3dModule {}

