/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
// import * as sharp from 'sharp';
import * as pdfParse from 'pdf-parse';
import { v4 as uuidv4 } from 'uuid';

export interface ExtractedContent {
  text: string;
  images: Array<{
    id: string;
    base64: string;
    format: string;
  }>;
  metadata: {
    fileType: string;
    fileName: string;
    fileSize: number;
  };
}

@Injectable()
export class FileProcessingService {
  async extractContent(file: Express.Multer.File): Promise<ExtractedContent> {
    const content: ExtractedContent = {
      text: '',
      images: [],
      metadata: {
        fileType: file.mimetype,
        fileName: file.originalname,
        fileSize: file.size,
      },
    };

    if (file.mimetype === 'application/pdf') {
      return this.extractFromPdf(file, content);
    } else if (file.mimetype.startsWith('image/')) {
      return this.extractFromImage(file, content);
    }

    throw new Error('Unsupported file type');
  }

  private async extractFromPdf(
    file: Express.Multer.File,
    content: ExtractedContent,
  ): Promise<ExtractedContent> {
    const buffer = fs.readFileSync(file.path);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const data = await pdfParse(buffer);
    
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    content.text = data.text;
    
    // For PDF, we'll treat the entire document as one image for Gemini processing
    // In a real implementation, you might want to use a library like pdf2pic
    // eslint-disable-next-line @typescript-eslint/await-thenable
    const pdfAsImage = await this.convertPdfToImage(buffer);
    if (pdfAsImage) {
      content.images.push({
        id: uuidv4(),
        base64: pdfAsImage,
        format: 'png',
      });
    }

    return content;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  private async extractFromImage(
    file: Express.Multer.File,
    content: ExtractedContent,
  ): Promise<ExtractedContent> {
    const buffer = fs.readFileSync(file.path);
    const base64 = buffer.toString('base64');
    
    content.images.push({
      id: uuidv4(),
      base64,
      format: file.mimetype.split('/')[1],
    });

    return content;
  }

  private convertPdfToImage(buffer: Buffer): string | null {
    try {
      // This is a simplified approach - in production, use pdf2pic or similar
      // For now, we'll return null and rely on text extraction
      return null;
    } catch (error) {
      console.error('PDF to image conversion failed:', error);
      return null;
    }
  }
}