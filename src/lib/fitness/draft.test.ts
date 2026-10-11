import {it,expect} from "vitest";
import {recoverWorkoutDraft} from "./draft";
const session={id:"session",userId:"owner",revision:1,status:"IN_PROGRESS",programSnapshot:"[]"};
const sets=[{exerciseId:"exercise",setNumber:1,repetitions:8,weightGrams:1000,completed:true}];
it("never restores another account's local draft",()=>{expect(recoverWorkoutDraft({session,sets},"other",[session])).toBeNull();});
it("does not resurrect a completed or deleted workout",()=>{expect(recoverWorkoutDraft({session,sets},"owner",[{...session,status:"COMPLETED"}])).toBeNull();expect(recoverWorkoutDraft({session,sets},"owner",[])).toBeNull();});
it("preserves unsynced sets only for the current server revision",()=>{expect(recoverWorkoutDraft({session,sets},"owner",[session])?.sets).toEqual(sets);expect(recoverWorkoutDraft({session,sets},"owner",[{...session,revision:2,sets:[]}])?.sets).toEqual([]);});
