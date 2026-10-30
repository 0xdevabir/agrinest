import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/http-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const prefix = process.env.API_PREFIX || "api";
  app.setGlobalPrefix(prefix);

  const origins = (process.env.CORS_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalFilters(new HttpExceptionFilter());

  if (process.env.SWAGGER_ENABLED !== "false") {
    const config = new DocumentBuilder()
      .setTitle("AgriSathi API")
      .setDescription("Bangla-first farming API — Farmer, Field, Event")
      .setVersion("0.1.0")
      .addTag("farmers")
      .addTag("fields")
      .addTag("crop-guardian")
      .build();
    SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, config));
  }

  const port = Number(process.env.PORT || 8000);
  await app.listen(port);
  console.log(`AgriSathi API http://127.0.0.1:${port}/${prefix}`);
}

void bootstrap();
