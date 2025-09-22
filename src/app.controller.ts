import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { ScheduleService } from './schedule/schedule.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly scheduleService: ScheduleService,
  ) { }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('trigger')
  async triggerPosting() {
    await this.scheduleService.manualTrigger();
    return { status: 'triggered' };
  }
}
