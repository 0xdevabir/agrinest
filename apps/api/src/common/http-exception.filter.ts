import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { Response } from "express";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      const message =
        typeof body === "string"
          ? body
          : (body as { message?: string | string[] }).message ?? exception.message;
      const detail = Array.isArray(message) ? message.join(", ") : message;
      res.status(exception.getStatus()).json({ detail });
      return;
    }
    console.error(exception);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ detail: "Internal server error" });
  }
}
