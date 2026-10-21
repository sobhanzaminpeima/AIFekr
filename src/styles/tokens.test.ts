import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./tokens.css", import.meta.url), "utf8");
const parse = (block: string) => Object.fromEntries(Array.from(block.matchAll(/--([\w-]+):\s*(#[\da-f]{6});/gi)).map((m) => [m[1], m[2]]));
const dark = parse(css.split('[data-theme="light"]')[0]);
const light = { ...dark, ...parse(css.split('[data-theme="light"]')[1].split("@media")[0]) };
const luminance = (hex: string) => hex.slice(1).match(/../g)!.map((x) => parseInt(x, 16) / 255)
  .map((x) => x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)
  .reduce((sum, x, i) => sum + x * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a: string, b: string) => {
  const [low, high] = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (high + 0.05) / (low + 0.05);
};

describe.each([['dark', dark], ['light', light]] as const)('%s semantic contrast', (_, tokens) => {
  it('keeps body, muted and accent text readable on all content surfaces', () => {
    for (const text of ['text-primary', 'text-secondary', 'text-muted', 'accent']) {
      for (const surface of ['surface-0', 'surface-1', 'surface-2']) {
        expect(contrast(tokens[text], tokens[surface]), `${text} on ${surface}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
  it('keeps primary action labels and every status label readable', () => {
    for (const bg of ['action-bg', 'action-hover']) expect(contrast(tokens['action-text'], tokens[bg])).toBeGreaterThanOrEqual(4.5);
    for (const tone of ['success', 'warning', 'danger', 'info']) expect(contrast(tokens[tone], tokens[`${tone}-soft`])).toBeGreaterThanOrEqual(4.5);
  });
  it('keeps input boundaries and focus rings discernible', () => {
    expect(contrast(tokens['field-border'], tokens['surface-1'])).toBeGreaterThanOrEqual(3);
    for (const surface of ['surface-0', 'surface-1', 'surface-2']) expect(contrast(tokens['focus-ring'], tokens[surface])).toBeGreaterThanOrEqual(3);
  });
});
