import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UploadVideoDto {
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Title too long' })
  title?: string;
}
