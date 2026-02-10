function fallbackBackstory(draft) {
  const tags = (draft.experience_tags || []).slice(0, 2).join('、') || '平凡经历';
  return `你叫${draft.name}，是一名${draft.occupation}。在${draft.age}岁之前，你的人生被${tags}深刻塑造。最近一段时间，你反复梦见潮湿走廊与断裂的祷文，于是你开始记录每一条异常线索。你并不相信命运，但你知道，若放任未知蔓延，下一次崩溃可能发生在任何人身上。`;
}

function callDeepSeekForBackstory(draft) {
  return new Promise((resolve) => {
    const apiKey = wx.getStorageSync('DEEPSEEK_API_KEY') || '';
    if (!apiKey) return resolve({ ok: false, reason: 'missing_api_key' });
    const prompt = {
      role: '资深CoC角色编剧',
      constraints: ['100-200字', '第二人称代入', '不得泄露剧本真相', '风格克制压抑'],
      character: {
        name: draft.name,
        age: draft.age,
        occupation: draft.occupation,
        tags: draft.experience_tags,
        attrs: {
          STR: draft.attributes.STR,
          DEX: draft.attributes.DEX,
          INT: draft.attributes.INT,
          POW: draft.attributes.POW,
          EDU: draft.attributes.EDU,
        },
      },
      output: '仅输出背景故事正文',
    };

    wx.request({
      url: 'https://api.deepseek.com/chat/completions',
      method: 'POST',
      header: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      data: {
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: '你是擅长克苏鲁调查员背景创作的作者。' },
          { role: 'user', content: JSON.stringify(prompt) },
        ],
        temperature: 0.7,
      },
      success: (res) => {
        const text = res?.data?.choices?.[0]?.message?.content || '';
        if (!text.trim()) return resolve({ ok: false, reason: 'empty' });
        resolve({ ok: true, text: text.trim() });
      },
      fail: () => resolve({ ok: false, reason: 'network_error' }),
    });
  });
}

function sanitizeBackstory(text) {
  const clean = String(text || '').replace(/\s+/g, '').slice(0, 260);
  return clean || '';
}

async function generateBackstory(draft) {
  const res = await callDeepSeekForBackstory(draft);
  if (res.ok) {
    const story = sanitizeBackstory(res.text);
    if (story.length >= 60) return story;
  }
  return fallbackBackstory(draft);
}

module.exports = { generateBackstory, fallbackBackstory };
