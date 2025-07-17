/* eslint-disable prettier/prettier */
export interface PropertyAnalysis {
  extractedText: string;
  images: ProcessedImage[];
  amenities: Amenity[];
  propertyType: string;
  summary: string;
}

export interface ProcessedImage {
  id: string;
  base64: string;
  classification: ImageClassification;
  description: string;
}

export interface ImageClassification {
  type: 'exterior' | 'interior' | 'floor_plan' | 'amenity' | 'location_map' | 'other';
  confidence: number;
  description: string;
}

export interface Amenity {
  name: string;
  category: 'fitness' | 'recreation' | 'security' | 'convenience' | 'transport' | 'other';
  mentioned: boolean;
  evidence?: string;
}