// missions.js — Madame Zara's nine jobs: pure definitions plus the
// MissionDirector state machine that walks a player through their stages.
// No three.js and no DOM: game.js feeds it positions and events each frame and
// renders whatever the director says the objective is. The Node test suite
// drives this same machine through every mission to prove the story completes.

import { DAWN_RUN_GATES, LANDMARKS as L, STAR_CACHE_POINTS } from './cityplan.js';
import { groundDistance } from './rng.js';

export const DEBT = 25000;

export const MISSIONS = [
  {
    id: 'neon-welcome',
    title: 'Neon Welcome',
    brief: 'Zara: "My coupe, my rules. Take her to the Palms Royale and don\'t scratch the paint."',
    reward: 1200,
    stages: [{ kind: 'goto', at: L.hotelFront, radius: 9, label: 'Drive to the Palms Royale' }],
  },
  {
    id: 'the-package',
    title: 'The Package',
    brief: 'Zara: "A crate is waiting at the marina warehouse. It goes to the Ocean Drive garage. No questions."',
    reward: 2000,
    stages: [
      { kind: 'pickup', at: L.marinaWarehouse, radius: 8, label: 'Collect the crate at the marina warehouse' },
      { kind: 'goto', at: L.oceanGarage, radius: 9, label: 'Deliver the crate to the Ocean Drive garage' },
    ],
  },
  {
    id: 'eyes-on-the-mark',
    title: 'Eyes on the Mark',
    brief: 'Zara: "The silver Comet is Cielo\'s bagman. Stay on him — close enough to see, far enough to breathe."',
    reward: 2400,
    stages: [{ kind: 'tail', duration: 45, label: 'Tail the silver Comet (stay 16–60 m back)' }],
  },
  {
    id: 'starlight-run',
    title: 'Starlight Run',
    brief: 'Zara: "Five star caches lit across the city before the buyer changes his mind. Move."',
    reward: 2600,
    stages: [{ kind: 'collect', points: STAR_CACHE_POINTS, radius: 7, timeLimit: 170, label: 'Collect the star caches' }],
  },
  {
    id: 'sirens',
    title: 'Sirens',
    brief: 'Zara: "The overlook meet is a set-up — Meridian PD is already rolling. Lose them and come home."',
    reward: 3000,
    stages: [
      { kind: 'goto', at: { x: 64, z: -128 }, radius: 9, label: 'Go to the overlook meet' },
      { kind: 'escape', at: L.safehouse, radius: 10, heatStars: 2, label: 'Lose the police and reach the safehouse' },
    ],
  },
  {
    id: 'dockside-ghost',
    title: 'Dockside Ghost',
    brief: 'Zara: "The Cielo ledger sits in the dockyard, and cameras hate a face. Go on foot, ghost."',
    reward: 2800,
    stages: [
      { kind: 'goto', at: L.ledgerCrate, radius: 4, needFoot: true, label: 'Take the ledger from the dockyard (on foot)' },
      { kind: 'goto', at: L.dockGate, radius: 9, label: 'Get back to the dock gate' },
    ],
  },
  {
    id: 'repo-man',
    title: 'Repo Man',
    brief: 'Zara: "A gold Vortex GT sits at the Casino Cielo valet, and its owner owes us. It is yours now. Bring it to my yard."',
    reward: 3400,
    stages: [
      { kind: 'steal', at: L.casinoValet, radius: 6, label: 'Steal the gold Vortex GT from the casino valet' },
      { kind: 'goto', at: L.zaraYard, radius: 10, label: 'Deliver the Vortex to Zara\'s yard' },
    ],
  },
  {
    id: 'the-exchange',
    title: 'The Exchange',
    brief: 'Zara: "Meet the buyer at the pier. If it smells wrong, it is wrong — run for the boathouse."',
    reward: 4200,
    stages: [
      { kind: 'goto', at: L.pierMeet, radius: 8, label: 'Meet the buyer at the pier' },
      { kind: 'escape', at: L.boathouse, radius: 10, heatStars: 3, label: 'Escape to the boathouse' },
    ],
  },
  {
    id: 'dawn-run',
    title: 'Dawn Run',
    brief: 'Zara: "Last job, Nico. Six gates, one sunrise. Pay the Cielo debt and Port Meridian is yours."',
    reward: 6000,
    stages: [{ kind: 'gates', points: DAWN_RUN_GATES, radius: 10, timeLimit: 260, label: 'Run the six dawn gates' }],
  },
];

/**
 * Walks one player through MISSIONS. Hooks (all optional):
 * onMissionStart(mission, index), onStage(stage, mission),
 * onMessage(text), onMissionComplete(mission, index), onAllComplete(),
 * onMissionFailed(mission, reason).
 */
export class MissionDirector {
  constructor(hooks = {}) {
    this.hooks = hooks;
    this.index = -1;
    this.stageIndex = 0;
    this.done = false;
    this.resetStageState();
  }

  get mission() {
    return this.index >= 0 && this.index < MISSIONS.length ? MISSIONS[this.index] : null;
  }

  get stage() {
    const mission = this.mission;
    return mission ? mission.stages[this.stageIndex] ?? null : null;
  }

  resetStageState() {
    this.stageTime = 0;
    this.tailProgress = 0;
    this.spookTimer = 0;
    this.loseTimer = 0;
    this.collected = new Set();
    this.gateIndex = 0;
    this.timeLeft = null;
  }

  startAt(index) {
    this.index = index;
    this.stageIndex = 0;
    this.done = false;
    this.resetStageState();
    const mission = this.mission;
    if (mission) {
      this.beginStageTimer();
      this.hooks.onMissionStart?.(mission, index);
      this.hooks.onStage?.(this.stage, mission);
    } else {
      this.done = true;
      this.hooks.onAllComplete?.();
    }
  }

  beginStageTimer() {
    const stage = this.stage;
    this.timeLeft = stage && stage.timeLimit ? stage.timeLimit : null;
  }

  /** The point the HUD marker should point at right now, or null (tail stages track a car, not a point). */
  stageTarget() {
    const stage = this.stage;
    if (!stage) return null;
    if (stage.kind === 'collect') {
      let best = null;
      let bestDist = Infinity;
      for (let i = 0; i < stage.points.length; i += 1) {
        if (this.collected.has(i)) continue;
        const d = this.lastPos ? groundDistance(this.lastPos, stage.points[i]) : 0;
        if (d < bestDist) {
          bestDist = d;
          best = stage.points[i];
        }
      }
      return best;
    }
    if (stage.kind === 'gates') return stage.points[this.gateIndex] ?? null;
    return stage.at ?? null;
  }

  objectiveText() {
    const stage = this.stage;
    if (!stage) return this.done ? 'Free roam — Port Meridian is yours.' : '';
    if (stage.kind === 'collect') return `${stage.label} (${this.collected.size}/${stage.points.length})`;
    if (stage.kind === 'gates') return `${stage.label} (${this.gateIndex}/${stage.points.length})`;
    if (stage.kind === 'tail') return `${stage.label} — ${Math.floor(this.tailProgress)}/${stage.duration}s`;
    return stage.label;
  }

  /** Events from the game world that are not positions: entering the marked car, and so on. */
  notify(event) {
    const stage = this.stage;
    if (!stage) return;
    if (event === 'enteredTargetCar' && stage.kind === 'steal') this.completeStage();
  }

  completeStage() {
    const mission = this.mission;
    if (!mission) return;
    if (this.stageIndex + 1 < mission.stages.length) {
      this.stageIndex += 1;
      this.resetStageState();
      this.beginStageTimer();
      this.hooks.onStage?.(this.stage, mission);
    } else {
      const finished = mission;
      const finishedIndex = this.index;
      this.hooks.onMissionComplete?.(finished, finishedIndex);
      this.startAt(finishedIndex + 1);
    }
  }

  failMission(reason) {
    const mission = this.mission;
    if (!mission) return;
    this.hooks.onMissionFailed?.(mission, reason);
    this.stageIndex = 0;
    this.resetStageState();
    this.beginStageTimer();
    this.hooks.onStage?.(this.stage, mission);
  }

  /**
   * Advance the machine. ctx: { pos:{x,z}, onFoot:boolean, stars:number,
   * targetDistance:number|null } — targetDistance is for tail stages.
   */
  update(dt, ctx) {
    const stage = this.stage;
    if (!stage || this.done) return;
    this.lastPos = ctx.pos;
    this.stageTime += dt;

    if (this.timeLeft !== null) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.failMission('Out of time');
        return;
      }
    }

    switch (stage.kind) {
      case 'goto':
      case 'pickup': {
        if (stage.needFoot && !ctx.onFoot) break;
        if (groundDistance(ctx.pos, stage.at) <= stage.radius) this.completeStage();
        break;
      }
      case 'collect': {
        for (let i = 0; i < stage.points.length; i += 1) {
          if (!this.collected.has(i) && groundDistance(ctx.pos, stage.points[i]) <= stage.radius) {
            this.collected.add(i);
            this.hooks.onMessage?.(`Cache ${this.collected.size} of ${stage.points.length}`);
            if (this.collected.size === stage.points.length) {
              this.completeStage();
              return;
            }
          }
        }
        break;
      }
      case 'gates': {
        const gate = stage.points[this.gateIndex];
        if (gate && groundDistance(ctx.pos, gate) <= stage.radius) {
          this.gateIndex += 1;
          this.hooks.onMessage?.(`Gate ${this.gateIndex} of ${stage.points.length}`);
          if (this.gateIndex >= stage.points.length) {
            this.completeStage();
            return;
          }
        }
        break;
      }
      case 'escape': {
        if (ctx.stars === 0 && groundDistance(ctx.pos, stage.at) <= stage.radius) this.completeStage();
        break;
      }
      case 'tail': {
        const d = ctx.targetDistance;
        if (d === null || d === undefined) break;
        if (d < 9) {
          this.spookTimer += dt;
          if (this.spookTimer > 2.5) {
            this.tailProgress = Math.max(0, this.tailProgress - 10);
            this.spookTimer = 0;
            this.hooks.onMessage?.('Too close — he nearly made you. Back off.');
          }
        } else if (d > 110) {
          this.loseTimer += dt;
          if (this.loseTimer > 5) {
            this.tailProgress = 0;
            this.loseTimer = 0;
            this.hooks.onMessage?.('You lost him. Pick up the tail again.');
          }
        } else {
          this.spookTimer = Math.max(0, this.spookTimer - dt);
          this.loseTimer = Math.max(0, this.loseTimer - dt);
          if (d >= 16 && d <= 60) {
            this.tailProgress += dt;
            if (this.tailProgress >= stage.duration) {
              this.completeStage();
              return;
            }
          }
        }
        break;
      }
      default:
        break; // 'steal' completes through notify()
    }
  }
}
