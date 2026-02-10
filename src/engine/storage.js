const SAVE_KEY = 'coc_save_v2';
const INDEX_KEY = 'coc_save_index';

function compactLog(log) {
  if (!Array.isArray(log)) return [];
  return log.slice(-120).map((x) => ({ r: x.round, a: x.action.type, n: x.narrative.slice(0, 180) }));
}

function buildSaveBundle(state) {
  return {
    profile: { room_id: state.room_id, scenario_id: state.scenario_id },
    progress: state.progress,
    investigators: state.investigators,
    clue_progress: state.clue_progress,
    world_state: state.world_state,
    threat_state: state.threat_state,
    ai_memory: state.ai_memory,
    meta: state.meta,
    log: compactLog(state.log),
    save_timestamp: Date.now(),
  };
}

function saveGame(state) {
  const bundle = buildSaveBundle(state);
  wx.setStorageSync(SAVE_KEY, bundle);
  wx.setStorageSync(INDEX_KEY, { time: bundle.save_timestamp, scenario: state.scenario_id });
}

function loadGame() {
  return wx.getStorageSync(SAVE_KEY) || null;
}

function getSaveIndex() {
  return wx.getStorageSync(INDEX_KEY) || null;
}

function clearSave() {
  wx.removeStorageSync(SAVE_KEY);
  wx.removeStorageSync(INDEX_KEY);
}

module.exports = { saveGame, loadGame, clearSave, buildSaveBundle, getSaveIndex };
