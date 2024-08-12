import { Body, Controller, Get } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private userService: UsersService) {}

  @Get()
  getUserByEmail(@Body() payload: { email: string }) {
    return this.userService.getUserByEmail(payload.email);
  }
}
