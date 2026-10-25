import {z} from 'zod';
export const studyCourses=z.object({courses:z.array(z.object({id:z.string(),name:z.string(),institution:z.string().nullable(),courseCode:z.string().nullable()}))});
export const studyMaterials=z.object({materials:z.array(z.object({id:z.string(),title:z.string(),content:z.string(),source:z.string()}))});
export const studyNotes=z.object({notes:z.array(z.object({id:z.string(),title:z.string(),content:z.string()}))});
export const studyCards=z.object({flashcards:z.array(z.object({id:z.string(),question:z.string(),answer:z.string(),nextReviewAt:z.string().nullable(),reviewCount:z.number().int().nonnegative()}))});
export const studyTimer=z.object({active:z.object({id:z.string(),elapsedSeconds:z.number().nonnegative(),pausedAt:z.string().nullable(),course:z.object({id:z.string(),name:z.string()}).nullable()}).nullable()});
export function elapsedStudySeconds(snapshot:{elapsedSeconds:number;pausedAt:string|null},receivedAt:number,now:number){return Math.min(43200,Math.floor(snapshot.elapsedSeconds+(snapshot.pausedAt?0:Math.max(0,now-receivedAt)/1000)));}
