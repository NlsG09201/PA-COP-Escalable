import { ArrayMinSize, IsArray, IsString } from 'class-validator';

export class CompareModelsDto {
  @IsArray()
  @ArrayMinSize(2)
  @IsString({ each: true })
  modelIds: string[];
}
