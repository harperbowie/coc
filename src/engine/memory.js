function fingerprint(fact) {
  return `${fact.type}:${fact.entity_id || ''}:${fact.key || ''}`;
}

function pushRawLog(state, roundLog) {
  state.ai_memory.raw_logs.push(roundLog);
}

function summarizeRound(roundLog) {
  return {
    round: roundLog.round,
    key_actions: roundLog.player_inputs.slice(0, 3),
    important_discoveries: roundLog.discoveries || [],
  };
}

function upsertCanonFact(state, fact) {
  const fp = fingerprint(fact);
  const found = state.ai_memory.canon_facts.find((f) => f.fingerprint === fp);
  if (found) {
    found.turn_latest = state.progress.current_round;
    found.data = fact.data;
  } else {
    state.ai_memory.canon_facts.push({
      fingerprint: fp,
      turn_first: state.progress.current_round,
      turn_latest: state.progress.current_round,
      type: fact.type,
      data: fact.data,
    });
  }
}

function compressMemory(state) {
  const round = state.progress.current_round;
  state.ai_memory.canon_facts = state.ai_memory.canon_facts.filter((f) => {
    const age = round - f.turn_latest;
    if (age <= 3) return true;
    if (age <= 10) return ['location', 'npc_state', 'clue'].includes(f.type);
    return state.ai_memory.open_threads.some((t) => t.entity_id === (f.data && f.data.id));
  });
  state.ai_memory.recent_summaries = state.ai_memory.turn_summaries.slice(-10).map((x) => JSON.stringify(x));
}

function addOpenThread(state, thread) {
  state.ai_memory.open_threads.push(thread);
}

module.exports = {
  pushRawLog,
  summarizeRound,
  upsertCanonFact,
  compressMemory,
  addOpenThread,
};
