import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OdontogramController } from './odontogram.controller';
import { OdontogramService } from './odontogram.service';
import { Odontogram, OdontogramSchema } from './schemas/odontogram.schema';
import { IamModule } from '../iam/iam.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Odontogram.name, schema: OdontogramSchema }]),
    IamModule,
  ],
  controllers: [OdontogramController],
  providers: [OdontogramService],
  exports: [OdontogramService],
})
export class OdontogramModule {}
