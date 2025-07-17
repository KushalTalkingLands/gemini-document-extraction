/* eslint-disable prettier/prettier */
// eslint-disable-next-line prettier/prettier
import { Module } from '@nestjs/common';
import { BrochureController } from './brochure.controller';
import { BrochureService } from './brochure.service';
import { GeminiService } from './gemini.service';
import { FileProcessingService } from './file-processing.service';
@Module({
  controllers: [BrochureController],
  providers: [BrochureService, GeminiService, FileProcessingService],
})
export class BrochureModule {}
