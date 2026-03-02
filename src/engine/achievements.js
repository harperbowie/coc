const ACHIEVEMENTS = [
  '第一次见到祂', '理智崩溃但坚持到底', '绝望难度幸存者', '午夜访客', '图书馆常客',
  '冷静分析者', '零死亡通关', '极限生还', '真相追猎者', '沉默证人',
  '火力压制', '不屈意志', '连环推理', '未竟之谜', '旧报迷踪',
  '强光穿透黑暗', '深夜记录者', '恐惧症患者', '最短回合达人', '终局封印者'
];

function initAchievements(state) {
  if (!state.meta.achievements) {
    state.meta.achievements = ACHIEVEMENTS.map((name) => ({ name, unlocked: false }));
  }
}

function unlock(state, name) {
  initAchievements(state);
  const a = state.meta.achievements.find((x) => x.name === name);
  if (a) a.unlocked = true;
}

function evaluateAchievements(state) {
  initAchievements(state);
  if (state.log.length >= 1) unlock(state, '深夜记录者');
  if ((state.investigators[0].phobias || []).length > 0) unlock(state, '恐惧症患者');
  if (state.clue_progress.inferences && state.clue_progress.inferences.length >= 1) unlock(state, '连环推理');
  if (state.finished && state.ending.includes('封印')) unlock(state, '终局封印者');
}

module.exports = { ACHIEVEMENTS, initAchievements, evaluateAchievements, unlock };
