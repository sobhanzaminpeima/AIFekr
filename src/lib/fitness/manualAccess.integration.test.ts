import {beforeAll,afterAll,it,expect} from "vitest";
import {NextRequest} from "next/server";
import {prisma} from "@/lib/db/prisma";
import {signToken} from "@/lib/auth/jwt";
import {requireAuth} from "@/lib/auth/middleware";
const id="fitness-manual-auth-"+crypto.randomUUID();
beforeAll(()=>prisma.user.create({data:{id,plan:"PRO",planExpiry:new Date("2025-01-01"),fitnessAccessExpiry:new Date(Date.now()+86400000)}}));
afterAll(()=>prisma.user.delete({where:{id}}));
it("allows the fitness API with an admin grant even when the unrelated platform plan expired",async()=>{const token=signToken({userId:id,role:"USER",plan:"PRO"});const fitness=await requireAuth(new NextRequest("http://localhost/api/fitness",{headers:{cookie:`token=${token}`}}));expect(fitness?.id).toBe(id);const other=await requireAuth(new NextRequest("http://localhost/api/chat",{headers:{cookie:`token=${token}`}}));expect(other).toBeNull();});
