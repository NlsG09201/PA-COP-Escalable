import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WekaLabController } from './weka-lab.controller';
import { WekaLabService } from './weka-lab.service';
import { WekaLabDataset, WekaLabDatasetSchema } from './schemas/weka-lab-dataset.schema';
import { WekaLabModel, WekaLabModelSchema } from './schemas/weka-lab-model.schema';
import { WekaLabPrediction, WekaLabPredictionSchema } from './schemas/weka-lab-prediction.schema';
import { WekaLabAudit, WekaLabAuditSchema } from './schemas/weka-lab-audit.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WekaLabDataset.name, schema: WekaLabDatasetSchema },
      { name: WekaLabModel.name, schema: WekaLabModelSchema },
      { name: WekaLabPrediction.name, schema: WekaLabPredictionSchema },
      { name: WekaLabAudit.name, schema: WekaLabAuditSchema },
    ]),
  ],
  controllers: [WekaLabController],
  providers: [WekaLabService],
  exports: [WekaLabService],
})
export class WekaLabModule {}
