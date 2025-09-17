import { Controller, Get, Post } from '@nestjs/common';
import { SyncService } from './sync.service';

@Controller('sync')
export class SyncController {
    constructor(private readonly syncService: SyncService) { }

    @Get('run')
    async runSync() {
        await this.syncService.nightlySync();
        return { status: 'ok' };
    }
}


