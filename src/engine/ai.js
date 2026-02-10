const leakKeywords = ['truth', 'gm_only', '真相是', '幕后'];

function buildAIInput({ keeperPrompt, world, scenario, state, roundContext }) {
  return {
    system_role: keeperPrompt.system_role,
    world_context: world.world_lore,
    scenario_framework: {
      truth: scenario.gm_only.truth,
      current_location: scenario.locations.find((l) => l.id === state.progress.current_location_id),
      available_npcs: scenario.npcs.filter((n) => n.location_id === state.progress.current_location_id),
    },
    current_state: {
      round: state.progress.current_round,
      investigators: state.investigators.map((i) => ({ id: i.id, name: i.name, SAN: i.derived.SAN, HP: i.derived.HP })),
      threat_state: state.threat_state,
      recent_facts: state.ai_memory.canon_facts.slice(-8),
    },
    this_round: roundContext,
  };
}

function validateAIOutput(output, context) {
  const narrative = output && output.narrative ? output.narrative : '';
  if (leakKeywords.some((k) => narrative.includes(k))) return false;
  if (/HP|SAN|技能.*\d+/.test(narrative)) return false;
  const defined = new Set([
    ...context.scenario.locations.map((x) => x.name),
    ...context.scenario.npcs.map((x) => x.name),
  ]);
  const mentions = narrative.match(/[A-Za-z\u4e00-\u9fa5]{2,}/g) || [];
  const unknownHeavy = mentions.filter((m) => m.length >= 6 && !defined.has(m));
  return unknownHeavy.length < 5;
}

function fallbackNarrative(state) {
  return {
    narrative: `你站在${state.progress.current_location_id}，空气中有轻微的潮湿与霉味。你们的每一步都让未知更近。`,
    suggestions: [
      { text: '观察周边异常痕迹', type: 'investigate' },
      { text: '向现场NPC提问', type: 'ask' },
      { text: '整理线索并制定下一步', type: 'investigate' },
    ],
  };
}

function callDeepSeek(payload) {
  return new Promise((resolve) => {
    const apiKey = wx.getStorageSync('DEEPSEEK_API_KEY') || '';
    if (!apiKey) {
      resolve({ ok: false, reason: 'missing_api_key' });
      return;
    }
    wx.request({
      url: 'https://api.deepseek.com/chat/completions',
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      data: {
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: payload.system_role },
          { role: 'user', content: JSON.stringify(payload) },
        ],
        temperature: 0.7,
      },
      success: (res) => {
        const content = res.data && res.data.choices && res.data.choices[0] && res.data.choices[0].message
          ? res.data.choices[0].message.content
          : '';
        resolve({ ok: true, content });
      },
      fail: () => resolve({ ok: false, reason: 'network_error' }),
    });
  });
}

function parseAIContent(content) {
  try {
    const parsed = JSON.parse(content);
    if (parsed.narrative) return parsed;
  } catch (e) {}
  return { narrative: content || '黑暗中有东西正在注视你们。', suggestions: [] };
}

async function generateNarrative(context) {
  const payload = buildAIInput(context);
  const res = await callDeepSeek(payload);
  if (!res.ok) return fallbackNarrative(context.state);
  const output = parseAIContent(res.content);
  if (!validateAIOutput(output, context)) return fallbackNarrative(context.state);
  return output;
}

module.exports = { generateNarrative, validateAIOutput, buildAIInput };
