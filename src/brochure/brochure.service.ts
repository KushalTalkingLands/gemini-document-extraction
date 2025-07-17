/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';
import { GeminiService } from './gemini.service';
import { FileProcessingService } from './file-processing.service';
import { BrochureAnalysisDto } from './dto/brochure-analysis.dto';

@Injectable()
export class BrochureService {
  constructor(
    private readonly geminiService: GeminiService,
    private readonly fileProcessingService: FileProcessingService,
  ) {}

  async processBrochure(file: Express.Multer.File): Promise<BrochureAnalysisDto> {
    const startTime = Date.now();

    try {
      // Extract content from file
      const extractedContent = await this.fileProcessingService.extractContent(file);
      
      // Process with Gemini
      const analysis = await this.geminiService.analyzeContent(extractedContent);
      
      const processingTime = Date.now() - startTime;

      return {
        ...analysis,
        processingTime,
      };
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      throw new Error(`Failed to process brochure: ${error.message}`);
    }
  }
}