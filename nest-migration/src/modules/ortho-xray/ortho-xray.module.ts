import { Module } from '@nestjs/common';
import { OrthoXrayController } from './ortho-xray.controller';
import { OrthoXrayService } from './ortho-xray.service';
import { OdontogramModule } from '../odontogram/odontogram.module';

@Module({
  imports: [OdontogramModule],
  controllers: [OrthoXrayController],
  providers: [OrthoXrayService],
})
export class OrthoXrayModule {}

