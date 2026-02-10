function rollD100() {
  const value = Math.floor(Math.random() * 100) + 1;
  const tens = Math.floor(value / 10);
  const ones = value % 10;
  return { value, tens, ones };
}

function judgeCheck(skillValue, roll) {
  if (roll.value === 1) return 'critical';
  if (roll.value >= 96 && skillValue < 50) return 'fumble';
  if (roll.value <= Math.floor(skillValue / 5)) return 'extreme';
  if (roll.value <= Math.floor(skillValue / 2)) return 'hard';
  if (roll.value <= skillValue) return 'success';
  return 'fail';
}

function levelIndex(result) {
  return ['fumble', 'fail', 'success', 'hard', 'extreme', 'critical'].indexOf(result);
}

function opposedCheck(aSkill, bSkill) {
  const aRoll = rollD100();
  const bRoll = rollD100();
  const aRes = judgeCheck(aSkill, aRoll);
  const bRes = judgeCheck(bSkill, bRoll);
  if (levelIndex(aRes) > levelIndex(bRes)) return { winner: 'a', aRoll, bRoll, aRes, bRes };
  if (levelIndex(aRes) < levelIndex(bRes)) return { winner: 'b', aRoll, bRoll, aRes, bRes };
  if (aRoll.value < bRoll.value) return { winner: 'a', aRoll, bRoll, aRes, bRes };
  if (aRoll.value > bRoll.value) return { winner: 'b', aRoll, bRoll, aRes, bRes };
  return { winner: 'tie', aRoll, bRoll, aRes, bRes };
}

function applySanLoss(investigator, lossSuccess, lossFail, success) {
  const loss = success ? lossSuccess : lossFail;
  investigator.derived.SAN = Math.max(0, investigator.derived.SAN - loss);
  if (loss >= 5) investigator.conditions.push('temporary_insanity');
  return loss;
}

function simpleAttack(attackerSkill, defenderDodge, damage = 2) {
  const clash = opposedCheck(attackerSkill, defenderDodge);
  const hit = clash.winner === 'a';
  return { ...clash, hit, damage: hit ? damage : 0 };
}

module.exports = {
  rollD100,
  judgeCheck,
  opposedCheck,
  applySanLoss,
  simpleAttack,
};
