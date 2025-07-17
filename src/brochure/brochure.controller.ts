/* eslint-disable prettier/prettier */
import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiBody, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BrochureService } from './brochure.service';
import { BrochureAnalysisDto } from './dto/brochure-analysis.dto';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';

@ApiTags('Brochure Processing')
@Controller('brochure')
export class BrochureController {
  constructor(private readonly brochureService: BrochureService) {}

  @Post('analyze')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const uniqueSuffix = uuidv4();
          cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (file.mimetype.match(/\/(jpg|jpeg|png|gif|pdf)$/)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only image and PDF files are allowed'), false);
        }
      },
      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Brochure analyzed successfully',
    type: BrochureAnalysisDto,
  })
  async analyzeBrochure(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<BrochureAnalysisDto> {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    return this.brochureService.processBrochure(file);
  }
}