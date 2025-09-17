import { Module } from '@nestjs/common';
import { FacebookService } from './facebook.service';

@Module({
  providers: [FacebookService]
})
export class FacebookModule {}
