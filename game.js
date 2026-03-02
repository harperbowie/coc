const { initOrLoad, nextTurn } = require('./src/engine/gameEngine');
const { CanvasUI } = require('./src/ui/canvasUI');

function bootstrap() {
  const state = initOrLoad();
  const engine = { nextTurn };
  const ui = new CanvasUI(engine);
  ui.setState(state);
}

bootstrap();
