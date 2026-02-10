function fingerprint(fact) {
  return `${fact.type}:${fact.entity_id || ''}:${fact.key || ''}`;
}

function estimateTokens(state) {
  const text = JSON.stringify({ summaries: state.ai_memory.turn_summaries, facts: state.ai_memory.canon_facts });
  return Math.ceil(text.length / 3.5);
}

function pushRawLog(state, roundLog) {
  state.ai_memory.raw_logs.push(roundLog);
  if (state.ai_memory.raw_logs.length > 60) state.ai_memory.raw_logs.shift();
}

function summarizeRound(roundLog) {
  return {
    round: roundLog.round,
    key_actions: roundLog.player_inputs.slice(0, 3),
    important_discoveries: roundLog.discoveries || [],
    threat_snapshot: roundLog.threat_snapshot,
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
  const tokenEstimate = estimateTokens(state);
  state.ai_memory.canon_facts = state.ai_memory.canon_facts.filter((f) => {
    const age = round - f.turn_latest;
    if (age <= 3) return true;
    if (age <= 10) return ['location', 'npc_state', 'clue'].includes(f.type);
    return state.ai_memory.open_threads.some((t) => t.entity_id === (f.data && f.data.id));
  });

  if (tokenEstimate > 800) {
    state.ai_memory.turn_summaries = state.ai_memory.turn_summaries.slice(-8);
    state.ai_memory.raw_logs = state.ai_memory.raw_logs.slice(-20);
  }
  state.ai_memory.recent_summaries = state.ai_memory.turn_summaries.slice(-10).map((x) => JSON.stringify(x));
  state.ai_memory.token_estimate = estimateTokens(state);
}

function addOpenThread(state, thread) {
  if (!state.ai_memory.open_threads.some((t) => t.thread_id === thread.thread_id)) {
    state.ai_memory.open_threads.push(thread);
  }
}

function closeOpenThread(state, threadId) {
  state.ai_memory.open_threads = state.ai_memory.open_threads.filter((t) => t.thread_id !== threadId);
}

module.exports = {
  pushRawLog,
  summarizeRound,
  upsertCanonFact,
  compressMemory,
  addOpenThread,
  closeOpenThread,
  estimateTokens,
};
