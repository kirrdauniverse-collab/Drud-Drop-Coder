// ===== Játékmód-gyár: a game.* blokkokból futtatható játék =====

import type { GameCtx, GameMode } from "./base";
import { FpsGame } from "./fps";
import { RaceGame } from "./race";
import { WormsGame } from "./worms";
import { BuildGame } from "./build";
import { AdventureGame } from "./adventure";
import { OnlineGame } from "./online";

export type { GameCtx, GameMode } from "./base";

export function createGameMode(
  typeId: string,
  params: Record<string, string | number | boolean>,
  ctx: GameCtx,
): GameMode {
  switch (typeId) {
    case "game.fps":
      return new FpsGame(params, ctx);
    case "game.race":
      return new RaceGame(params, ctx);
    case "game.worms":
      return new WormsGame(params, ctx);
    case "game.build":
      return new BuildGame(params, ctx);
    case "game.adventure":
      return new AdventureGame(params, ctx);
    case "game.online":
      return new OnlineGame(params, ctx);
    default:
      // ismeretlen ID: ne dőljön el, egy minimal üzenet-játékot adunk
      return new AdventureGame({ story: "kastely", ...params, target: -1 }, ctx);
  }
}

export const GAME_BLOCK_LABELS: Record<string, string> = {
  "game.fps": "FPS labirintus",
  "game.race": "Verseny",
  "game.worms": "Féregcsata",
  "game.build": "Építőmester",
  "game.adventure": "Grafikus kaland",
  "game.online": "Online párbaj",
};
