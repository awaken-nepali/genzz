import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { FirebaseModule } from '../firebase/firebase.module';
import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';

@Module({
    imports: [ConfigModule.forRoot(), ScheduleModule.forRoot(), FirebaseModule],
    providers: [SyncService],
    controllers: [SyncController],
})
export class SyncModule { }


