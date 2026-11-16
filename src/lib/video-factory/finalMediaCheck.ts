import { FactoryError } from "./errors";

/** Validate the delivered file, not just the individual rendered scenes. */
export function checkFinalMedia(info: {format?: {duration?: unknown}; streams?: {codec_type?: string}[]}, seconds:number, narrationRequired:boolean) {
  const duration=Number(info.format?.duration);
  if(!Number.isFinite(duration) || duration<=0 || Math.abs(duration-seconds)>.1 || !info.streams?.some(s=>s.codec_type==='video')) {
    throw new FactoryError('QC_DURATION_FAILED',503);
  }
  if(narrationRequired && !info.streams?.some(s=>s.codec_type==='audio')) {
    throw new FactoryError('QC_NARRATION_MISSING',503);
  }
}
