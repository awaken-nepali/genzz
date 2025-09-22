import { Module } from '@nestjs/common';
import { TimeCounterService } from './time-counter.service';

@Module({
    providers: [TimeCounterService],
    exports: [TimeCounterService],
})
export class UtilsModule { }
