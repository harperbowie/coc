const world = require('./versions/coc_1920s/world.json');
const keeperPrompt = require('./versions/coc_1920s/keeper_prompt.json');
const scenario = require('./versions/coc_1920s/scenarios/the_haunting.json');

function loadVersion(versionId) {
  if (versionId !== world.version_id) {
    throw new Error(`Unsupported version: ${versionId}`);
  }
  return { world, keeperPrompt };
}

function loadScenario(id) {
  if (id !== scenario.meta.id) {
    throw new Error(`Unknown scenario: ${id}`);
  }
  return scenario;
}

module.exports = {
  loadVersion,
  loadScenario,
};
