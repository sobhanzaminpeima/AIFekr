/** Version 1: identical fixed-step simulation runs in the browser and on the server. */
export const gameSlugs = [
  "tower",
  "snake",
  "2048",
  "speed-run",
  "fiko-fly",
  "brain",
] as const;
export type GameSlug = (typeof gameSlugs)[number];
export type PlayInput = "left" | "right" | "up" | "down" | "tap" | "none";
export type ReplayEvent = { frame: number; input: PlayInput };
export type GameRules = { speedScale: number; pointScale: number };
export function gameRules(input: unknown): GameRules {
  const r = (
    input && typeof input === "object" ? input : {}
  ) as Partial<GameRules>;
  return {
    speedScale:
      typeof r.speedScale === "number" && Number.isFinite(r.speedScale)
        ? Math.max(0.5, Math.min(2, r.speedScale))
        : 1,
    pointScale:
      typeof r.pointScale === "number" && Number.isFinite(r.pointScale)
        ? Math.max(1, Math.min(3, Math.round(r.pointScale)))
        : 1,
  };
}
export type EngineState = {
  game: GameSlug;
  frame: number;
  score: number;
  over: boolean;
  won: boolean;
  seed: number;
  rng: number;
  board: number[];
  x: number;
  y: number;
  velocity: number;
  snake: number[];
  direction: number;
  food: number;
  obstacles: { x: number; y: number; passed: boolean }[];
  width: number;
  layers: { x: number; width: number }[];
  lane: number;
  distance: number;
  combo: number;
  rules: GameRules;
};
function random(s: EngineState) {
  let n = s.rng | 0;
  n ^= n << 13;
  n ^= n >>> 17;
  n ^= n << 5;
  s.rng = n >>> 0;
  return s.rng / 4294967296;
}
export function initializeGame(
  game: GameSlug,
  seed: number,
  rules?: unknown,
): EngineState {
  const s: EngineState = {
    game,
    frame: 0,
    score: 0,
    over: false,
    won: false,
    seed,
    rng: seed || 1,
    board: Array(16).fill(0),
    x: 0,
    y: 45,
    velocity: 0,
    snake: [210, 209, 208],
    direction: 1,
    food: 0,
    obstacles: [],
    width: 60,
    layers: [{ x: 20, width: 60 }],
    lane: 1,
    distance: 0,
    combo: 0,
    rules: gameRules(rules),
  };
  if (game === "2048") {
    spawnTile(s);
    spawnTile(s);
  }
  if (game === "snake") spawnFood(s);
  return s;
}
function spawnFood(s: EngineState) {
  const free = Array.from({ length: 400 }, (_, i) => i).filter(
    (i) => !s.snake.includes(i),
  );
  if (!free.length) {
    s.over = true;
    s.won = true;
    return;
  }
  s.food = free[Math.floor(random(s) * free.length)];
}
function spawnTile(s: EngineState) {
  const free = s.board.map((v, i) => (v === 0 ? i : -1)).filter((i) => i >= 0);
  if (free.length)
    s.board[free[Math.floor(random(s) * free.length)]] =
      random(s) < 0.9 ? 2 : 4;
}
function move2048(s: EngineState, input: PlayInput) {
  const d = ["left", "right", "up", "down"].indexOf(input);
  if (d < 0) return;
  const before = s.board.join(",");
  for (let line = 0; line < 4; line++) {
    const ids = Array.from({ length: 4 }, (_, i) =>
        d === 0
          ? line * 4 + i
          : d === 1
            ? line * 4 + 3 - i
            : d === 2
              ? i * 4 + line
              : (3 - i) * 4 + line,
      ),
      values = ids.map((i) => s.board[i]).filter(Boolean),
      out: number[] = [];
    for (let i = 0; i < values.length; i++) {
      if (values[i] === values[i + 1]) {
        const merged = values[i] * 2;
        out.push(merged);
        s.score += merged * s.rules.pointScale;
        i++;
        if (merged >= 2048) s.won = true;
      } else out.push(values[i]);
    }
    ids.forEach((id, i) => (s.board[id] = out[i] || 0));
  }
  if (s.board.join(",") === before) return;
  spawnTile(s);
  s.over =
    !s.board.includes(0) &&
    s.board.every(
      (v, i) =>
        (i % 4 === 3 || v !== s.board[i + 1]) &&
        (i >= 12 || v !== s.board[i + 4]),
    );
}
/** One frame = 50ms. Movement stays independent of browser refresh rate. */
export function stepGame(
  previous: EngineState,
  input: PlayInput = "none",
): EngineState {
  const s: EngineState = JSON.parse(JSON.stringify(previous));
  if (s.over) return s;
  s.frame++;
  if (s.frame >= 12000) {
    s.over = true;
    return s;
  }
  if (s.game === "2048") {
    move2048(s, input);
    return s;
  }
  if (s.game === "tower") {
    const speed =
        (1.2 + Math.min(s.layers.length, 40) * 0.08) * s.rules.speedScale,
      period = 2 * (100 - s.width),
      travel = (s.frame * speed) % period;
    s.x = travel <= 100 - s.width ? travel : period - travel;
    if (input === "tap") {
      const last = s.layers[s.layers.length - 1],
        left = Math.max(last.x, s.x),
        right = Math.min(last.x + last.width, s.x + s.width),
        overlap = right - left;
      if (overlap <= 0) {
        s.over = true;
        return s;
      }
      const perfect = Math.abs(last.x - s.x) < 1.5;
      s.combo = perfect ? s.combo + 1 : 0;
      s.score +=
        (10 + (perfect ? 5 : 0) + Math.min(10, s.combo)) * s.rules.pointScale;
      s.width = perfect ? last.width : overlap;
      s.layers.push({ x: perfect ? last.x : left, width: s.width });
      if (s.width < 1) s.over = true;
    }
    return s;
  }
  if (s.game === "snake") {
    const wanted = ["up", "right", "down", "left"].indexOf(input);
    if (wanted >= 0 && (wanted + 2) % 4 !== s.direction) s.direction = wanted;
    const interval = Math.max(
      1,
      Math.round((4 - Math.floor(s.score / 100)) / s.rules.speedScale),
    );
    if (s.frame % interval) return s;
    const head = s.snake[0],
      x = head % 20,
      y = Math.floor(head / 20),
      nx = x + [0, 1, 0, -1][s.direction],
      ny = y + [-1, 0, 1, 0][s.direction],
      next = ny * 20 + nx,
      growing = next === s.food;
    if (
      nx < 0 ||
      nx >= 20 ||
      ny < 0 ||
      ny >= 20 ||
      s.snake.slice(0, growing ? undefined : -1).includes(next)
    ) {
      s.over = true;
      return s;
    }
    s.snake.unshift(next);
    if (growing) {
      s.score += 10 * s.rules.pointScale;
      spawnFood(s);
    } else s.snake.pop();
    return s;
  }
  if (s.game === "speed-run") {
    if (input === "left") s.lane = Math.max(0, s.lane - 1);
    if (input === "right") s.lane = Math.min(2, s.lane + 1);
    const speed = (1 + Math.min(s.score / 300, 2)) * s.rules.speedScale;
    if (s.frame % 18 === 0)
      s.obstacles.push({ x: Math.floor(random(s) * 3), y: -10, passed: false });
    for (const o of s.obstacles) {
      o.y += speed;
      if (o.x === s.lane && o.y > 77 && o.y < 94) s.over = true;
      if (o.y > 94 && !o.passed) {
        o.passed = true;
        s.score += 10 * s.rules.pointScale;
      }
    }
    s.obstacles = s.obstacles.filter((o) => o.y < 110);
    s.distance += speed;
    return s;
  }
  if (s.game === "fiko-fly") {
    if (input === "tap" || input === "up") s.velocity = -2.5;
    s.velocity += 0.22;
    s.y += s.velocity;
    if (s.y < 0 || s.y > 100) s.over = true;
    if (s.frame % 45 === 0)
      s.obstacles.push({ x: 110, y: 22 + random(s) * 56, passed: false });
    for (const o of s.obstacles) {
      o.x -= (1.3 + Math.min(s.score / 100, 1)) * s.rules.speedScale;
      if (Math.abs(o.x - 24) < 7 && Math.abs(o.y - s.y) > 18) s.over = true;
      if (o.x < 18 && !o.passed) {
        o.passed = true;
        s.score += 10 * s.rules.pointScale;
      }
    }
    s.obstacles = s.obstacles.filter((o) => o.x > -10);
    return s;
  }
  return s;
}
export function validateReplay(
  game: GameSlug,
  seed: number,
  events: ReplayEvent[],
  frames: number,
  rules?: unknown,
) {
  if (game === "brain") throw Error("BRAIN_REQUIRES_SERVER_QUESTIONS");
  if (
    !Number.isInteger(frames) ||
    frames < 1 ||
    frames > 12000 ||
    events.length > 12000
  )
    throw Error("INVALID_REPLAY");
  let last = 0;
  for (const event of events) {
    if (
      !Number.isInteger(event.frame) ||
      event.frame <= last ||
      event.frame > frames ||
      !["left", "right", "up", "down", "tap"].includes(event.input)
    )
      throw Error("INVALID_REPLAY");
    last = event.frame;
  }
  let state = initializeGame(game, seed, rules),
    cursor = 0;
  for (let frame = 1; frame <= frames; frame++) {
    const event = events[cursor];
    state = stepGame(state, event?.frame === frame ? event.input : "none");
    if (event?.frame === frame) cursor++;
    if (state.over && frame < frames) throw Error("ACTIONS_AFTER_GAME_OVER");
  }
  return state;
}
