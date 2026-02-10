function ensureNotebook(state) {
  if (!state.clue_progress.notebook) {
    state.clue_progress.notebook = [];
    state.clue_progress.inferences = [];
  }
}

function recordClue(state, scenario, clueId, source) {
  ensureNotebook(state);
  const clue = scenario.clues.find((x) => x.id === clueId);
  if (!clue) return false;
  if (state.clue_progress.discovered_clues.includes(clueId)) return false;
  state.clue_progress.discovered_clues.push(clueId);
  state.clue_progress.notebook.push({
    id: clue.id,
    name: clue.name,
    description: clue.description,
    source,
    round: state.progress.current_round,
    type: clue.type,
    status: 'new',
  });
  return true;
}

function runInference(state, scenario) {
  ensureNotebook(state);
  const unlocked = [];
  scenario.inference_rules.forEach((rule) => {
    if (state.clue_progress.inferences.includes(rule.id)) return;
    const met = rule.requires.every((x) => state.clue_progress.discovered_clues.includes(x));
    if (met) {
      state.clue_progress.inferences.push(rule.id);
      state.threat_state.truth_progress = Math.min(100, state.threat_state.truth_progress + (rule.effects.truth_progress || 0));
      unlocked.push({ id: rule.id, text: rule.unlock_text });
    }
  });
  return unlocked;
}

module.exports = { recordClue, runInference, ensureNotebook };
