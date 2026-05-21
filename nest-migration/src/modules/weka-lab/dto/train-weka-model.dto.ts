import { IsArray, IsBoolean, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class TrainWekaModelDto {
  @IsOptional()
  @IsString()
  datasetId?: string;

  @IsOptional()
  @IsString()
  modelName?: string;

  @IsOptional()
  @IsString()
  version?: string;

  @IsOptional()
  @IsString()
  targetColumn?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  featureColumns?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(0.5)
  testSize?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  maxDepth?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  minSamplesLeaf?: number;

  @IsOptional()
  @IsNumber()
  @Min(2)
  minSamplesSplit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  ccpAlpha?: number;

  @IsOptional()
  @IsNumber()
  @Min(2)
  @Max(10)
  cvFolds?: number;

  @IsOptional()
  @IsNumber()
  randomState?: number;

  @IsOptional()
  @IsBoolean()
  setActive?: boolean;
}
