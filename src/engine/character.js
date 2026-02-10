const nameData = require('../content/character/names.json');
const occupations = require('../content/character/occupations.json');
const experiences = require('../content/character/experiences.json');

const ATTRS = ['STR', 'CON', 'SIZ', 'DEX', 'APP', 'INT', 'POW', 'EDU'];

function d100() { return Math.floor(Math.random() * 100) + 1; }
function d6() { return Math.floor(Math.random() * 6) + 1; }
function roll3d6x5() { return (d6() + d6() + d6()) * 5; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function uniqueName(usedNames = new Set()) {
  const gender = Math.random() < 0.5 ? 'male' : 'female';
  const first = pick(gender === 'male' ? nameData.male_first_names : nameData.female_first_names);
  const last = pick(nameData.last_names);
  const name = `${first} ${last}`;
  if (usedNames.has(name)) return uniqueName(usedNames);
  usedNames.add(name);
  return { gender, name };
}

function buildBaseSkills() {
  return {
    'Fighting (Brawl)': 25,
    'Firearms (Handgun)': 20,
    'First Aid': 30,
    'Library Use': 20,
    'Spot Hidden': 25,
    Psychology: 10,
    Stealth: 20,
    Listen: 20,
    Persuade: 10,
    Occult: 5,
    Intimidate: 15,
    History: 5,
    Navigate: 10,
    'Science (Medicine)': 1,
    'Science (Chemistry)': 1,
    'Credit Rating': 15,
    Law: 5,
    'Fast Talk': 5,
  };
}

function applyAgeModifiers(attributes, age) {
  if (age >= 40 && age <= 49) {
    attributes.EDU += 5;
    attributes.STR -= 5;
    attributes.DEX -= 5;
  }
  if (age >= 50) {
    attributes.EDU += 10;
    attributes.STR -= 10;
    attributes.DEX -= 10;
  }
}

function derive(attributes) {
  const HP_max = Math.max(1, Math.floor((attributes.CON + attributes.SIZ) / 10));
  const SAN_max = attributes.POW;
  return {
    HP: HP_max,
    HP_max,
    SAN: SAN_max,
    SAN_max,
    MP: Math.floor(attributes.POW / 5),
    Luck: d100(),
    damageBonus: '0',
    build: 0,
    move: attributes.DEX >= attributes.STR ? 8 : 7,
  };
}

function chooseExperiences(occupationName) {
  const pool = experiences.slice();
  const count = Math.floor(Math.random() * 3) + 1;
  const selected = [];
  while (selected.length < count && pool.length) {
    const candidate = pick(pool);
    const conflicts = selected.some((s) => (s.exclusive_with || []).includes(candidate.id) || (candidate.exclusive_with || []).includes(s.id));
    if (!conflicts) selected.push(candidate);
    pool.splice(pool.findIndex((x) => x.id === candidate.id), 1);
  }
  if (selected.length === 0) selected.push(pool[0]);
  return selected;
}

function applyEffects(character, effects = {}) {
  Object.keys(effects).forEach((key) => {
    const value = effects[key];
    if (ATTRS.includes(key)) character.attributes[key] += value;
    else if (Object.prototype.hasOwnProperty.call(character.skills, key)) character.skills[key] += value;
    else if (key === 'SAN') character.derived.SAN = Math.max(0, character.derived.SAN + value);
    else if (key === 'cash') character.cash += value;
  });
}

function createDraft(usedNames = new Set()) {
  const occupation = pick(occupations);
  const { name, gender } = uniqueName(usedNames);
  const age = 20 + Math.floor(Math.random() * 36);
  const attributes = {
    STR: roll3d6x5(), CON: roll3d6x5(), SIZ: roll3d6x5(), DEX: roll3d6x5(),
    APP: roll3d6x5(), INT: roll3d6x5(), POW: roll3d6x5(), EDU: roll3d6x5(),
  };
  applyAgeModifiers(attributes, age);

  const character = {
    id: `draft_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
    name,
    gender,
    age,
    occupation: occupation.name,
    attributes,
    derived: derive(attributes),
    skills: buildBaseSkills(),
    inventory: ['手电筒', '笔记本'],
    cash: 20,
    conditions: [],
    temporary_insanity: null,
    indefinite_insanity: null,
    phobias: [],
    experience_tags: [],
    growth_marks: {},
    background_story: '',
  };

  Object.keys(occupation.skill_bonus).forEach((k) => {
    character.skills[k] = (character.skills[k] || 0) + occupation.skill_bonus[k];
  });
  const expTags = chooseExperiences(occupation.name);
  character.experience_tags = expTags.map((x) => x.text);
  expTags.forEach((x) => applyEffects(character, x.effects));
  character.derived = derive(character.attributes);
  return character;
}

function generateDraftChoices() {
  const used = new Set();
  return [createDraft(used), createDraft(used), createDraft(used)];
}

function adjustAttributeBalance(character, plusAttr, minusAttr) {
  if (!ATTRS.includes(plusAttr) || !ATTRS.includes(minusAttr) || plusAttr === minusAttr) return false;
  if (character.attributes[minusAttr] <= 15) return false;
  character.attributes[plusAttr] += 5;
  character.attributes[minusAttr] -= 5;
  character.derived = derive(character.attributes);
  return true;
}

function finalizeCharacter(draft, id) {
  return { ...draft, id };
}

module.exports = {
  generateDraftChoices,
  adjustAttributeBalance,
  finalizeCharacter,
  derive,
};
