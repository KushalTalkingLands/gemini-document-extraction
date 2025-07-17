/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/await-thenable */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ExtractedContent } from './file-processing.service';
import { BrochureAnalysisDto, ExtractedImageDto } from './dto/brochure-analysis.dto';

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

  async analyzeContent(content: ExtractedContent): Promise<Omit<BrochureAnalysisDto, 'processingTime'>> {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

    const prompt = this.buildAnalysisPrompt(content);
    
    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [{ text: prompt }];
    
    // Add images to the prompt
    for (const image of content.images) {
      parts.push({
        inlineData: {
          mimeType: `image/${image.format}`,
          data: image.base64,
        },
      });
    }

    const result = await model.generateContent(parts);
    const response = await result.response;
    const analysisText = response.text();

    return this.parseGeminiResponse(analysisText, content);
  }

  private buildAnalysisPrompt(content: ExtractedContent): string {
    return `
Analyze this property brochure and provide a comprehensive analysis in JSON format. 

Text content: ${content.text}

Please provide the following analysis:

1. Extract and summarize all text content and key details from the brochure with images.
2. Classify each image by type (exterior, interior, floor_plan, amenity, location_map, etc.)
3. Describe each image in detail
4. Identify and list all amenities mentioned or shown
5. Determine the property type (apartment, house, commercial, etc.)
6. Provide a comprehensive summary

Return the response in the following JSON structure:
{
  "images": [
    {
      "id": "image_id",
      "classification": {
        "type": "exterior|interior|floor_plan|amenity|location_map|other",
        "confidence": 0.95,
        "description": "detailed description"
      },
      "description": "detailed image description"
    }
  ],
  "amenities": [
    {
      "name": "amenity name",
      "category": "fitness|recreation|security|convenience|transport|other",
      "mentioned": true,
      "evidence": "text or visual evidence"
    }
  ],
  "propertyType": "apartment|house|commercial|mixed_use|other",
  "summary": "comprehensive property summary"
}

Common amenities to look for:
- Swimming pool, gym, parking, security, elevators
- Garden, playground, clubhouse, tennis court
- Shopping center, restaurants, public transport
- CCTV, intercom, power backup, water supply
- Balconies, terraces, storage, laundry facilities

Be thorough and accurate in your analysis.
`;
  }

  private parseGeminiResponse(
    response: string,
    content: ExtractedContent,
  ): Omit<BrochureAnalysisDto, 'processingTime'> {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Map images with actual base64 data
      const images: ExtractedImageDto[] = content.images.map((img, index) => {
        const analysis = parsed.images[index] || {
          classification: {
            type: 'other',
            confidence: 0.5,
            description: 'Unable to classify',
          },
          description: 'No description available',
        };

        return {
          id: img.id,
          base64: img.base64,
          classification: analysis.classification,
          description: analysis.description,
        };
      });

      return {
        extractedText: parsed.extractedText || content.text,
        images,
        amenities: parsed.amenities || [],
        propertyType: parsed.propertyType || 'unknown',
        summary: parsed.summary || 'No summary available',
      };
    } catch (error) {
      console.error('Failed to parse Gemini response:', error);
      
      // Fallback response
      return {
        extractedText: content.text,
        images: content.images.map(img => ({
          id: img.id,
          base64: img.base64,
          classification: {
            type: 'other',
            confidence: 0.0,
            description: 'Classification failed',
          },
          description: 'Analysis failed',
        })),
        amenities: [],
        propertyType: 'unknown',
        summary: 'Analysis failed due to parsing error',
      };
    }
  }
}