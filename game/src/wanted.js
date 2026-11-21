// wanted.js — the pure rules of Meridian PD attention: how heat points become
// stars, how fast heat cools when nobody is watching, and when a stop becomes
// a bust. No three.js here: police.js drives the cars, this file only decides.

export const HEAT_EVENTS = {
  hitCar: 14,
  hitPoliceCar: 38,
  hitPedestrian: 34,
  hitProp: 5,
  shovePedestrian: 22,
  stealCar: 10,
  speedingNearPolice: 4,
};

// Heat points at which each star lights. Index = stars (0..5).
const STAR_THRESHOLDS = [0, 1, 25, 60, 110, 175];
export const MAX_HEAT = 260;

export function starsForHeat(heat) {
  let stars = 0;
  for (let i = 1; i < STAR_THRESHOLDS.length; i += 1) {
    if (heat >= STAR_THRESHOLDS[i]) stars = i;
  }
  return stars;
}

/** Heat cools only while unseen; the drain is slow enough to make hiding a plan, not a pause. */
export const HEAT_DRAIN_PER_SECOND = 3.2;
export const UNSEEN_GRACE_SECONDS = 5;

/** How close and how slow a player must be, and for how long, before the bust lands. */
export const BUST_RADIUS = 10;
export const BUST_SPEED = 2.5;
export const BUST_SECONDS = 2.6;

/** A small state machine for one player's wanted level. */
export class WantedLevel {
  constructor() {
    this.heat = 0;
    this.unseenFor = 0;
    this.bustMeter = 0; // 0..1
  }

  get stars() {
    return starsForHeat(this.heat);
  }

  /** Add heat from an event name in HEAT_EVENTS (or a raw point count). */
  addHeat(eventOrPoints) {
    const points = typeof eventOrPoints === 'string' ? HEAT_EVENTS[eventOrPoints] ?? 0 : eventOrPoints;
    this.heat = Math.min(MAX_HEAT, this.heat + points);
    if (points > 0) this.unseenFor = 0;
  }

  /** Force at least this many stars (missions use it when the story says the PD is already coming). */
  setMinimumStars(stars) {
    const floor = STAR_THRESHOLDS[Math.min(stars, 5)];
    if (this.heat < floor) this.heat = floor;
  }

  clear() {
    this.heat = 0;
    this.unseenFor = 0;
    this.bustMeter = 0;
  }

  /**
   * Advance one frame. `seen` is whether any officer currently has eyes on the
   * player; `nearestOfficer` is {distance, playerSpeed} for the bust rule.
   * Returns 'busted' on the frame the bust lands, else null.
   */
  update(dt, seen, nearestOfficer) {
    if (seen) {
      this.unseenFor = 0;
    } else {
      this.unseenFor += dt;
      if (this.unseenFor > UNSEEN_GRACE_SECONDS && this.heat > 0) {
        this.heat = Math.max(0, this.heat - HEAT_DRAIN_PER_SECOND * dt);
      }
    }
    if (
      nearestOfficer &&
      nearestOfficer.distance < BUST_RADIUS &&
      nearestOfficer.playerSpeed < BUST_SPEED &&
      this.stars > 0
    ) {
      this.bustMeter += dt / BUST_SECONDS;
      if (this.bustMeter >= 1) return 'busted';
    } else {
      this.bustMeter = Math.max(0, this.bustMeter - dt / (BUST_SECONDS * 1.6));
    }
    return null;
  }
}
