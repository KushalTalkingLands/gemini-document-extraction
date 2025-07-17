import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BrochureModule } from './brochure/brochure.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    BrochureModule,
  ],
})
export class AppModule {}
