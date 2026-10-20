import { expect, it } from "vitest";
import {
  initializeGame,
  stepGame,
  validateReplay,
  type GameSlug,
} from "./engine";
it("replays seeded 2048 moves identically and rejects duplicate frames", () => {
  const moves = [
    { frame: 1, input: "left" as const },
    { frame: 2, input: "down" as const },
  ];
  let s = initializeGame("2048", 123);
  for (const e of moves) s = stepGame(s, e.input);
  expect(validateReplay("2048", 123, moves, 2)).toEqual(s);
  expect(() => validateReplay("2048", 123, [moves[0], moves[0]], 2)).toThrow();
});
it("simulates all arcade games deterministically from server seeds", () => {
  for (const game of [
    "tower",
    "snake",
    "speed-run",
    "fiko-fly",
  ] as GameSlug[]) {
    let a = initializeGame(game, 987),
      b = initializeGame(game, 987);
    for (let i = 0; i < 20; i++) {
      a = stepGame(a, "none");
      b = stepGame(b, "none");
    }
    expect(a).toEqual(b);
  }
});
it("does not allow 2048 chain merging twice in one move", () => {
  const s = initializeGame("2048", 3);
  s.board = [2, 2, 4, 0, ...Array(12).fill(0)];
  const n = stepGame(s, "left");
  expect(n.board.slice(0, 2)).toEqual([4, 4]);
  expect(n.score).toBe(4);
});
it("does not accept client scores or trivia replays as verified arcade results", () => {
  expect(() => validateReplay("brain", 1, [], 10)).toThrow();
  expect(() => validateReplay("tower", 1, [], 999999)).toThrow();
});
it("awards tower overlap points and trims the placed block", () => {
  let s = initializeGame("tower", 12);
  for (let i = 0; i < 14; i++) s = stepGame(s);
  const placed = stepGame(s, "tap");
  expect(placed.score).toBeGreaterThanOrEqual(10);
  expect(placed.layers).toHaveLength(2);
  expect(placed.width).toBeLessThanOrEqual(60);
});
it("grows the snake on food and stops on a wall collision", () => {
  const s = initializeGame("snake", 5);
  s.food = 211;
  s.frame = 3;
  const grown = stepGame(s);
  expect(grown.score).toBe(10);
  expect(grown.snake).toHaveLength(4);
  grown.snake = [219, 218, 217];
  grown.frame = 7;
  expect(stepGame(grown).over).toBe(true);
});
it("checks road obstacle collision and legitimate passing", () => {
  const s = initializeGame("speed-run", 8);
  s.obstacles = [{ x: 1, y: 80, passed: false }];
  expect(stepGame(s).over).toBe(true);
  s.obstacles = [{ x: 0, y: 95, passed: false }];
  expect(stepGame(s).score).toBe(10);
});
it("applies FIKO gravity, tap lift, boundary and pipe collisions", () => {
  const s = initializeGame("fiko-fly", 3);
  expect(stepGame(s, "tap").y).toBeLessThan(s.y);
  s.y = 99;
  s.velocity = 5;
  expect(stepGame(s).over).toBe(true);
  s.y = 10;
  s.velocity = 0;
  s.obstacles = [{ x: 25, y: 70, passed: false }];
  expect(stepGame(s).over).toBe(true);
});
it("detects the 2048 win and rejects replay frames beyond game over", () => {
  const s = initializeGame("2048", 1);
  s.board = [1024, 1024, 0, 0, ...Array(12).fill(0)];
  expect(stepGame(s, "left").won).toBe(true);
  expect(() => validateReplay("snake", 1, [], 500)).toThrow(
    "ACTIONS_AFTER_GAME_OVER",
  );
});
