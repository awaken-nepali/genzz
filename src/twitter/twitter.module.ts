import { Module } from '@nestjs/common';
import { TwitterService } from './twitter.service';
import { UtilsModule } from '../utils/utils.module';

@Module({
  imports: [UtilsModule],
  providers: [TwitterService],
  exports: [TwitterService],
})
export class TwitterModule { }
