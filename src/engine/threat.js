function advanceThreat(state, failedChecks) {
  state.threat_state.time_clock += 1;
  state.threat_state.exposure_level = Math.min(100, state.threat_state.exposure_level + failedChecks * 5);
  const clueCount = state.clue_progress.discovered_clues.length;
  state.threat_state.truth_progress = Math.min(100, clueCount * 35 + state.threat_state.time_clock * 2);
}

function checkEncounter(scenario, state) {
  return scenario.encounters.find((e) => {
    const t = e.trigger;
    const byTime = typeof t.time_clock_gte === 'number' ? state.threat_state.time_clock >= t.time_clock_gte : true;
    const byLoc = t.location_id ? state.progress.current_location_id === t.location_id : true;
    return byTime && byLoc;
  });
}

module.exports = { advanceThreat, checkEncounter };
