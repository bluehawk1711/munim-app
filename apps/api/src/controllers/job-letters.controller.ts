import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
} from "@nestjs/common";
import {
  deleteJobLetter,
  jobLetterSchema,
  listJobLetters,
  saveJobLetter,
  serializeJobLetter,
  type DbClient,
  type JobLetterFormValues,
} from "@munim/core";
import { DRIZZLE } from "../db/drizzle.provider.js";
import { ZodValidationPipe } from "../common/validation.pipe.js";

@Controller("job-letters")
export class JobLettersController {
  constructor(@Inject(DRIZZLE) private readonly db: DbClient) {}

  @Get()
  async list() {
    const letters = await listJobLetters(this.db);
    return letters.map((l) => serializeJobLetter(l));
  }

  @Post()
  async create(@Body(new ZodValidationPipe(jobLetterSchema)) values: JobLetterFormValues) {
    const letter = await saveJobLetter(this.db, values);
    return serializeJobLetter(letter);
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    await deleteJobLetter(this.db, id);
    return { success: true };
  }
}
