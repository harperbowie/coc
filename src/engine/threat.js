function advanceThreat(state, context) {
  const { failedChecks = 0, combat = false, resting = false } = context || {};
  state.threat_state.time_clock += resting ? 2 : 1;
  state.threat_state.exposure_level = Math.min(100, state.threat_state.exposure_level + failedChecks * 5 + (combat ? 8 : 0));
  const clueCount = state.clue_progress.discovered_clues.length;
  state.threat_state.truth_progress = Math.min(100, state.threat_state.truth_progress + clueCount > 0 ? 1 : 0);
}

function shouldTrigger(trigger, state) {
  const byTime = typeof trigger.time_clock_gte === 'number' ? state.threat_state.time_clock >= trigger.time_clock_gte : true;
  const byLoc = trigger.location_id ? state.progress.current_location_id === trigger.location_id : true;
  const byClue = trigger.needs_clue ? state.clue_progress.discovered_clues.includes(trigger.needs_clue) : true;
  return byTime && byLoc && byClue;
}

function checkSanEvents(scenario, state) {
  return (scenario.san_events || []).filter((e) => shouldTrigger(e.trigger, state));
}

function checkEncounter(scenario, state) {
  return (scenario.encounters || []).find((e) => shouldTrigger(e.trigger, state));
}

module.exports = { advanceThreat, checkEncounter, checkSanEvents };
