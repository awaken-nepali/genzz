import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService implements OnModuleInit {
  constructor(private configService: ConfigService) { }

  onModuleInit() {
    // Check if Firebase app is already initialized
    if (admin.apps.length === 0) {
      const serviceAccount = {
        projectId: this.configService.get<string>('FIREBASE_PROJECT_ID'),
        clientEmail: this.configService.get<string>('FIREBASE_CLIENT_EMAIL'),
        privateKey: this.configService
          .get<string>('FIREBASE_PRIVATE_KEY')
          .replace(/\\n/g, '\n'),
      } as admin.ServiceAccount;

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('Firebase app initialized successfully');
    } else {
      console.log('Firebase app already initialized, reusing existing app');
    }
  }

  getFirestore() {
    return admin.firestore();
  }
}
