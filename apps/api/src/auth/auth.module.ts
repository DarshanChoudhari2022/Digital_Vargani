import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  controllers: [AuthController],
  exports: [AuthService, JwtAuthGuard, RolesGuard],
  imports: [JwtModule.register({})],
  providers: [AuthService, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
