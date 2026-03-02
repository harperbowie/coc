const { runSkillCheck, rollDice } = require('./rules');

const SAN_LEVELS = {
  minor: { success: '0', fail: '1D2' },
  moderate: { success: '1', fail: '1D6' },
  severe: { success: '1D4', fail: '1D10' },
  cosmic: { success: '1D6', fail: '1D20' },
};

const TEMP_INSANITY = ['逃跑', '僵直', '歇斯底里', '攻击同伴', '幻觉', '昏厥'];
const INDEF_INSANITY = ['偏执', '抑郁', '失忆', '强迫'];
const PHOBIAS = ['幽闭恐惧', '黑暗恐惧', '血液恐惧', '尸体恐惧', '海洋恐惧'];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function rollLoss(formula) {
  if (formula === '0') return 0;
  return rollDice(formula);
}

function applySanEvent(character, level) {
  const cfg = SAN_LEVELS[level] || SAN_LEVELS.minor;
  const check = runSkillCheck({ baseSkill: character.derived.SAN, difficulty: 'normal' });
  const success = ['success', 'hard', 'extreme', 'critical'].includes(check.level);
  const loss = rollLoss(success ? cfg.success : cfg.fail);

  character.derived.SAN = Math.max(0, character.derived.SAN - loss);
  character.san_loss_accumulated = (character.san_loss_accumulated || 0) + loss;

  const effects = [];
  if (loss >= 5) {
    character.temporary_insanity = { type: pick(TEMP_INSANITY), rounds_left: 2 };
    effects.push(`临时疯狂:${character.temporary_insanity.type}`);
  }
  const threshold = Math.floor(character.derived.SAN_max * 0.2);
  if (!character.indefinite_insanity && (character.derived.SAN <= 0 || character.san_loss_accumulated >= threshold)) {
    character.indefinite_insanity = { type: pick(INDEF_INSANITY) };
    effects.push(`不定疯狂:${character.indefinite_insanity.type}`);
  }
  if (Math.random() < 0.3) {
    const phobia = pick(PHOBIAS);
    if (!character.phobias.includes(phobia)) {
      character.phobias.push(phobia);
      effects.push(`恐惧症:${phobia}`);
    }
  }

  return { check, loss, effects };
}

function advanceInsanity(character) {
  if (character.temporary_insanity && character.temporary_insanity.rounds_left > 0) {
    character.temporary_insanity.rounds_left -= 1;
    if (character.temporary_insanity.rounds_left <= 0) character.temporary_insanity = null;
  }
}

function recoverSanByRest(character) {
  if (character.rested_today) return 0;
  character.rested_today = true;
  character.derived.SAN = Math.min(character.derived.SAN_max, character.derived.SAN + 1);
  return 1;
}

module.exports = {
  applySanEvent,
  advanceInsanity,
  recoverSanByRest,
};
