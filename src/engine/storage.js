const SAVE_KEY = 'coc_save_v1';

function saveGame(state) {
  wx.setStorageSync(SAVE_KEY, state);
}

function loadGame() {
  return wx.getStorageSync(SAVE_KEY) || null;
}

function clearSave() {
  wx.removeStorageSync(SAVE_KEY);
}

module.exports = { saveGame, loadGame, clearSave };
