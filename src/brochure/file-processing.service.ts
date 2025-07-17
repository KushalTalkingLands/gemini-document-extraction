/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as sharp from 'sharp';
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

    console.log(`Processing file: ${file.originalname}, type: ${file.mimetype}`);

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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const data = await pdfParse(buffer);
    
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    content.text = data.text;
    console.log(`Extracted text length: ${content.text.length}`);
    
    // Convert PDF to image for visual analysis
    const pdfAsImage = await this.convertPdfToImage(buffer);
    if (pdfAsImage) {
      content.images.push({
        id: uuidv4(),
        base64: pdfAsImage,
        format: 'png',
      });
      console.log(`PDF converted to image successfully`);
    } else {
      console.log(`PDF to image conversion failed, sending raw PDF data`);
      // Send the PDF as binary data to Gemini
      const pdfBase64 = buffer.toString('base64');
      content.images.push({
        id: uuidv4(),
        base64: pdfBase64,
        format: 'pdf',
      });
    }

    console.log(`Total images extracted: ${content.images.length}`);
    return content;
  }

  private async extractFromImage(
    file: Express.Multer.File,
    content: ExtractedContent,
  ): Promise<ExtractedContent> {
    const buffer = fs.readFileSync(file.path);
    
    // Process image with Sharp to ensure it's in a supported format
    const processedBuffer = await sharp(buffer)
      .jpeg({ quality: 90 })
      .toBuffer();
    
    const base64 = processedBuffer.toString('base64');
    
    content.images.push({
      id: uuidv4(),
      base64,
      format: 'jpeg',
    });

    console.log(`Image processed successfully, size: ${processedBuffer.length} bytes`);
    return content;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  private async convertPdfToImage(buffer: Buffer): Promise<string | null> {
    try {
      // For now, we'll return null and let Gemini handle the PDF directly
      // In production, you might want to use pdf2pic or similar
      // npm install pdf2pic
      return null;
    } catch (error) {
      console.error('PDF to image conversion failed:', error);
      return null;
    }
  }
}