const world = require('./versions/coc_1920s/world.json');
const keeperPrompt = require('./versions/coc_1920s/keeper_prompt.json');
const theHaunting = require('./versions/coc_1920s/scenarios/the_haunting.json');

const scenarios = {
  [theHaunting.meta.id]: theHaunting,
};

function loadVersion(versionId) {
  if (versionId !== world.version_id) throw new Error(`Unsupported version: ${versionId}`);
  return { world, keeperPrompt, scenarios: Object.values(scenarios).map((x) => x.meta) };
}

function loadScenario(id) {
  const s = scenarios[id];
  if (!s) throw new Error(`Unknown scenario: ${id}`);
  return s;
}

function listScenarios() {
  return Object.values(scenarios).map((x) => x.meta);
}

module.exports = { loadVersion, loadScenario, listScenarios };
