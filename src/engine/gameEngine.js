const { loadVersion, loadScenario } = require('../content');
const { generateInvestigator } = require('./character');
const { rollD100, judgeCheck, applySanLoss } = require('./rules');
const { generateNarrative } = require('./ai');
const { pushRawLog, summarizeRound, upsertCanonFact, compressMemory, addOpenThread } = require('./memory');
const { advanceThreat, checkEncounter } = require('./threat');
const { saveGame, loadGame } = require('./storage');
const { syncRoomState } = require('../net/multiplayer');

function createNewState() {
  const scenario = loadScenario('the_haunting');
  return {
    room_id: `room_${Date.now()}`,
    scenario_id: scenario.meta.id,
    progress: {
      current_round: 1,
      game_time: scenario.setup.start_time,
      current_location_id: scenario.setup.start_location_id,
    },
    investigators: [generateInvestigator('p1')],
    clue_progress: { discovered_clues: [] },
    world_state: { npc_states: {}, global_flags: {} },
    threat_state: { time_clock: 0, exposure_level: 0, truth_progress: 0 },
    ai_memory: {
      raw_logs: [],
      turn_summaries: [],
      canon_facts: [],
      open_threads: [],
      recent_summaries: [],
    },
    log: [],
    finished: false,
    ending: '',
  };
}

function checkEndings(state, scenario) {
  const sanCollapse = state.investigators.some((i) => i.derived.SAN <= 0);
  if (sanCollapse) {
    state.finished = true;
    state.ending = scenario.endings.find((x) => x.id === 'collapse').result;
    return;
  }
  const hasCore = ['news_1908', 'basement_mark'].every((id) => state.clue_progress.discovered_clues.includes(id));
  if (hasCore && state.threat_state.truth_progress >= 80) {
    state.finished = true;
    state.ending = scenario.endings.find((x) => x.id === 'seal_success').result;
  }
}

function tryDiscoverClues(state, scenario) {
  const loc = state.progress.current_location_id;
  scenario.clues.filter((c) => c.location_id === loc).forEach((clue) => {
    if (!state.clue_progress.discovered_clues.includes(clue.id)) {
      state.clue_progress.discovered_clues.push(clue.id);
      upsertCanonFact(state, { type: 'clue', entity_id: clue.id, data: clue });
      addOpenThread(state, {
        thread_id: `thread_${clue.id}`,
        type: 'unresolved_clue',
        entity_id: clue.id,
        created_turn: state.progress.current_round,
        resolve_conditions: [{ type: 'analyze', target: clue.id }],
        resolve_mode: 'any',
      });
    }
  });
}

function performAction(state, scenario, action) {
  const actor = state.investigators[0];
  let failedChecks = 0;
  const checks = [];

  if (action.type === 'move' && action.target) {
    const current = scenario.locations.find((x) => x.id === state.progress.current_location_id);
    if (current.connected.includes(action.target)) {
      state.progress.current_location_id = action.target;
    }
  }

  if (action.type === 'check' && action.skill) {
    const roll = rollD100();
    const value = actor.skills[action.skill] || 1;
    const result = judgeCheck(value, roll);
    checks.push({ skill: action.skill, value, roll: roll.value, result });
    if (['fail', 'fumble'].includes(result)) failedChecks += 1;
  }

  tryDiscoverClues(state, scenario);
  advanceThreat(state, failedChecks);

  const encounter = checkEncounter(scenario, state);
  if (encounter && encounter.effect && encounter.effect.san_check) {
    const sanityRoll = rollD100();
    const sanityResult = judgeCheck(actor.derived.SAN, sanityRoll);
    const loss = applySanLoss(
      actor,
      encounter.effect.san_check.loss_success,
      encounter.effect.san_check.loss_fail,
      ['success', 'hard', 'extreme', 'critical'].includes(sanityResult)
    );
    checks.push({ skill: 'SAN', value: actor.derived.SAN, roll: sanityRoll.value, result: sanityResult, loss });
  }

  return checks;
}

async function nextTurn(state, playerAction) {
  if (state.finished) return state;
  const scenario = loadScenario(state.scenario_id);
  const checks = performAction(state, scenario, playerAction);

  const aiOutput = await generateNarrative({
    keeperPrompt: loadVersion('coc_1920s').keeperPrompt,
    world: loadVersion('coc_1920s').world,
    scenario,
    state,
    roundContext: {
      player_actions: [playerAction],
      check_results: checks,
    },
  });

  state.log.push({ round: state.progress.current_round, action: playerAction, checks, narrative: aiOutput.narrative });
  pushRawLog(state, { round: state.progress.current_round, player_inputs: [JSON.stringify(playerAction)], ai_narrative: aiOutput.narrative });
  state.ai_memory.turn_summaries.push(summarizeRound({ round: state.progress.current_round, player_inputs: [playerAction.type], discoveries: state.clue_progress.discovered_clues.slice(-2) }));

  compressMemory(state);
  checkEndings(state, scenario);
  state.progress.current_round += 1;
  saveGame(state);
  await syncRoomState(state);
  return { ...state, aiOutput };
}

function initOrLoad() {
  return loadGame() || createNewState();
}

module.exports = { initOrLoad, nextTurn, createNewState };
