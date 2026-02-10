function rollD100() {
  const value = Math.floor(Math.random() * 100) + 1;
  return { value };
}

function rollDice(formula) {
  const [countStr, sideStr] = String(formula).toUpperCase().split('D');
  const count = parseInt(countStr, 10) || 1;
  const sides = parseInt(sideStr, 10) || 6;
  let total = 0;
  for (let i = 0; i < count; i += 1) total += Math.floor(Math.random() * sides) + 1;
  return total;
}

function difficultyModifier(level) {
  if (level === 'easy') return 20;
  if (level === 'hard') return -20;
  if (level === 'extreme') return -40;
  return 0;
}

function checkSuccessLevel(skillValue, roll) {
  if (roll.value === 1) return 'critical';
  if (roll.value === 100 || (roll.value >= 96 && skillValue < 50)) return 'fumble';
  if (roll.value <= Math.floor(skillValue / 5)) return 'extreme';
  if (roll.value <= Math.floor(skillValue / 2)) return 'hard';
  if (roll.value <= skillValue) return 'success';
  return 'fail';
}

function successRank(level) {
  return ['fumble', 'fail', 'success', 'hard', 'extreme', 'critical'].indexOf(level);
}

function runSkillCheck({ baseSkill, modifiers = [], difficulty = 'normal' }) {
  const mod = modifiers.reduce((a, b) => a + b, 0) + difficultyModifier(difficulty);
  const finalSkill = Math.min(95, Math.max(1, baseSkill + mod));
  const roll = rollD100();
  const level = checkSuccessLevel(finalSkill, roll);
  return { baseSkill, finalSkill, roll: roll.value, level, modifiers, difficulty };
}

function opposedCheck(aValue, bValue) {
  const a = runSkillCheck({ baseSkill: aValue });
  const b = runSkillCheck({ baseSkill: bValue });
  if (successRank(a.level) > successRank(b.level)) return { winner: 'a', a, b };
  if (successRank(a.level) < successRank(b.level)) return { winner: 'b', a, b };
  const ad = Math.abs(a.finalSkill - a.roll);
  const bd = Math.abs(b.finalSkill - b.roll);
  if (ad > bd) return { winner: 'a', a, b };
  if (ad < bd) return { winner: 'b', a, b };
  return { winner: 'tie', a, b };
}

function combatRound({ investigators, enemy, actions }) {
  const order = [...investigators.map((x) => ({ id: x.id, dex: x.attributes.DEX, type: 'investigator' })), { id: 'enemy', dex: enemy.DEX, type: 'enemy' }]
    .sort((x, y) => y.dex - x.dex);
  const logs = [];

  order.forEach((unit) => {
    if (enemy.HP <= 0) return;
    if (unit.type === 'enemy') {
      const target = investigators.filter((x) => x.derived.HP > 0).sort((a, b) => a.derived.HP - b.derived.HP)[0];
      if (!target) return;
      const contest = opposedCheck(enemy.attack_skill, target.skills.Dodge || target.skills['Fighting (Brawl)']);
      if (contest.winner === 'a') {
        const dmg = rollDice(enemy.damage);
        target.derived.HP = Math.max(0, target.derived.HP - dmg);
        logs.push({ actor: enemy.name, action_type: 'attack', target: target.name, success_level: contest.a.level, damage_dealt: dmg });
      } else {
        logs.push({ actor: enemy.name, action_type: 'attack', target: target.name, success_level: contest.a.level, damage_dealt: 0 });
      }
      return;
    }

    const actor = investigators.find((x) => x.id === unit.id);
    const action = actions[actor.id] || { type: 'dodge' };
    if (action.type === 'flee') {
      logs.push({ actor: actor.name, action_type: 'flee', success_level: 'success' });
      return;
    }
    if (action.type === 'item') {
      logs.push({ actor: actor.name, action_type: 'item', success_level: 'success' });
      return;
    }

    const skillName = action.weaponSkill || 'Fighting (Brawl)';
    const contest = opposedCheck(actor.skills[skillName] || 1, enemy.attack_skill);
    if (contest.winner === 'a') {
      const dmg = rollDice(action.damage || '1D3');
      enemy.HP = Math.max(0, enemy.HP - dmg);
      actor.growth_marks[skillName] = true;
      logs.push({ actor: actor.name, action_type: 'attack', success_level: contest.a.level, damage_dealt: dmg });
    } else {
      logs.push({ actor: actor.name, action_type: 'attack', success_level: contest.a.level, damage_dealt: 0 });
    }
  });

  return {
    action_order: order.map((x) => x.id),
    actions: logs,
    ended: enemy.HP <= 0 || investigators.every((x) => x.derived.HP <= 0),
  };
}

function growthCheck(character) {
  Object.keys(character.growth_marks).forEach((skill) => {
    const current = character.skills[skill] || 1;
    const roll = rollD100().value;
    if (roll > current) {
      character.skills[skill] = Math.min(99, current + rollDice('1D10'));
    }
  });
  character.growth_marks = {};
}

module.exports = {
  rollD100,
  rollDice,
  runSkillCheck,
  checkSuccessLevel,
  opposedCheck,
  combatRound,
  growthCheck,
};
