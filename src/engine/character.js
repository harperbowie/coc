const names = require('../content/character/names.json');
const occupations = require('../content/character/occupations.json');
const experiences = require('../content/character/experiences.json');

function d100() { return Math.floor(Math.random() * 100) + 1; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function baseStats() {
  return {
    STR: d100(), CON: d100(), SIZ: d100(), DEX: d100(),
    APP: d100(), INT: d100(), POW: d100(), EDU: d100()
  };
}

function derived(stats) {
  const HP_max = Math.floor((stats.CON + stats.SIZ) / 20);
  const SAN_max = stats.POW;
  const MP = Math.floor(stats.POW / 5);
  return {
    HP: HP_max, HP_max,
    SAN: SAN_max, SAN_max,
    MP,
    Luck: d100(),
    damageBonus: '0',
    build: 0,
    move: 8
  };
}

function baseSkills() {
  return {
    'Fighting (Brawl)': 25,
    'Firearms (Handgun)': 20,
    'First Aid': 30,
    'Library Use': 20,
    'Spot Hidden': 25,
    'Psychology': 10,
    'Stealth': 20,
    'Listen': 20,
    'Persuade': 10,
    'Occult': 5
  };
}

function generateInvestigator(id) {
  const stats = baseStats();
  const occ = pick(occupations);
  const skills = baseSkills();
  Object.keys(occ.skill_bonus).forEach((k) => {
    skills[k] = (skills[k] || 0) + occ.skill_bonus[k];
  });

  return {
    id,
    name: pick(names),
    occupation: occ.name,
    experience: pick(experiences),
    stats,
    derived: derived(stats),
    skills,
    inventory: ['手电筒', '笔记本'],
    cash: 20,
    conditions: [],
    phobias: [],
    experience_tags: []
  };
}

module.exports = { generateInvestigator };
