import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { GetUser } from 'src/decorator/get-user.decorator';
import { CreateUserDto } from 'src/users/dto/create-user.dto';
import { User } from 'src/users/entities/user.entity';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshTokenGuard } from './guards/jwt-refresh-token.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { SignInCredentialsDto } from './dto/signin-credentials.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @UseGuards(LocalAuthGuard)
  @Post('/login')
  async login(@Request() req) {
    return this.authService.login(req.user);
  }

  // @UseGuards(LocalAuthGuard)
  @Post('/signin')
  async loginWithoutStrategy(
    @Body(ValidationPipe) signinCredentialsDto: SignInCredentialsDto,
  ) {
    return this.authService.loginWithoutStrategy(signinCredentialsDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/profile')
  getProfile(@Request() req) {
    return req.user;
  }

  @UseGuards(JwtAuthGuard)
  @Get('logout')
  logout(@GetUser() user: User) {
    return this.authService.signOut(user);
  }

  @Post('/signup')
  create(@Body() createUserDto: CreateUserDto) {
    return this.authService.create(createUserDto);
  }

  @UseGuards(JwtRefreshTokenGuard)
  @Post('/refresh-token')
  async refreshToken(@GetUser() user: User, @Body() token: RefreshTokenDto) {
    const user_info = await this.authService.getUserIfRefreshTokenMatches(
      token.refresh_token,
      'email2@gmail.com',
    );

    if (user_info) {
      const userInfo = {
        id: user_info.id,
        email: user_info.email,
      };
      return this.authService.getNewAccessAndRefreshToken(userInfo);
    } else {
      return null;
    }
  }
}
