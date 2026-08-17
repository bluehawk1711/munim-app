import type { JobLetterDto, JobLetterFormValues } from "@munim/core";
import type { HttpClient } from "../http.js";

export function jobLetters(http: HttpClient) {
  return {
    /** GET /api/job-letters — mirrors core `listJobLetters(db)`. */
    list(): Promise<JobLetterDto[]> {
      return http.get("/api/job-letters");
    },
    /** POST /api/job-letters — mirrors core `saveJobLetter(db, values)`. */
    create(values: JobLetterFormValues): Promise<JobLetterDto> {
      return http.post("/api/job-letters", values);
    },
    /** DELETE /api/job-letters/:id */
    remove(id: string): Promise<{ success: boolean }> {
      return http.del(`/api/job-letters/${id}`);
    },
  };
}

export type JobLettersEndpoints = ReturnType<typeof jobLetters>;
