import { desc, eq } from "drizzle-orm";
import type { DbClient } from "../db/client.js";
import * as schema from "../db/schema.js";
import { logActivity } from "./activity.js";

export type JobLetterInput = {
  title: string;
  employeeName?: string;
  position?: string;
  monthlySalary?: number;
  data: Record<string, unknown>;
};

export async function saveJobLetter(db: DbClient, input: JobLetterInput) {
  const [row] = await db
    .insert(schema.jobLetters)
    .values({
      title: input.title.trim(),
      employeeName: input.employeeName?.trim() || null,
      position: input.position?.trim() || null,
      monthlySalary: input.monthlySalary ?? 0,
      data: input.data,
    })
    .returning();
  if (!row) throw new Error("Failed to save job letter");
  await logActivity(db, "JOB_LETTER_CREATED", `Created job letter "${row.title}"`);
  return row;
}

export async function listJobLetters(db: DbClient, limit = 100) {
  return db.select().from(schema.jobLetters).orderBy(desc(schema.jobLetters.createdAt)).limit(limit);
}

export async function getJobLetter(db: DbClient, id: string) {
  const rows = await db.select().from(schema.jobLetters).where(eq(schema.jobLetters.id, id));
  return rows[0] ?? null;
}

export async function deleteJobLetter(db: DbClient, id: string) {
  await db.delete(schema.jobLetters).where(eq(schema.jobLetters.id, id));
  return { success: true };
}
