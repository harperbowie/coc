const leakKeywords = ['gm_only', 'truth', '真相是', '幕后', '剧透'];

const SUGGESTED_MODIFIERS = new Set([-20, -10, 10, 20]);

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
      investigators: state.investigators.map((i) => ({
        id: i.id,
        name: i.name,
        HP: i.derived.HP,
        SAN: i.derived.SAN,
        conditions: i.conditions,
      })),
      threat_state: state.threat_state,
      recent_facts: state.ai_memory.canon_facts.slice(-10),
    },
    this_round: roundContext,
  };
}

function validateSuggestions(output) {
  if (!output.suggested_modifiers) return true;
  return output.suggested_modifiers.every((m) => SUGGESTED_MODIFIERS.has(m.modifier));
}

function validateAIOutput(output, context) {
  const narrative = output && output.narrative ? output.narrative : '';
  if (!narrative || narrative.length < 20) return false;
  if (leakKeywords.some((k) => narrative.includes(k))) return false;
  if (/HP\s*[+-]|SAN\s*[+-]|技能值/.test(narrative)) return false;
  if (!validateSuggestions(output)) return false;

  const defined = new Set([
    ...context.scenario.locations.map((x) => x.name),
    ...context.scenario.npcs.map((x) => x.name),
    ...context.scenario.clues.map((x) => x.name),
  ]);
  const mentions = narrative.match(/[A-Za-z\u4e00-\u9fa5]{2,}/g) || [];
  const unknownLong = mentions.filter((m) => m.length >= 8 && !defined.has(m));
  return unknownLong.length < 4;
}

function fallbackNarrative(context) {
  const loc = context.scenario.locations.find((l) => l.id === context.state.progress.current_location_id);
  return {
    narrative: `你在${loc ? loc.name : context.state.progress.current_location_id}继续调查，空气中的霉味与潮湿让每一次呼吸都带着紧张。你意识到时间正在推动某种看不见的进程。`,
    suggestions: [
      { text: '检查环境异常痕迹', type: 'investigate' },
      { text: '与在场NPC继续交谈', type: 'ask' },
      { text: '整理笔记中的线索关系', type: 'investigate' },
    ],
  };
}

function callDeepSeek(payload) {
  return new Promise((resolve) => {
    const apiKey = wx.getStorageSync('DEEPSEEK_API_KEY') || '';
    if (!apiKey) return resolve({ ok: false, reason: 'missing_api_key' });

    wx.request({
      url: 'https://api.deepseek.com/chat/completions',
      method: 'POST',
      header: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      data: {
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: `${payload.system_role}\n输出必须是JSON: { narrative, suggestions, suggested_modifiers? }` },
          { role: 'user', content: JSON.stringify(payload) },
        ],
        temperature: 0.65,
      },
      success: (res) => {
        const content = res?.data?.choices?.[0]?.message?.content || '';
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
  return { narrative: content || '', suggestions: [] };
}

async function generateNarrative(context) {
  const payload = buildAIInput(context);
  const res = await callDeepSeek(payload);
  if (!res.ok) return fallbackNarrative(context);
  const output = parseAIContent(res.content);
  if (!validateAIOutput(output, context)) return fallbackNarrative(context);
  return output;
}

module.exports = { generateNarrative, validateAIOutput, buildAIInput };
