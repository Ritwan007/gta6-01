// logic.test.mjs — the rules of LEONIDA AFTER DARK, held to account.
//
// Runs headlessly under Node's own test runner (node --test tests/): the
// mission table and its money, the wanted rules, the save round trip and
// the debt ledger, all against game/src/logic.js with no browser involved.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MISSIONS, DEBT, START_CASH, totalRewards, missionByIndex,
  MAX_WANTED, CRIME_HEAT, raiseWanted, setWantedAtLeast, policeCountFor, coolWanted,
  bustFine, createSave, serializeSave, parseSave, nextMission,
  completeMission, debtRemaining, canPayDebt, payDebt,
  isRoad, isYard, blockCenters, clampToWorld,
} from "../game/src/logic.js";

test("the story has exactly nine missions with unique ids", () => {
  assert.equal(MISSIONS.length, 9);
  const ids = new Set(MISSIONS.map((m) => m.id));
  assert.equal(ids.size, 9);
  for (const m of MISSIONS) {
    assert.ok(m.title.length > 0, `${m.id} needs a title`);
    assert.ok(m.brief.length > 20, `${m.id} needs a real brief`);
    assert.ok(Array.isArray(m.points) && m.points.length >= 1, `${m.id} needs points`);
    assert.ok(m.reward > 0, `${m.id} needs a reward`);
  }
});

test("the nine missions pay more than the debt between them", () => {
  const total = totalRewards();
  assert.ok(total > DEBT, `total rewards ${total} must exceed the debt ${DEBT}`);
  assert.equal(total, MISSIONS.reduce((s, m) => s + m.reward, 0));
});

test("every mission kind the runner speaks is represented sanely", () => {
  const kinds = new Set(MISSIONS.map((m) => m.kind));
  for (const k of ["fare", "timed", "collect", "checkpoints", "follow", "steal", "escape"]) {
    assert.ok(kinds.has(k), `missing mission kind ${k}`);
  }
  for (const m of MISSIONS) {
    if (m.timeLimit !== undefined) assert.ok(m.timeLimit >= 60 && m.timeLimit <= 240);
    if (m.kind === "follow") {
      assert.ok(m.follow.minDist < m.follow.maxDist, "follow band must be a band");
    }
    if (m.kind === "checkpoints") assert.ok(m.points.length >= 5);
    if (m.kind === "collect") assert.ok(m.points.length >= 3);
  }
});

test("missionByIndex walks the table and stops at the end", () => {
  assert.equal(missionByIndex(0), MISSIONS[0]);
  assert.equal(missionByIndex(8), MISSIONS[8]);
  assert.equal(missionByIndex(9), null);
});

test("crimes raise the wanted level, capped and floored", () => {
  assert.equal(raiseWanted(0, "theft"), 1);
  assert.equal(raiseWanted(2, "assault"), 3);
  assert.equal(raiseWanted(MAX_WANTED, "theft"), MAX_WANTED);
  assert.equal(raiseWanted(0, "mission"), 0); // scripted heat is the mission's own business
  assert.equal(raiseWanted(3, "not-a-crime"), 3);
  for (const crime of Object.keys(CRIME_HEAT)) {
    assert.ok(raiseWanted(0, crime) >= 0);
  }
});

test("scripted heat sets a floor without lowering the level", () => {
  assert.equal(setWantedAtLeast(1, 3), 3);
  assert.equal(setWantedAtLeast(4, 2), 4);
  assert.equal(setWantedAtLeast(0, 99), MAX_WANTED);
});

test("police strength follows the wanted level", () => {
  assert.equal(policeCountFor(0), 0);
  assert.equal(policeCountFor(1), 1);
  assert.equal(policeCountFor(5), 5);
  assert.equal(policeCountFor(99), 5);
});

test("heat cools only while unseen, a star at a time", () => {
  assert.equal(coolWanted(3, 100, true), 3, "no cooling under police eyes");
  assert.equal(coolWanted(3, 10, false), 3, "ten clean seconds is not enough");
  assert.equal(coolWanted(3, 22, false), 2);
  assert.equal(coolWanted(3, 47, false), 1);
  assert.equal(coolWanted(1, 500, false), 0, "never below zero");
  assert.equal(coolWanted(0, 500, false), 0);
});

test("a bust costs a slice of the cash on hand, never more than there is", () => {
  assert.equal(bustFine(0), 0);
  assert.equal(bustFine(100), 100); // 150 + 12% would exceed the cash: capped
  assert.equal(bustFine(10000), 1350);
  assert.ok(bustFine(500) <= 500);
});

test("a fresh save starts broke, in debt and unfinished", () => {
  const save = createSave();
  assert.equal(save.cash, START_CASH);
  assert.equal(save.debtPaid, 0);
  assert.deepEqual(save.missionsDone, []);
  assert.equal(save.finished, false);
  assert.equal(debtRemaining(save), DEBT);
  assert.equal(nextMission(save), MISSIONS[0]);
});

test("the save survives a serialise/parse round trip", () => {
  const save = createSave();
  completeMission(save, MISSIONS[0]);
  completeMission(save, MISSIONS[1]);
  save.startedAt = 1763700000000;
  const back = parseSave(serializeSave(save));
  assert.deepEqual(back.missionsDone, ["first-fare", "hot-package"]);
  assert.equal(back.cash, save.cash);
  assert.equal(back.startedAt, 1763700000000);
  assert.equal(nextMission(back), MISSIONS[2]);
});

test("parseSave refuses junk and sanitises what it accepts", () => {
  assert.equal(parseSave(null), null);
  assert.equal(parseSave(""), null);
  assert.equal(parseSave("{not json"), null);
  assert.equal(parseSave("42"), null);
  const cleaned = parseSave(JSON.stringify({
    cash: -50, debtPaid: 10 ** 9, missionsDone: ["first-fare", "made-up-mission", 7],
    finished: 1,
  }));
  assert.equal(cleaned.cash, 0, "cash never goes negative");
  assert.equal(cleaned.debtPaid, DEBT, "debt paid never exceeds the debt");
  assert.deepEqual(cleaned.missionsDone, ["first-fare"], "unknown missions are dropped");
  assert.equal(cleaned.finished, true);
});

test("completing a mission pays once and moves the story on", () => {
  const save = createSave();
  const before = save.cash;
  assert.equal(completeMission(save, MISSIONS[0]), before + MISSIONS[0].reward);
  completeMission(save, MISSIONS[0]); // a replayed completion still pays the reward line once in the list
  assert.deepEqual(save.missionsDone, ["first-fare"]);
  assert.equal(nextMission(save), MISSIONS[1]);
});

test("the whole arc, played straight, clears the debt", () => {
  const save = createSave();
  for (const m of MISSIONS) completeMission(save, m);
  assert.equal(nextMission(save), null);
  assert.ok(save.cash > DEBT, "the arc must leave Jax able to pay");
  assert.equal(canPayDebt(save), true);
  const paid = payDebt(save);
  assert.equal(paid, DEBT);
  assert.equal(debtRemaining(save), 0);
  assert.equal(save.finished, true);
  assert.equal(save.cash, START_CASH + totalRewards() - DEBT);
});

test("payDebt pays only what the cash covers", () => {
  const save = createSave();
  save.cash = 4000;
  assert.equal(canPayDebt(save), false, "4000 does not cover a 25000 debt in full");
  const paid = payDebt(save);
  assert.equal(paid, 4000);
  assert.equal(save.cash, 0);
  assert.equal(debtRemaining(save), DEBT - 4000);
  assert.equal(save.finished, false);
});

test("the map knows its roads, yards and edges", () => {
  assert.ok(isRoad(0, 37), "avenue x=0 is a road anywhere along it");
  assert.ok(isRoad(-73, -110), "street z=-110 is a road");
  assert.ok(isRoad(132, 90), "Ocean Drive is a road");
  assert.ok(!isRoad(22, 0), "a block centre is not a road");
  assert.ok(isRoad(210, 44), "the pier deck is drivable");
  assert.ok(isYard(-210, 100), "the dockyard is open yard");
  assert.ok(isYard(-140, -132), "the impound is open yard");
  assert.ok(!isYard(0, 0));
  const blocks = blockCenters();
  assert.equal(blocks.length, 35);
  const p = clampToWorld({ x: 9999, z: -9999 });
  assert.ok(p.x <= 248 && p.z >= -152);
});
