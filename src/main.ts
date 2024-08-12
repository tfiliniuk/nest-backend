import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  const PORT = process.env.PORT || 3001;
  app.enableCors({ credentials: true, origin: true });
  await app.listen(PORT, () => {
    console.log(`RUNNING API in MODE ${process.env.PORT}`);
  });
}
bootstrap();
