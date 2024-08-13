import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as admin from 'firebase-admin';
import { Repository } from 'typeorm';
import { UserInfoDto } from './dto/user-info.dto';
import { UserInfo } from './entities/user-info.entity';
import { User } from './entities/user.entity';
import { IUserInfo } from './interface/user-info.interface';
import { IFirebaseCredentials } from '../firebase.config';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';

@Injectable()
export class UsersService {
  private readonly storage;
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(UserInfo)
    private userInfoRepository: Repository<UserInfo>,
    private configService: ConfigService,
  ) {
    const firebaseCredentials: IFirebaseCredentials = {
      type: this.configService.get<string>('FIREBASE_TYPE'),
      project_id: this.configService.get<string>('FIREBASE_PROJECT_ID'),
      private_key_id: this.configService.get<string>('FIREBASE_PRIVATE_KEY_ID'),
      private_key: (
        this.configService.get<string>('FIREBASE_PRIVATE_KEY') || ''
      ).replace(/\\n/g, '\n'),
      client_email: this.configService.get<string>('FIREBASE_CLIENT_EMAIL'),
      client_id: this.configService.get<string>('FIREBASE_CLIENT_ID'),
      auth_uri: this.configService.get<string>('FIREBASE_AUTH_URI'),
      token_uri: this.configService.get<string>('FIREBASE_TOKEN_URI'),
      auth_provider_x509_cert_url: this.configService.get<string>(
        'FIREBASE_AUTH_PROVIDER_X509_CERT_URL',
      ),
      client_x509_cert_url: this.configService.get<string>(
        'FIREBASE_CLIENT_X509_CERT_URL',
      ),
      universe_domain: this.configService.get<string>(
        'FIREBASE_UNOVERSER_DOMAIN',
      ),
    };

    admin.initializeApp({
      credential: admin.credential.cert(firebaseCredentials),
      storageBucket: `${this.configService.get<string>('FIREBASE_STORAGE_BUCKET')}`,
    });
    this.storage = admin.storage().bucket();
  }

  async getUserByEmail(email: string) {
    return await this.userRepository.findOne({
      where: { email },
    });
  }

  async getUser(user: User): Promise<UserInfo> {
    const userInfo = await this.userInfoRepository.findOne({
      where: {
        id: user.user_info.id,
      },
    });

    if (!userInfo) {
      throw new NotFoundException('User not found');
    }

    return userInfo;
  }

  async updateUserProfile(
    user: User,
    userInfoDto: UserInfoDto,
  ): Promise<IUserInfo> {
    const userInfo = await this.getUser(user);
    console.log('userInfoDto', userInfoDto);
    if (userInfoDto.address) {
      userInfo.address = userInfoDto.address;
    }
    if (userInfoDto.photo) {
      userInfo.photo = userInfoDto.photo;
    }

    await userInfo.save();
    return userInfo;
  }

  async uploadPhoto(file: Express.Multer.File): Promise<string> {
    const extension = path.extname(file.originalname);
    const currentDate = new Date();
    const formattedDate = currentDate
      .toISOString()
      .replace(/[-T:.Z]/g, '')
      .slice(0, 14);

    const filename = `${formattedDate}${extension}`;
    const fileRef = this.storage.file(filename);
    await fileRef.save(file.buffer, {
      public: true,
      metadata: {
        contentType: file.mimetype,
      },
    });

    const publicUrl = fileRef.publicUrl();

    return publicUrl;
  }
}
