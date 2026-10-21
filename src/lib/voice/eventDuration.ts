const NO_CONNECTION = new Set(["customer-did-not-answer", "customer-busy", "customer-did-not-answer-phone", "phone-call-provider-bypass-enabled-but-no-call-received", "assistant-request-returned-error", "assistant-request-returned-no-assistant", "assistant-not-found"]);
export function eventDuration(message: {durationSeconds?:number;endedReason?:string;startedAt?:string;endedAt?:string;call?:{startedAt?:string;endedAt?:string}}) {
  if(NO_CONNECTION.has(message.endedReason || ""))return 0;
  const seconds=message.durationSeconds ?? (Date.parse(message.endedAt || message.call?.endedAt || "")-Date.parse(message.startedAt || message.call?.startedAt || ""))/1000;
  if(!Number.isFinite(seconds)||seconds<0||seconds>86400)throw new Error("INVALID_CALL_DURATION");
  return seconds;
}
