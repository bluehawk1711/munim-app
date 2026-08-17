import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { ZodError } from "zod";
import { ProductError, PartyError, InvoiceError, AdvanceError } from "@munim/core";

/**
 * Global exception filter — every error leaves the API as
 * `{ error: string, status: number }` so clients have one shape to parse.
 * Domain errors from @munim/core carry their own HTTP status; ZodValidation
 * errors become 400s; anything else is a logged 500.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("Exception");

  catch(exception: unknown, host: ArgumentsHost): void {
    const reply = host.switchToHttp().getResponse<FastifyReply>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message =
        typeof body === "string"
          ? body
          : (body as { message?: string | string[] }).message ?? exception.message;
      reply.status(status).send({ error: Array.isArray(message) ? message[0] ?? "Error" : message, status });
      return;
    }

    if (exception instanceof ZodError) {
      const message = exception.issues[0]?.message ?? "Invalid input";
      reply.status(HttpStatus.BAD_REQUEST).send({ error: message, status: HttpStatus.BAD_REQUEST });
      return;
    }

    const coreError = exception as { message?: string; status?: number };
    if (
      exception instanceof ProductError ||
      exception instanceof PartyError ||
      exception instanceof InvoiceError ||
      exception instanceof AdvanceError
    ) {
      const status = coreError.status ?? HttpStatus.BAD_REQUEST;
      reply.status(status).send({ error: coreError.message ?? "Request failed", status });
      return;
    }

    this.logger.error(
      exception instanceof Error ? exception.stack ?? exception.message : String(exception),
    );
    reply.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
      error: "Internal server error",
      status: HttpStatus.INTERNAL_SERVER_ERROR,
    });
  }
}
