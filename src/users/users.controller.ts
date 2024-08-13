import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { JwtRefreshTokenGuard } from 'src/auth/guards/jwt-refresh-token.guard';
import { GetUser } from 'src/decorator/get-user.decorator';
import { UserInfoDto } from './dto/user-info.dto';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

const { imageFileFilter } = require('../utils/file-upload.utils');

@Controller('users')
export class UsersController {
  constructor(private userService: UsersService) {}

  @Get()
  getUserByEmail(@Body() payload: { email: string }) {
    return this.userService.getUserByEmail(payload.email);
  }

  @Patch()
  @UseInterceptors(
    FileInterceptor('photo', {
      limits: {
        fileSize: 2097152,
      },
      fileFilter: imageFileFilter,
    }),
  )
  @UseGuards(JwtAuthGuard)
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() userInfoDto: UserInfoDto,
    @GetUser() user: User,
  ) {
    if (file) {
      userInfoDto.photo = await this.userService.uploadPhoto(file);
    }

    return this.userService.updateUserProfile(user, userInfoDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/profile')
  async getUserInfo(@GetUser() user: User) {
    return await this.userService.getUser(user);
  }
}
