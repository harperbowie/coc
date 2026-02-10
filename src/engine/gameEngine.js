const { loadVersion, loadScenario } = require('../content');
const { generateDraftChoices, finalizeCharacter, adjustAttributeBalance } = require('./character');
const { runSkillCheck, combatRound, growthCheck } = require('./rules');
const { generateNarrative } = require('./ai');
const { pushRawLog, summarizeRound, upsertCanonFact, compressMemory, addOpenThread, closeOpenThread } = require('./memory');
const { advanceThreat, checkEncounter, checkSanEvents } = require('./threat');
const { saveGame, loadGame } = require('./storage');
const { syncRoomState } = require('../net/multiplayer');
const { applySanEvent, advanceInsanity, recoverSanByRest } = require('./sanity');
const { addItem, useItem, startingItemsFromScenario } = require('./items');
const { talkToNpc } = require('./npc');
const { recordClue, runInference, ensureNotebook } = require('./clues');
const { initAchievements, evaluateAchievements, unlock } = require('./achievements');
const { buildEndingShareCard, buildChallengeShareCard, guestEntry } = require('./wechat');
const { parseCustomInput, buildQuestionSuggestions } = require('./intent');
const { generateBackstory } = require('./backstory');

function createNewState() {
  const scenario = loadScenario('the_haunting');
  const draftChoices = generateDraftChoices();
  return {
    entry: guestEntry(),
    room_id: `room_${Date.now()}`,
    scenario_id: scenario.meta.id,
    phase: 'character_draft',
    character_drafts: draftChoices,
    selected_draft_idx: null,
    progress: {
      current_round: 1,
      game_time: scenario.setup.start_time,
      current_location_id: scenario.setup.start_location_id,
    },
    investigators: [],
    clue_progress: { discovered_clues: [], notebook: [], inferences: [] },
    world_state: { npc_states: {}, global_flags: {} },
    threat_state: { time_clock: 0, exposure_level: 0, truth_progress: 0 },
    ai_memory: { raw_logs: [], turn_summaries: [], canon_facts: [], open_threads: [], recent_summaries: [], token_estimate: 0 },
    combat: { active: false, enemy: null, rounds: [] },
    log: [],
    suggestions: [],
    finished: false,
    ending: '',
    meta: { share_cards: {}, achievements: [] },
    ui: { suggestion_expanded: false, question_suggestions: [] },
  };
}

function applyInitialItems(state, scenario) {
  const inv = state.investigators[0];
  inv.inventory_detail = inv.inventory_detail || [];
  startingItemsFromScenario(scenario).forEach((item) => addItem(state, item));
}

async function finalizeDraftSelection(state) {
  const scenario = loadScenario(state.scenario_id);
  const idx = state.selected_draft_idx == null ? 0 : state.selected_draft_idx;
  const picked = finalizeCharacter(state.character_drafts[idx], 'p1');
  picked.background_story = await generateBackstory(picked);
  state.investigators = [picked];
  applyInitialItems(state, scenario);
  state.phase = 'in_game';
  state.character_drafts = [];
  initAchievements(state);
  state.ui.question_suggestions = buildQuestionSuggestions(state);
}

function checkEndings(state, scenario) {
  const anySanZero = state.investigators.some((i) => i.derived.SAN <= 0);
  if (anySanZero) {
    state.finished = true;
    state.ending = scenario.endings.find((x) => x.id === 'collapse').result;
    return;
  }
  if (state.threat_state.time_clock >= 9 && state.threat_state.truth_progress < 50) {
    state.finished = true;
    state.ending = scenario.endings.find((x) => x.id === 'false_conclusion').result;
    return;
  }
  const hasCore = ['news_1908', 'basement_mark'].every((id) => state.clue_progress.discovered_clues.includes(id));
  if (hasCore && state.threat_state.truth_progress >= 80) {
    state.finished = true;
    state.ending = scenario.endings.find((x) => x.id === 'seal_success').result;
  }
}

function processMove(state, scenario, target) {
  const current = scenario.locations.find((x) => x.id === state.progress.current_location_id);
  if (current && current.connected.includes(target)) {
    state.progress.current_location_id = target;
    upsertCanonFact(state, { type: 'location', entity_id: target, data: { id: target } });
    return true;
  }
  return false;
}

function processSkillAction(state, scenario, action, checks) {
  const actor = state.investigators[0];
  const location = scenario.locations.find((x) => x.id === state.progress.current_location_id);
  const locationRule = (location.checks || []).find((c) => c.skill === action.skill);
  const difficulty = action.difficulty || (locationRule ? locationRule.difficulty : 'normal');
  const result = runSkillCheck({ baseSkill: actor.skills[action.skill] || 1, modifiers: action.modifiers || [], difficulty });
  checks.push({ skill: action.skill, ...result });

  if (['success', 'hard', 'extreme', 'critical'].includes(result.level)) {
    actor.growth_marks[action.skill] = true;
    const clues = (locationRule && locationRule.success) || [];
    clues.forEach((id) => {
      if (recordClue(state, scenario, id, `location:${location.id}`)) {
        addOpenThread(state, { thread_id: `thread_${id}`, type: 'unresolved_clue', entity_id: id, created_turn: state.progress.current_round, resolve_conditions: [], resolve_mode: 'any' });
      }
    });
  } else {
    const coreAtLoc = scenario.clues.filter((c) => c.location_id === location.id && c.core);
    coreAtLoc.forEach((core) => {
      if (!state.clue_progress.discovered_clues.includes(core.id)) {
        recordClue(state, scenario, core.id, `fail_forward:${location.id}`);
        state.threat_state.exposure_level = Math.min(100, state.threat_state.exposure_level + 5);
      }
    });
  }
}

function processNpcAction(state, scenario, action, narrativeHooks) {
  const res = talkToNpc(state, scenario, action.npc_id, action.intent || 'polite_question');
  if (res.clues) res.clues.forEach((id) => recordClue(state, scenario, id, `npc:${action.npc_id}`));
  if (res.text) narrativeHooks.push(res.text);
  return res;
}

function processUseItem(state, action) {
  return useItem(state, action.item_id);
}

function processCombat(state, scenario, action, checks, narrativeHooks) {
  if (!state.combat.active) {
    const encounter = checkEncounter(scenario, state);
    if (!encounter) return;
    state.combat.active = true;
    state.combat.enemy = { ...encounter.enemy };
  }
  const actor = state.investigators[0];
  const item = action.item_id ? useItem(state, action.item_id) : { ok: true };
  const combatAction = {
    [actor.id]: {
      type: 'attack',
      damage: item.combat_bonus ? item.combat_bonus.damage : '1D3',
      weaponSkill: item.combat_bonus ? item.combat_bonus.weaponSkill : 'Fighting (Brawl)',
    },
  };
  const roundResult = combatRound({ investigators: state.investigators, enemy: state.combat.enemy, actions: combatAction });
  state.combat.rounds.push(roundResult);
  checks.push({ type: 'combat', ...roundResult });
  narrativeHooks.push(`战斗轮次完成，敌人剩余HP ${state.combat.enemy.HP}`);
  if (roundResult.ended) {
    state.combat.active = false;
    unlock(state, '火力压制');
  }
}

function processSanity(state, scenario, checks, narrativeHooks) {
  const actor = state.investigators[0];
  checkSanEvents(scenario, state).forEach((ev) => {
    const out = applySanEvent(actor, ev.level);
    checks.push({ type: 'san', event: ev.id, ...out });
    narrativeHooks.push(ev.text);
    if (out.effects.length) narrativeHooks.push(out.effects.join('；'));
    if (out.loss >= 5) unlock(state, '第一次见到祂');
  });
  advanceInsanity(actor);
}

async function nextTurn(state, playerAction) {
  if (state.finished) return state;
  if (state.phase === 'character_draft') {
    if (playerAction.type === 'select_draft') state.selected_draft_idx = playerAction.index;
    if (playerAction.type === 'adjust_attr') {
      const idx = state.selected_draft_idx == null ? 0 : state.selected_draft_idx;
      adjustAttributeBalance(state.character_drafts[idx], playerAction.plus, playerAction.minus);
    }
    if (playerAction.type === 'confirm_draft') await finalizeDraftSelection(state);
    saveGame(state);
    return state;
  }

  const scenario = loadScenario(state.scenario_id);
  const checks = [];
  const hooks = [];
  let failedChecks = 0;

  let resolvedAction = playerAction;
  if (playerAction.type === 'custom_input') {
    const parsed = parseCustomInput(playerAction.text, state);
    resolvedAction = parsed.action;
    hooks.push(parsed.explain);
  }

  if (resolvedAction.type === 'move') processMove(state, scenario, resolvedAction.target);
  if (resolvedAction.type === 'check') processSkillAction(state, scenario, resolvedAction, checks);
  if (resolvedAction.type === 'talk') processNpcAction(state, scenario, resolvedAction, hooks);
  if (resolvedAction.type === 'use_item') processUseItem(state, resolvedAction);
  if (resolvedAction.type === 'combat') processCombat(state, scenario, resolvedAction, checks, hooks);
  if (resolvedAction.type === 'rest') {
    recoverSanByRest(state.investigators[0]);
    hooks.push('你短暂休息，试图让神经回到可控状态。');
  }

  failedChecks = checks.filter((x) => ['fail', 'fumble'].includes(x.level)).length;
  advanceThreat(state, { failedChecks, combat: resolvedAction.type === 'combat', resting: resolvedAction.type === 'rest' });

  processSanity(state, scenario, checks, hooks);
  const unlockedInference = runInference(state, scenario);
  unlockedInference.forEach((x) => hooks.push(x.text));
  unlockedInference.forEach((x) => closeOpenThread(state, `thread_${x.id}`));

  const aiOutput = await generateNarrative({
    keeperPrompt: loadVersion('coc_1920s').keeperPrompt,
    world: loadVersion('coc_1920s').world,
    scenario,
    state,
    roundContext: { player_actions: [resolvedAction], check_results: checks, hooks },
  });

  state.suggestions = aiOutput.suggestions || [];
  state.log.push({ round: state.progress.current_round, action: resolvedAction, checks, narrative: aiOutput.narrative, hooks });
  pushRawLog(state, { round: state.progress.current_round, player_inputs: [JSON.stringify(playerAction)], ai_narrative: aiOutput.narrative });
  state.ai_memory.turn_summaries.push(summarizeRound({ round: state.progress.current_round, player_inputs: [resolvedAction.type], discoveries: state.clue_progress.discovered_clues.slice(-3), threat_snapshot: state.threat_state }));

  checkEndings(state, scenario);
  evaluateAchievements(state);

  if (state.finished) {
    growthCheck(state.investigators[0]);
    state.meta.share_cards.ending = buildEndingShareCard(state);
  } else {
    state.meta.share_cards.challenge = buildChallengeShareCard();
  }

  state.ui.question_suggestions = buildQuestionSuggestions(state);
  compressMemory(state);
  state.progress.current_round += 1;
  saveGame(state);
  await syncRoomState(state);
  return { ...state, aiOutput };
}

function initOrLoad() {
  const loaded = loadGame();
  if (loaded) return loaded;
  return createNewState();
}

module.exports = { initOrLoad, nextTurn, createNewState };
