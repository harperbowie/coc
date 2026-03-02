function createRoomPayload(state) {
  return {
    room_id: state.room_id,
    scenario_id: state.scenario_id,
    investigators: state.investigators.map((x) => ({ id: x.id, name: x.name })),
    current_round: state.progress.current_round,
  };
}

function syncRoomState(_state) {
  return Promise.resolve({ ok: true, mode: 'standalone_mock' });
}

module.exports = { createRoomPayload, syncRoomState };
