import type { DbClient } from "../db/client.js";
export type JobLetterInput = {
    title: string;
    employeeName?: string;
    position?: string;
    monthlySalary?: number;
    data: Record<string, unknown>;
};
export declare function saveJobLetter(db: DbClient, input: JobLetterInput): Promise<{
    monthlySalary: number;
    employeeName: string | null;
    position: string | null;
    id: string;
    data: Record<string, unknown>;
    createdAt: Date;
    title: string;
}>;
export declare function listJobLetters(db: DbClient, limit?: number): Promise<{
    id: string;
    title: string;
    employeeName: string | null;
    position: string | null;
    monthlySalary: number;
    data: Record<string, unknown>;
    createdAt: Date;
}[]>;
export declare function getJobLetter(db: DbClient, id: string): Promise<{
    id: string;
    title: string;
    employeeName: string | null;
    position: string | null;
    monthlySalary: number;
    data: Record<string, unknown>;
    createdAt: Date;
} | null>;
export declare function deleteJobLetter(db: DbClient, id: string): Promise<{
    success: boolean;
}>;
//# sourceMappingURL=jobLetters.d.ts.map