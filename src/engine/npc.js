const ATTITUDE = ['hostile', 'suspicious', 'neutral', 'friendly', 'trusting'];

function attitudeIndex(value) {
  return ATTITUDE.indexOf(value);
}

function ensureNpcState(state, npc) {
  if (!state.world_state.npc_states[npc.id]) {
    state.world_state.npc_states[npc.id] = {
      npc_id: npc.id,
      current_attitude: npc.attitude || 'neutral',
      flags: [],
      given_clues: [],
      lied_about: [],
    };
  }
  return state.world_state.npc_states[npc.id];
}

function talkToNpc(state, scenario, npcId, intent) {
  const npc = scenario.npcs.find((x) => x.id === npcId);
  if (!npc) return { ok: false, text: '这里没有可对话对象。' };
  const ns = ensureNpcState(state, npc);
  const delta = npc.reactions[intent] || 0;
  let idx = Math.min(ATTITUDE.length - 1, Math.max(0, attitudeIndex(ns.current_attitude) + delta));
  ns.current_attitude = ATTITUDE[idx];

  if (intent === 'ask_secret') {
    ns.lied_about.push('secret');
    return { ok: true, text: npc.lies[0] || '他显得不愿继续这个话题。', attitude: ns.current_attitude };
  }

  let text = npc.knowledge[0] || '他沉默了片刻。';
  const clueRule = npc.give_clues && npc.give_clues.clue_house_history;
  const canGive = clueRule && attitudeIndex(ns.current_attitude) >= attitudeIndex('friendly');
  const clues = [];
  if (canGive && !ns.given_clues.includes('clue_house_history')) {
    ns.given_clues.push('clue_house_history');
    if (!state.clue_progress.discovered_clues.includes('clue_house_history')) {
      state.clue_progress.discovered_clues.push('clue_house_history');
      clues.push('clue_house_history');
    }
  }
  return { ok: true, text, attitude: ns.current_attitude, clues };
}

module.exports = { talkToNpc, ensureNpcState };
