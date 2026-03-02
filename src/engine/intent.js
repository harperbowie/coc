function containsAny(text, keys) {
  return keys.some((k) => text.includes(k));
}

function parseCustomInput(input, state) {
  const text = String(input || '').trim();
  if (!text) return { action: { type: 'noop' }, explain: '空输入' };

  if (containsAny(text, ['图书馆', '去图书馆'])) return { action: { type: 'move', target: 'library' }, explain: '意图解析: 前往图书馆' };
  if (containsAny(text, ['鬼屋', '宅邸', 'house'])) return { action: { type: 'move', target: 'house' }, explain: '意图解析: 前往鬼屋' };
  if (containsAny(text, ['地下室'])) return { action: { type: 'move', target: 'basement' }, explain: '意图解析: 前往地下室' };
  if (containsAny(text, ['事务所', '回去'])) return { action: { type: 'move', target: 'office' }, explain: '意图解析: 返回事务所' };

  if (containsAny(text, ['侦查', '观察', '搜索'])) return { action: { type: 'check', skill: 'Spot Hidden' }, explain: '意图解析: 侦查检定' };
  if (containsAny(text, ['查资料', '档案', '报纸', '图书馆检索'])) return { action: { type: 'check', skill: 'Library Use' }, explain: '意图解析: 图书馆使用检定' };
  if (containsAny(text, ['神秘学', '仪式', '符号'])) return { action: { type: 'check', skill: 'Occult' }, explain: '意图解析: 神秘学检定' };
  if (containsAny(text, ['心理学', '看穿', '表情'])) return { action: { type: 'check', skill: 'Psychology' }, explain: '意图解析: 心理学检定' };

  if (containsAny(text, ['问房东', '问knott', '提问'])) return { action: { type: 'talk', npc_id: 'landlord', intent: 'polite_question', raw_text: text }, explain: '意图解析: 友好提问NPC' };
  if (containsAny(text, ['威胁', '恐吓'])) return { action: { type: 'talk', npc_id: 'landlord', intent: 'threaten', raw_text: text }, explain: '意图解析: 威胁NPC' };
  if (containsAny(text, ['秘密', '真相', '隐瞒'])) return { action: { type: 'talk', npc_id: 'landlord', intent: 'ask_secret', raw_text: text }, explain: '意图解析: 追问秘密' };

  if (containsAny(text, ['攻击', '开枪', '战斗'])) return { action: { type: 'combat' }, explain: '意图解析: 进入战斗行动' };
  if (containsAny(text, ['急救包', '治疗', '包扎'])) return { action: { type: 'use_item', item_id: 'first_aid_kit' }, explain: '意图解析: 使用急救包' };
  if (containsAny(text, ['休息', '冷静', '调整状态'])) return { action: { type: 'rest' }, explain: '意图解析: 休息恢复' };

  return {
    action: { type: 'check', skill: 'Spot Hidden', modifiers: [-10] },
    explain: '意图不明确，默认执行保守侦查（-10）',
  };
}

function buildQuestionSuggestions(state) {
  const base = [
    { text: '询问这栋房子的历史', action: { type: 'talk', npc_id: 'landlord', intent: 'polite_question' } },
    { text: '问他是否听过奇怪的声音', action: { type: 'talk', npc_id: 'landlord', intent: 'polite_question' } },
    { text: '观察他的表情（心理学）', action: { type: 'check', skill: 'Psychology' } },
  ];
  if (state.progress.current_location_id === 'library') {
    base.push({ text: '查1908年的旧报纸', action: { type: 'check', skill: 'Library Use' } });
  }
  if (state.progress.current_location_id === 'house') {
    base.push({ text: '检查走廊地板可疑污渍', action: { type: 'check', skill: 'Spot Hidden' } });
  }
  return base;
}

module.exports = { parseCustomInput, buildQuestionSuggestions };
