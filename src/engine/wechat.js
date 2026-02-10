function guestEntry() {
  return { mode: 'guest', logged_in: false };
}

function optionalLogin() {
  return new Promise((resolve) => {
    if (!wx.login) {
      resolve({ ok: false, reason: 'wx.login unavailable' });
      return;
    }
    wx.login({
      success: (res) => resolve({ ok: true, code: res.code }),
      fail: () => resolve({ ok: false, reason: 'login_failed' }),
    });
  });
}

function buildEndingShareCard(state) {
  const inv = state.investigators[0];
  return `🎭 我在《鬼屋疑云》达成结局：\n【${state.ending || '未结局'}】\n第${state.progress.current_round}轮 | SAN剩余${inv.derived.SAN}\n挑战你的理智 →`;
}

function buildChallengeShareCard() {
  return '🕯️ 敢来试试《鬼屋疑云》吗？\n1920年代 | 恐怖调查\n一键开局 →';
}

module.exports = { guestEntry, optionalLogin, buildEndingShareCard, buildChallengeShareCard };
