import {it,expect} from "vitest";
import {existsSync} from "node:fs";
import {mkdir,rm,stat} from "node:fs/promises";
import path from "node:path";
import {randomUUID} from "node:crypto";
import {renderRemotion} from "./remotion";
it.skipIf(!existsSync("tools/video-factory-renderer/node_modules/@remotion/renderer"))("renders a trusted Persian Remotion scene locally without model calls",async()=>{const dir=path.resolve("tmp",`vf-remotion-${randomUUID()}`);await mkdir(dir,{recursive:true});try{const output=await renderRemotion(dir,0,{id:"test",title:"آزمون محلی",narration:"",visualPrompt:"TEST ONLY",motion:"CHART",chart:{labels:["الف","ب"],values:[1,2],unit:""},notes:"",sfxPrompt:"",revision:0,chapter:0,startFrame:0,durationFrames:24},720,720,true,AbortSignal.timeout(120000));expect((await stat(output)).size).toBeGreaterThan(1000);}finally{if(!dir.startsWith(path.resolve("tmp")+path.sep))throw Error("Unexpected test path");await rm(dir,{recursive:true,force:true});}},150000);
