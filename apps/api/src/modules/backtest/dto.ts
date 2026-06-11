import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class RunBacktestDto {
  @IsString()
  strategy: string; // id ou slug

  @IsString()
  ticker: string;

  @IsOptional()
  @IsIn(['1d', '1wk'])
  timeframe?: '1d' | '1wk';

  @IsOptional()
  @IsInt()
  @Min(90)
  @Max(1825)
  rangeDays?: number;

  @IsOptional()
  @IsNumber()
  @Min(100)
  initialCapital?: number;
}
