import { Module } from '@nestjs/common';
import { FacebookService } from './facebook.service';
import { UtilsModule } from '../utils/utils.module';

@Module({
  imports: [UtilsModule],
  providers: [FacebookService],
  exports: [FacebookService],
})
export class FacebookModule { }
