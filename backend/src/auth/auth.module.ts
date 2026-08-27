import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { FirebaseService } from './firebase.service';
import { PrismaService } from '../common/prisma.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, FirebaseService, PrismaService],
  exports: [AuthService, AuthGuard, FirebaseService],
})
export class AuthModule {}
