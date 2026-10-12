import {it,expect} from "vitest";
import {validateXeRates} from "./xe";
const now=new Date("2026-10-12T00:00:00Z"),data={from:"USD",amount:1,timestamp:"2026-10-11T00:00:00Z",to:[{quotecurrency:"TRY",mid:49.419403874},{quotecurrency:"EUR",mid:0.8927348757}]};
it("accepts supported XE rates with their provider timestamp",()=>{expect(validateXeRates(data,now).rates).toEqual([{target:"TRY",rate:"49.419403874"},{target:"EUR",rate:"0.8927348757"}]);});
it("rejects stale, future, incomplete and unofficial toman payloads",()=>{for(const invalid of [{...data,timestamp:"2026-10-01T00:00:00Z"},{...data,timestamp:"2026-10-13T00:00:00Z"},{...data,to:[data.to[0]]},{...data,to:[data.to[0],{quotecurrency:"IRR",mid:42000}]}])expect(()=>validateXeRates(invalid,now)).toThrow();});
it("rejects duplicate currencies and negative rates",()=>{expect(()=>validateXeRates({...data,to:[data.to[0],data.to[0]]},now)).toThrow();expect(()=>validateXeRates({...data,to:[{...data.to[0],mid:-1},data.to[1]]},now)).toThrow();});
