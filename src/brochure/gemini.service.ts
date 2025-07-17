/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/await-thenable */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ExtractedContent } from './file-processing.service';
import {
  BrochureAnalysisDto,
  ExtractedImageDto,
} from './dto/brochure-analysis.dto';

@Injectable()
export class GeminiService {
  private genAI: GoogleGenerativeAI;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is required');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async analyzeContent(
    content: ExtractedContent,
  ): Promise<Omit<BrochureAnalysisDto, 'processingTime'>> {
    const models = ['gemini-2.5-pro'];

    let lastError;

    for (const modelName of models) {
      try {
        console.log(`Attempting to use model: ${modelName}`);
        const model = this.genAI.getGenerativeModel({ model: modelName });

        const prompt = this.buildAnalysisPrompt(content);

        // Define the type for parts to allow both text and inlineData objects
        const parts: Array<
          { text: string } | { inlineData: { mimeType: string; data: string } }
        > = [{ text: prompt }];

        // Add images to the prompt
        for (const image of content.images) {
          const mimeType =
            image.format === 'pdf'
              ? 'application/pdf'
              : `image/${image.format}`;

          parts.push({
            inlineData: {
              mimeType,
              data: image.base64,
            },
          });

          console.log(
            `Added ${image.format} data to prompt, size: ${image.base64.length} chars`,
          );
        }

        const result = await this.retryWithBackoff(
          () => model.generateContent(parts),
          5, // Increased retries for experimental models
          2000, // Increased base delay
        );

        const response = await result.response;
        const analysisText = response.text();

        console.log(`Successfully used model: ${modelName}`);
        return this.parseGeminiResponse(analysisText, content);
      } catch (error) {
        console.error(`Model ${modelName} failed:`, error.message);
        lastError = error;

        // If it's a 503/overloaded error, try the next model after a longer delay
        if (
          error.message.includes('503') ||
          error.message.includes('overloaded')
        ) {
          console.log(`Model ${modelName} is overloaded, trying next model...`);
          await this.delay(5000); // Wait 5 seconds before trying next model
          continue;
        }

        // For rate limiting errors, wait longer
        if (error.message.includes('429') || error.message.includes('quota')) {
          console.log(
            `Rate limit hit on ${modelName}, waiting before next attempt...`,
          );
          await this.delay(10000); // Wait 10 seconds
          continue;
        }

        // For other errors, wait a bit before trying next model
        await this.delay(3000);
      }
    }

    throw new Error(
      `All models failed. Last error: ${lastError?.message || 'Unknown error'}`,
    );
  }

  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number,
    baseDelay: number,
  ): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }

        // Exponential backoff with jitter
        const delay =
          baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
        console.log(
          `Attempt ${attempt} failed, retrying in ${Math.round(delay)}ms...`,
        );
        console.log(`Error: ${error.message}`);
        await this.delay(delay);
      }
    }
    throw new Error('Retry logic failed');
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private buildAnalysisPrompt(content: ExtractedContent): string {
    const fileType = content.metadata.fileType;
    const hasImages = content.images.length > 0;

    return `
Analyze this property brochure document and provide a comprehensive analysis in JSON format.

File Type: ${fileType}
File Name: ${content.metadata.fileName}
Text Content: ${content.text}
${hasImages ? `Visual Content: ${content.images.length} document page(s)/image(s) attached` : 'No visual content'}

IMPORTANT INSTRUCTIONS:
1. Analyze BOTH the text content AND any visual content provided
2. For PDF documents, treat the visual content as document pages that may contain images, floor plans, property photos, etc.
3. Even if the document appears to be a single page or simple format, analyze it thoroughly for property information
4. Extract ALL property-related information from both text and visual elements

Please provide the following analysis in VALID JSON format:

{
  "images": [
    {
      "id": "auto-generated",
      "classification": {
        "type": "document|exterior|interior|floor_plan|amenity|location_map|brochure_page|other",
        "description": "detailed description of what this visual content shows"
      },
      "description": "comprehensive description of the visual content and what property information it contains"
    }
  ],
  "amenities": [
    {
      "name": "specific amenity name",
      "category": "fitness|recreation|security|convenience|transport|utilities|other",
      "description": "description of the amenity and its features",
    }
  ],
  "propertyType": "apartment|house|villa|commercial|office|retail|industrial|mixed_use|other",
  "report": "An overall report of the property including location, features, pricing, and key selling points"
}

CLASSIFICATION GUIDELINES:
- "document": General document page with mixed content
- "exterior": Building exterior, facade, entrance views
- "interior": Room interiors, living spaces, kitchen, bedrooms
- "floor_plan": Layout diagrams, floor plans, site plans
- "amenity": Specific amenity photos (pool, gym, garden, etc.)
- "location_map": Location maps, vicinity maps, connectivity
- "brochure_page": Marketing brochure page with multiple elements

AMENITY CATEGORIES:
- fitness: Gym, yoga room, sports facilities
- recreation: Swimming pool, garden, playground, clubhouse
- security: CCTV, security guards, access control
- convenience: Parking, elevators, storage, maintenance
- transport: Metro, bus stops, taxi stands
- utilities: Power backup, water supply, waste management

EXTRACT EVERYTHING including:
- Property name and developer
- Location and address details
- Unit types and sizes
- Pricing information
- Possession timeline
- Contact information
- Legal approvals
- Connectivity details
- Nearby landmarks

Be thorough and extract ALL relevant information from both text and visual content.
Do not mention it is a document or brochure, just analyze the content as per the guidelines above.
`;
  }

  private parseGeminiResponse(
    response: string,
    content: ExtractedContent,
  ): Omit<BrochureAnalysisDto, 'processingTime'> {
    try {
      console.log('Parsing Gemini response...');
      console.log('Response length:', response.length);
      console.log('Content images count:', content.images.length);

      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('No JSON found in response');
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      console.log('Parsed response:', {
        extractedTextLength: parsed.extractedText?.length || 0,
        imagesCount: parsed.images?.length || 0,
        amenitiesCount: parsed.amenities?.length || 0,
        propertyType: parsed.propertyType,
      });

      // Map images with actual base64 data
      const images: ExtractedImageDto[] = (parsed.images || []).map(
        (analysis, index) => {
          const sourceImg = content.images[index];

          return {
            id: sourceImg?.id ?? `auto-${index}`,
            base64: sourceImg?.base64 ?? '',
            classification: analysis.classification,
            description: analysis.description,
          };
        },
      );

      console.log('Final images array length:', images.length);

      return {
        images,
        amenities: parsed.amenities || [],
        propertyType: parsed.propertyType || 'unknown',
        report: parsed.report || 'No summary available',
      };
    } catch (error) {
      console.error('Failed to parse Gemini response:', error);
      console.error('Response preview:', response.substring(0, 500));

      // Fallback response with proper image mapping
      const fallbackImages: ExtractedImageDto[] = content.images.map((img) => ({
        id: img.id,
        base64: img.base64,
        classification: {
          type: 'document',
          confidence: 0.0,
          description: 'Classification failed - processed as document',
        },
        description: 'Analysis failed but document was processed',
      }));

      return {
        images: fallbackImages,
        amenities: [],
        propertyType: 'unknown',
        report:
          'Analysis failed due to parsing error, but document was processed',
      };
    }
  }
}
