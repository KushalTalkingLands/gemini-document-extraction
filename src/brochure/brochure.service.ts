/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
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
      console.log(`Processing file: ${file.originalname}, size: ${file.size} bytes`);
      
      // Extract content from file
      const extractedContent = await this.fileProcessingService.extractContent(file);
      console.log(`Content extracted. Text length: ${extractedContent.text.length}, Images: ${extractedContent.images.length}`);
      
      // Process with Gemini
      const analysis = await this.geminiService.analyzeContent(extractedContent);
      
      const processingTime = Date.now() - startTime;
      console.log(`Processing completed in ${processingTime}ms`);

      return {
        ...analysis,
        processingTime,
      };
    } catch (error) {
      console.error('Brochure processing error:', error);
      
      // Handle specific Google AI errors
      if (error.message.includes('503') || error.message.includes('overloaded')) {
        throw new Error('AI service is currently overloaded. Please try again in a few minutes.');
      }
      
      if (error.message.includes('API key')) {
        throw new Error('Invalid or missing API key. Please check your configuration.');
      }
      
      if (error.message.includes('quota')) {
        throw new Error('API quota exceeded. Please try again later.');
      }
      
      throw new Error(`Failed to process brochure: ${error.message}`);
    }
  }
}