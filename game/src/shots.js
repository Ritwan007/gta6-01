// shots.js — the four staged scenes the screenshot harness captures. Each
// scene is REAL gameplay state (the director, the wanted system, traffic and
// police all genuinely running), posed for the camera: prepareShot() sets the
// state and returns how many fixed steps to settle, poseShotCamera() then
// frames the shot from wherever the simulation ended up.

import * as THREE from 'three';
import { LANDMARKS as L } from './cityplan.js';
import { forwardOf } from './vehicles.js';

function placeCar(car, x, z, heading) {
  car.pos = { x, z };
  car.heading = heading;
  car.speed = 0;
  car.mesh.position.set(x, 0, z);
  car.mesh.rotation.y = heading;
}

function pose(game, camPos, lookAt) {
  game.cameraOverride = {
    pos: new THREE.Vector3(camPos[0], camPos[1], camPos[2]),
    look: new THREE.Vector3(lookAt[0], lookAt[1], lookAt[2]),
  };
  // Apply immediately too: the harness renders without stepping again.
  game.camera.position.set(camPos[0], camPos[1], camPos[2]);
  game.camera.lookAt(lookAt[0], lookAt[1], lookAt[2]);
}

export function prepareShot(game, name) {
  game.startGame(false);
  switch (name) {
    case 'cover': {
      // Nico in Zara's coupe, parked on Ocean Drive under the Palms Royale.
      // Settle long enough for the mission card to fade: the hotel is the hero.
      placeCar(game.coupe, 202, 88, Math.PI * 0.75);
      game.enterCar(game.coupe);
      return 420;
    }
    case 'chase': {
      // Mission 5's escape, staged at its hottest: three stars, cruisers in.
      game.director.startAt(4);
      game.wanted.setMinimumStars(3);
      placeCar(game.coupe, L.overlook?.x ?? 64, -128, Math.PI / 2);
      game.enterCar(game.coupe);
      return 300;
    }
    case 'docks': {
      // Mission 6 on foot: the ledger crate glowing between the warehouses.
      game.director.startAt(5);
      game.playerPos = { x: -170, z: 87 };
      game.playerHeading = Math.atan2(L.ledgerCrate.x + 170, L.ledgerCrate.z - 87);
      placeCar(game.coupe, -146, 106, 0.6);
      return 75;
    }
    case 'city': {
      // The grid from above: avenues, neon crowns, the bay beyond.
      game.director.startAt(1);
      placeCar(game.coupe, 2, 34, Math.PI);
      game.enterCar(game.coupe);
      game.coupe.speed = 12;
      return 240;
    }
    default:
      return 60;
  }
}

export function poseShotCamera(game, name) {
  switch (name) {
    case 'cover': {
      // The mission card has faded by now in real play; match that state.
      document.getElementById('card').style.opacity = '0';
      pose(game, [209, 1.7, 97], [190, 5, 55]);
      break;
    }
    case 'chase': {
      // Restage the escape mid-flight on the avenue, towers on both sides,
      // then dress the two nearest cruisers into the frame behind the coupe.
      const car = game.coupe;
      placeCar(car, 64, -30, 0);
      car.speed = 16;
      const f = forwardOf(car.heading);
      const right = { x: f.z, z: -f.x };
      const behind = game.police.cruisers
        .filter((c) => c.active)
        .slice(0, 2);
      behind.forEach((cruiser, i) => {
        const side = i === 0 ? -3.5 : 4.2;
        const back = i === 0 ? 6.5 : 9.5;
        cruiser.pos.x = car.pos.x - f.x * back + right.x * side;
        cruiser.pos.z = car.pos.z - f.z * back + right.z * side;
        cruiser.heading = car.heading;
        cruiser.speed = 15;
        cruiser.syncMesh();
      });
      pose(
        game,
        [car.pos.x - f.x * 13.5 + right.x * -5.5, 3.9, car.pos.z - f.z * 13.5 + right.z * -5.5],
        [car.pos.x + f.x * 9, 1.2, car.pos.z + f.z * 9],
      );
      break;
    }
    case 'docks': {
      pose(game, [-158, 2.6, 96], [-172, 1.6, 83]);
      break;
    }
    case 'city': {
      pose(game, [-56, 47, 122], [44, 0, -34]);
      break;
    }
    default:
      pose(game, [0, 30, 80], [0, 0, 0]);
  }
}
