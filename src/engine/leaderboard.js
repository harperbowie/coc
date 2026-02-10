const BOARD_KEY = 'coc_friend_board_local';

function scoreFromState(state) {
  const inv = state.investigators[0] || { derived: { SAN: 0 } };
  const endingBonus = state.finished && (state.ending || '').includes('封印') ? 100 : 0;
  const sanBonus = Math.max(0, inv.derived.SAN || 0);
  const speedBonus = Math.max(0, 120 - (state.progress.current_round || 0) * 2);
  const clueBonus = (state.clue_progress.discovered_clues || []).length * 8;
  return endingBonus + sanBonus + speedBonus + clueBonus;
}

function selfRecord(state) {
  const inv = state.investigators[0] || { name: '调查员', derived: { SAN: 0 } };
  return {
    id: state.room_id,
    name: inv.name || '调查员',
    score: scoreFromState(state),
    san: inv.derived.SAN || 0,
    rounds: state.progress.current_round || 0,
    ending: state.ending || '进行中',
    ts: Date.now(),
  };
}

function readLocalBoard() {
  const data = wx.getStorageSync(BOARD_KEY);
  return Array.isArray(data) ? data : [];
}

function writeLocalBoard(list) {
  wx.setStorageSync(BOARD_KEY, list.slice(0, 20));
}

function upsertSelfToLocalBoard(state) {
  const list = readLocalBoard();
  const me = selfRecord(state);
  const idx = list.findIndex((x) => x.id === me.id);
  if (idx >= 0) {
    if (me.score >= list[idx].score) list[idx] = me;
  } else {
    list.push(me);
  }
  list.sort((a, b) => b.score - a.score || a.rounds - b.rounds);
  writeLocalBoard(list);
  return list;
}

function getMockFriends(state) {
  const me = selfRecord(state);
  return [
    { id: 'f1', name: 'Mabel Stone', score: 168, san: 14, rounds: 18, ending: '封印成功', ts: Date.now() - 86400_000 },
    { id: 'f2', name: 'Edward Price', score: 142, san: 9, rounds: 24, ending: '调查终止', ts: Date.now() - 43200_000 },
    me,
  ].sort((a, b) => b.score - a.score);
}

function fetchFriendBoard() {
  return new Promise((resolve) => {
    if (!wx.getFriendCloudStorage) {
      resolve({ ok: false, list: [] });
      return;
    }
    wx.getFriendCloudStorage({
      keyList: ['coc_score'],
      success: (res) => {
        const list = (res.data || []).map((x) => {
          const kv = (x.KVDataList || []).find((k) => k.key === 'coc_score');
          let parsed = null;
          try { parsed = kv ? JSON.parse(kv.value) : null; } catch (e) {}
          return {
            id: x.openid || x.nickname,
            name: x.nickname || '好友',
            score: parsed && parsed.score ? parsed.score : 0,
            san: parsed && parsed.san ? parsed.san : 0,
            rounds: parsed && parsed.rounds ? parsed.rounds : 999,
            ending: parsed && parsed.ending ? parsed.ending : '未知',
          };
        });
        list.sort((a, b) => b.score - a.score || a.rounds - b.rounds);
        resolve({ ok: true, list });
      },
      fail: () => resolve({ ok: false, list: [] }),
    });
  });
}

async function refreshFriendBoard(state) {
  const local = upsertSelfToLocalBoard(state);
  const remote = await fetchFriendBoard();
  const merged = remote.ok && remote.list.length
    ? remote.list
    : [...getMockFriends(state), ...local].sort((a, b) => b.score - a.score || a.rounds - b.rounds);
  const dedup = [];
  const seen = new Set();
  merged.forEach((x) => {
    const key = x.id || x.name;
    if (seen.has(key)) return;
    seen.add(key);
    dedup.push(x);
  });
  return dedup.slice(0, 10);
}

module.exports = {
  scoreFromState,
  selfRecord,
  upsertSelfToLocalBoard,
  refreshFriendBoard,
};
