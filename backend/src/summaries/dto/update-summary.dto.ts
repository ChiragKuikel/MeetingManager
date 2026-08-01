import { IsArray, IsOptional, IsString } from 'class-validator';

export class UpdateSummaryDto {
  @IsOptional()
  @IsString()
  summaryText?: string;

  @IsOptional()
  @IsArray()
  keyPoints?: unknown[];

  @IsOptional()
  @IsArray()
  actionItems?: unknown[];
}
