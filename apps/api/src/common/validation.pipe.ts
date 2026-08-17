import { BadRequestException, Injectable, PipeTransform } from "@nestjs/common";
import type { ZodType } from "zod";

/**
 * Body validation pipe driven by the SHARED zod schemas from @munim/core
 * (the same ones the web app uses) — a single source of validation truth.
 * Usage: `@Body(new ZodValidationPipe(productSchema)) values: ProductFormValues`
 */
@Injectable()
export class ZodValidationPipe<TInput, TOutput> implements PipeTransform<TInput, TOutput> {
  constructor(private readonly schema: ZodType<TOutput>) {}

  transform(value: TInput): TOutput {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const message = result.error.issues[0]?.message ?? "Invalid input";
      throw new BadRequestException(message);
    }
    return result.data;
  }
}
