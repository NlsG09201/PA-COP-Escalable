import { Module } from '@nestjs/common';
import { OdontologyController } from './odontology.controller';
import { OdontologyService } from './odontology.service';

@Module({
  controllers: [OdontologyController],
  providers: [OdontologyService],
})
export class OdontologyModule {}

