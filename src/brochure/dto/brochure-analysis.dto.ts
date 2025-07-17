/* eslint-disable prettier/prettier */
import { ApiProperty } from '@nestjs/swagger';

export class ImageClassificationDto {
  @ApiProperty()
  type: string;

  @ApiProperty()
  confidence: number;

  @ApiProperty()
  description: string;
}

export class AmenityDto {
  @ApiProperty()
  name: string;

  @ApiProperty()
  category: string;

  @ApiProperty()
  mentioned: boolean;

  @ApiProperty()
  evidence?: string;
}

export class ExtractedImageDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  base64: string;

  @ApiProperty()
  classification: ImageClassificationDto;

  @ApiProperty()
  description: string;
}

export class BrochureAnalysisDto {
  @ApiProperty({ type: [ExtractedImageDto] })
  images: ExtractedImageDto[];

  @ApiProperty({ type: [AmenityDto] })
  amenities: AmenityDto[];

  @ApiProperty()
  propertyType: string;

  @ApiProperty()
  report: string;

  @ApiProperty()
  processingTime: number;
}