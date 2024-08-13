import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from 'src/users/users.service';
import { IUser } from 'src/types/types';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/users/entities/user.entity';
import { Repository } from 'typeorm';
import { CreateUserDto } from 'src/users/dto/create-user.dto';

import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { ExceptionsHandler } from '@nestjs/core/exceptions/exceptions-handler';
import { SignInCredentialsDto } from './dto/signin-credentials.dto';
import { Request } from 'express';
import { UserInfo } from 'src/users/entities/user-info.entity';

@Injectable()
export class AuthService {
  constructor(
    private userService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    @InjectRepository(User)
    private userRepository: Repository<User>,

    // @InjectRepository(UserInfo)
    // private userInfoRepository: Repository<UserInfo>,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.userService.getUserByEmail(email);

    if (user && (await user.validatePassword(password, user.password))) {
      return user;
    }
    throw new UnauthorizedException('User or password are incorrect');
  }

  async validateUserPassword(signinCredentialDto: SignInCredentialsDto) {
    // : Promise<IUser>
    const { email, password } = signinCredentialDto;

    const user = await this.userService.getUserByEmail(email);
    if (user && (await user.validatePassword(password, user.password))) {
      return {
        id: user.id,
        email: user.email,
        username: user.username,
        user_info: user.user_info,
      };
    } else {
      return null;
    }
  }

  async loginWithoutStrategy(signinCredentialDto: SignInCredentialsDto) {
    const validatedUser = await this.validateUserPassword(signinCredentialDto);

    if (!validatedUser) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const accessToken = await this.getAccessToken(validatedUser);
    const refreshToken = await this.getRefreshToken(validatedUser);

    return {
      id: validatedUser.id,
      email: validatedUser.email,
      userInfo: validatedUser.user_info,
      token: accessToken,
      refreshToken,
    };
  }

  async login(user: IUser): Promise<{
    id: number;
    email: string;
    token: string;
    refreshToken: string;
  }> {
    const { id, email } = user;

    const accessToken = await this.getAccessToken({ id, email });
    const refreshToken = await this.getRefreshToken({ id, email });

    await this.updateRefreshTokenInUser(refreshToken, email);

    return {
      id,
      email,
      token: accessToken,
      refreshToken,
    };
  }

  async updateRefreshTokenInUser(refreshToken: string, email: string) {
    if (refreshToken) {
      const copy = refreshToken;
      refreshToken = await bcrypt.hash(copy, 10);
    }
    await this.userRepository.update(
      { email },
      {
        hashedRefreshToken: refreshToken,
      },
    );
  }

  async getAccessToken(payload: IUser) {
    const accessToken = await this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_SECRET_KEY'),
      expiresIn: +this.configService.get('JWT_ACCESS_TOKEN_EXPIRATION_TIME'),
    });
    return accessToken;
  }

  async getRefreshToken(payload: IUser) {
    const refreshToken = await this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_REFRESH_TOKEN_SECRET'),
      expiresIn: +this.configService.get('JWT_REFRESH_TOKEN_EXPIRATION_TIME'),
    });

    return refreshToken;
  }

  async create(createUserDto: CreateUserDto) {
    const existUser = await this.userRepository.findOne({
      where: {
        email: createUserDto.email,
      },
    });

    if (existUser) {
      throw new BadRequestException('This email already exist');
    }

    const user = new User();
    user.email = createUserDto.email;
    user.username = createUserDto.username;
    user.password = await this.hashPassword(createUserDto.password);
    // const user = await this.userRepository.save({
    //   email: createUserDto.email,
    //   username: createUserDto.username,
    //   password: await this.hashPassword(createUserDto.password),
    // });
    try {
      const userInfo = new UserInfo();
      await userInfo.save();
      user.user_info = userInfo;
      await this.userRepository.save(user);

      const token = await this.jwtService.sign(
        {
          email: createUserDto.email,
          id: user.id,
        },
        {
          secret: this.configService.get('JWT_SECRET_KEY'),
          expiresIn: +this.configService.get(
            'JWT_ACCESS_TOKEN_EXPIRATION_TIME',
          ),
        },
      );

      return {
        message: 'User successfully created',
        user,
        token,
      };
    } catch (error) {
      if (error.code === '23505') {
        throw new ConflictException('Username already exists');
      } else {
        throw new InternalServerErrorException();
      }
    }
  }

  async signOut(user: IUser) {
    await this.updateRefreshTokenInUser(null, user.email);
    return {
      message: 'User has been succesfully logout',
    };
  }

  async getNewAccessAndRefreshToken(payload: IUser) {
    const refreshToken = await this.getRefreshToken(payload);
    await this.updateRefreshTokenInUser(refreshToken, payload.email);

    return {
      token: await this.getAccessToken(payload),
      refreshToken,
    };
  }

  async getUserIfRefreshTokenMatches(refreshToken: string, email: string) {
    const user = await this.userService.getUserByEmail(email);

    if (!user.hashedRefreshToken) {
      throw new BadRequestException('There is no hashed RefreshToken');
    }
    const isRefreshTokenMatching = await bcrypt.compare(
      refreshToken,
      user.hashedRefreshToken,
    );

    if (isRefreshTokenMatching) {
      await this.updateRefreshTokenInUser(null, email);
      return user;
    }

    throw new UnauthorizedException();
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = Number(this.configService.get('SALT'));
    return bcrypt.hash(password, salt);
  }
}
