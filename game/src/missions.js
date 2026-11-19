// NEON COAST: UNDERWORLD — mission definitions (gta6-01, round 12).
// 8 story missions. Objectives are data; the engine in main.js interprets
// each step type: goto, enterCar, deliver, interact, rob, choice, race,
// defend, finale. Rewards are cash paid on completion.
export const MISSIONS = [
  { id: 'M1', name: 'First Run', giver: 'Vera Kade',
    intro: 'Vera needs a GT coupe from Marina Luxe. Steal it. Bring it to my garage. No scratches — well, few scratches.',
    reward: 400,
    steps: [
      { type: 'enterCar', carId: 'gt', text: 'Steal the GT coupe in Marina Luxe (east, x 143, z -60)' },
      { type: 'deliver', point: 'garage', text: 'Deliver the GT coupe to Vera\'s garage (-250, 172)' },
    ] },
  { id: 'M2', name: 'Hot Cargo', giver: 'Vera Kade',
    intro: 'A van full of "spare parts" waits in Portside. Get it to Aero Field. 120 seconds. Cops hate late deliveries.',
    reward: 550, timeLimit: 120,
    steps: [
      { type: 'enterCar', carId: 'van1', text: 'Take the van at Portside (307, 200)' },
      { type: 'deliver', point: 'aero', text: 'Deliver the van to Aero Field (-330, 330) before time runs out', timed: true },
    ] },
  { id: 'M3', name: 'Heat Sink', giver: 'Det. Mara Ilves',
    intro: 'Ilves wants you visible — then gone. Hit 3 stars of heat, then vanish into the Undertow tunnel hideout.',
    reward: 600,
    steps: [
      { type: 'wanted', level: 3, text: 'Raise your wanted level to 3 stars (steal a car, cause chaos)' },
      { type: 'goto', point: 'hideout', text: 'Escape to the Undertow tunnel hideout (-250, 292)' },
    ] },
  { id: 'M4', name: 'Coral Row Job', giver: 'Vera Kade',
    intro: 'The jeweller on Coral Row keeps its diamonds in the back. Walk in, take them, and get out clean.',
    reward: 800,
    steps: [
      { type: 'rob', shopId: 'jewel', text: 'Rob the Coral Row Jewellers (125, 155) — press E at the door' },
      { type: 'deliver', point: 'garage', text: 'Getaway: reach Vera\'s garage (-250, 172)' },
    ] },
  { id: 'M5', name: 'The Choice', giver: 'Vera Kade / Det. Ilves',
    intro: 'A ledger that can sink Dario Venn — or Vera. Who gets it? Choose carefully. There is no going back.',
    reward: 700, branch: true,
    steps: [
      { type: 'choice', text: 'Deliver the ledger: Vera\'s garage, or Det. Ilves at Civic Center HQ (200, -200)?' },
      { type: 'deliver', point: 'choice', text: 'Deliver the ledger to your chosen side' },
    ] },
  { id: 'M6', name: 'Ridge Run', giver: 'Vera Kade',
    intro: 'Two of Dario\'s drivers think they own Sierra Ridge. Prove them wrong. Three checkpoints. Fastest wins.',
    reward: 900,
    steps: [
      { type: 'race', checkpoints: [[-330, -100], [-360, 60], [-330, 220]], text: 'Race the Sierra Ridge checkpoints — beat the rival drivers' },
    ] },
  { id: 'M7', name: 'Port Fire', giver: 'Vera Kade',
    intro: 'Dario\'s crew is hitting our warehouse. Hold the line. Six of them. Make it count.',
    reward: 1000,
    steps: [
      { type: 'defend', point: 'warehouse', count: 6, text: 'Defend the warehouse (-200, -330): stop all 6 attackers' },
    ] },
  { id: 'M8', name: 'Neon Reckoning', giver: 'Vera Kade',
    intro: 'Dario Venn is at the port, waiting. Tonight Neon Coast picks a side. So do you.',
    reward: 1500, finale: true,
    steps: [
      { type: 'goto', point: 'port', text: 'Confront Dario Venn at the port (60, -330)' },
      { type: 'finale', text: 'Choose the ending: side with Vera, or side with Det. Ilves?' },
    ] },
];

export const WEAPONS = [
  { id: 'baton', name: 'Baton', slot: 1, damage: 25, rate: 2.2, range: 3, auto: false, ammo: Infinity },
  { id: 'pistol', name: 'VK-9 Pistol', slot: 2, damage: 34, rate: 3.5, range: 45, auto: false, ammo: 120 },
  { id: 'smg', name: 'Rattler SMG', slot: 3, damage: 18, rate: 9, range: 38, auto: true, ammo: 240 },
  { id: 'shotgun', name: 'Breaker-12', slot: 4, damage: 22, rate: 1.1, range: 26, auto: false, ammo: 40, pellets: 6 },
];

export const UPGRADES = [
  { id: 'engine', name: 'Engine Tuning', max: 4, cost: 300, desc: '+12% top speed / level' },
  { id: 'armor', name: 'Body Armor', max: 4, cost: 250, desc: '-8% damage taken / level' },
  { id: 'stamina', name: 'Stamina Training', max: 4, cost: 200, desc: '+25 max stamina / level' },
  { id: 'charm', name: 'Silver Tongue', max: 4, cost: 200, desc: '-5% shop prices / level' },
];

export const SHOP_ITEMS = [
  { id: 'health', name: 'Medkit (+50 HP)', cost: 60 },
  { id: 'armor', name: 'Armor Vest (+50 armor)', cost: 50 },
  { id: 'ammo-pistol', name: 'VK-9 Ammo (+60)', cost: 40 },
  { id: 'ammo-smg', name: 'Rattler Ammo (+120)', cost: 55 },
  { id: 'ammo-shotgun', name: 'Breaker-12 Shells (+24)', cost: 45 },
];
