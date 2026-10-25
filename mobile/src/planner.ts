import {z} from 'zod';
export const plannerSchema=z.object({exams:z.array(z.object({id:z.string(),title:z.string(),examAt:z.string(),version:z.string()})).max(100),tasks:z.array(z.object({id:z.string(),title:z.string(),description:z.string(),dueAt:z.string().nullable(),priority:z.number(),taskType:z.enum(['study','assignment']),completedAt:z.string().nullable(),version:z.string()})).max(100)});
export type PlannerSnapshot=z.infer<typeof plannerSchema>;
