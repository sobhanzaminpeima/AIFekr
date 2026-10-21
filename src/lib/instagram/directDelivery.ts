export const MAX_DIRECT_DELAY_SECONDS = 5;

export interface DirectDeliveryOptions {
  followGateEnabled: boolean;
  typingIndicatorEnabled: boolean;
  delayMinSeconds: number;
  delayMaxSeconds: number;
}

export function parseDirectDeliveryOptions(input: Record<string, unknown>): DirectDeliveryOptions | null {
  const min = input.delayMinSeconds === undefined ? 0 : Number(input.delayMinSeconds);
  const max = input.delayMaxSeconds === undefined ? 0 : Number(input.delayMaxSeconds);
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max > MAX_DIRECT_DELAY_SECONDS || min > max) {
    return null;
  }
  if (input.followGateEnabled !== undefined && typeof input.followGateEnabled !== "boolean") return null;
  if (input.typingIndicatorEnabled !== undefined && typeof input.typingIndicatorEnabled !== "boolean") return null;
  return {
    followGateEnabled: input.followGateEnabled === true,
    typingIndicatorEnabled: input.typingIndicatorEnabled === true,
    delayMinSeconds: min,
    delayMaxSeconds: max,
  };
}

export function chooseDirectDelaySeconds(
  min: number,
  max: number,
  random: () => number = Math.random,
): number {
  const safeMin = Math.max(0, Math.min(MAX_DIRECT_DELAY_SECONDS, Math.trunc(min)));
  const safeMax = Math.max(safeMin, Math.min(MAX_DIRECT_DELAY_SECONDS, Math.trunc(max)));
  if (safeMin === safeMax) return safeMin;
  const sample = Math.min(0.999999999, Math.max(0, random()));
  return safeMin + Math.floor(sample * (safeMax - safeMin + 1));
}

export function delayForDirectReply(seconds: number): Promise<void> {
  if (seconds <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}
