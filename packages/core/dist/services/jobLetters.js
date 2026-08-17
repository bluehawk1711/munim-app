import { desc, eq } from "drizzle-orm";
import * as schema from "../db/schema.js";
import { logActivity } from "./activity.js";
export async function saveJobLetter(db, input) {
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
    if (!row)
        throw new Error("Failed to save job letter");
    await logActivity(db, "JOB_LETTER_CREATED", `Created job letter "${row.title}"`);
    return row;
}
export async function listJobLetters(db, limit = 100) {
    return db.select().from(schema.jobLetters).orderBy(desc(schema.jobLetters.createdAt)).limit(limit);
}
export async function getJobLetter(db, id) {
    const rows = await db.select().from(schema.jobLetters).where(eq(schema.jobLetters.id, id));
    return rows[0] ?? null;
}
export async function deleteJobLetter(db, id) {
    await db.delete(schema.jobLetters).where(eq(schema.jobLetters.id, id));
    return { success: true };
}
//# sourceMappingURL=jobLetters.js.map