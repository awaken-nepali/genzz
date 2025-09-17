import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FirebaseModule } from './firebase/firebase.module';
import { TwitterModule } from './twitter/twitter.module';
import { FacebookModule } from './facebook/facebook.module';
import { SyncModule } from './sync/sync.module';
import { ScheduleService } from './schedule/schedule.service';
import { FirebaseService } from './firebase/firebase.service';
import { TwitterService } from './twitter/twitter.service';
import { FacebookService } from './facebook/facebook.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    FirebaseModule,
    TwitterModule,
    FacebookModule,
    SyncModule,
  ],
  controllers: [AppController],
  providers: [AppService, ScheduleService, FirebaseService, TwitterService, FacebookService],
})
export class AppModule { }
