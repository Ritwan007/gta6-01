// Staged screenshot scenes behind ?shot=cover|beach|chase|finale.
// Each scene drives the REAL game through window.__NC (helpers defined in
// main.js), lets the loop run so the minimap/HUD draw, then sets
// window.__shotReady for the screenshot. No mockups: every frame is the
// running game.
export function stageShot(name) {
  const NC = window.__NC;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const ready = () => { window.__shotReady = true; };
  async function run() {
    if (name === 'cover') {
      // S1 cover: night Downtown neon street, player in a car in live
      // traffic, peds on sidewalks, 2 stars wanted, full HUD + minimap.
      NC.newGame();
      NC.dismissDialogue();
      NC.setTime(0.95); // deep night
      NC.teleport(0, 60);
      NC.enterCarById('sedan1');
      NC.teleport(0, 60);
      NC.setWanted(2);
      NC.setObjective('M1 First Run: Steal the GT coupe in Marina Luxe');
    } else if (name === 'beach') {
      // S2: Marina Luxe beachfront drive, day, traffic + peds.
      NC.newGame();
      NC.dismissDialogue();
      NC.setTime(0.35);
      NC.teleport(330, -40);
      NC.enterCarById('gt');
      NC.teleport(330, -40);
      NC.setHeading(-Math.PI / 2); // face east, toward the beach + ocean
      NC.setCamYaw(-Math.PI / 2); // camera behind, looking east
      NC.clearHeat(); // clean beachfront drive, no police in frame
      NC.setObjective('Free roam — Marina Luxe beachfront');
    } else if (name === 'chase') {
      // S3: 4-star police chase near Portside.
      NC.newGame();
      NC.dismissDialogue();
      NC.setTime(0.9);
      NC.teleport(60, -260);
      NC.enterCarById('truck1');
      NC.teleport(60, -260);
      NC.setCamYaw(Math.PI); // camera behind the southbound truck
      NC.setWanted(4);
      NC.setObjective('M3 Heat Sink: escape the 4-star pursuit');
    } else if (name === 'finale') {
      // S4: M8 port finale with a dialogue card visible.
      NC.newGame();
      NC.setTime(0.6); // dusk: the port skyline reads behind the card
      NC.teleport(60, -305);
      NC.setCamYaw(Math.PI); // camera north of Raka, looking south at the city
      NC.showDialogue('Dario Venn', 'So the driver finally shows up. Neon Coast was mine before you were born, Raka — and it stays mine tonight.', () => {});
      NC.setObjective('M8 Neon Reckoning: confront Dario Venn at the port');
    } else {
      NC.newGame();
    }
    await wait(2500);
    ready();
  }
  run();
}
