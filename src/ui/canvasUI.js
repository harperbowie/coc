const ACTIONS = [
  { label: '前往事务所', action: { type: 'move', target: 'office' } },
  { label: '前往图书馆', action: { type: 'move', target: 'library' } },
  { label: '前往鬼屋', action: { type: 'move', target: 'house' } },
  { label: '前往地下室', action: { type: 'move', target: 'basement' } },
  { label: '侦查(SH)', action: { type: 'check', skill: 'Spot Hidden' } },
  { label: '图书馆检索', action: { type: 'check', skill: 'Library Use' } },
  { label: '神秘学检定', action: { type: 'check', skill: 'Occult' } },
  { label: '和房东交谈', action: { type: 'talk', npc_id: 'landlord', intent: 'polite_question' } },
  { label: '威胁房东', action: { type: 'talk', npc_id: 'landlord', intent: 'threaten' } },
  { label: '战斗（近战）', action: { type: 'combat' } },
  { label: '使用急救包', action: { type: 'use_item', item_id: 'first_aid_kit' } },
  { label: '休息', action: { type: 'rest' } },
];

class CanvasUI {
  constructor(engine) {
    this.engine = engine;
    this.canvas = wx.createCanvas();
    this.ctx = this.canvas.getContext('2d');
    this.width = this.canvas.width;
    this.height = this.canvas.height;
    this.buttons = [];
    this.pending = false;
    this.state = null;
    this.scrollY = 0;
    wx.onTouchStart((e) => this.handleTouch(e));
  }

  setState(state) {
    this.state = state;
    this.render();
  }

  async handleTouch(e) {
    if (this.pending || !this.state) return;
    const t = e.touches[0];
    const hit = this.buttons.find((b) => t.clientX >= b.x && t.clientX <= b.x + b.w && t.clientY >= b.y && t.clientY <= b.y + b.h);
    if (!hit) return;
    this.pending = true;
    const next = await this.engine.nextTurn(this.state, hit.action);
    this.pending = false;
    this.setState(next);
  }

  drawButton(x, y, w, h, text, action, color = '#1f2a44') {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, w, h);
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '15px sans-serif';
    this.ctx.fillText(text, x + 8, y + 22);
    this.buttons.push({ x, y, w, h, action });
  }

  renderDraft() {
    const { ctx, width } = this;
    ctx.fillStyle = '#12141d';
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.fillStyle = '#e6ecff';
    ctx.font = '18px sans-serif';
    ctx.fillText('创建角色（三选一）', 16, 30);
    let y = 50;
    this.state.character_drafts.forEach((d, i) => {
      const selected = this.state.selected_draft_idx === i;
      this.drawButton(16, y, width - 32, 80, `${selected ? '✅' : '☐'} ${i + 1}. ${d.name} | ${d.occupation} | ${d.age}岁`, { type: 'select_draft', index: i }, selected ? '#2f5d88' : '#22314d');
      ctx.font = '13px sans-serif';
      ctx.fillStyle = '#bed0ef';
      ctx.fillText(`属性 STR${d.attributes.STR} DEX${d.attributes.DEX} EDU${d.attributes.EDU} | 标签:${d.experience_tags.join('、')}`, 24, y + 56);
      y += 92;
    });

    this.drawButton(16, y + 6, width - 32, 34, 'STR+5 / DEX-5', { type: 'adjust_attr', plus: 'STR', minus: 'DEX' });
    this.drawButton(16, y + 48, width - 32, 40, '确认角色并进入游戏', { type: 'confirm_draft' }, '#3c7a44');
  }

  renderGame() {
    const { ctx, width, height } = this;
    const inv = this.state.investigators[0];
    ctx.fillStyle = '#0f0f14';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#d8d8e0';
    ctx.font = '18px sans-serif';
    ctx.fillText('CoC 跑团系统（商用单机版）', 16, 28);

    ctx.font = '13px sans-serif';
    ctx.fillText(`${inv.name} | ${inv.occupation}`, 16, 50);
    ctx.fillText(`回合:${this.state.progress.current_round} 地点:${this.state.progress.current_location_id}`, 16, 68);
    ctx.fillText(`SAN:${inv.derived.SAN}/${inv.derived.SAN_max} HP:${inv.derived.HP}/${inv.derived.HP_max} MP:${inv.derived.MP}`, 16, 86);
    ctx.fillText(`威胁 时钟:${this.state.threat_state.time_clock} 暴露:${this.state.threat_state.exposure_level} 真相:${this.state.threat_state.truth_progress}`, 16, 104);
    ctx.fillText(`线索:${this.state.clue_progress.discovered_clues.length} 推理:${this.state.clue_progress.inferences.length} 成就:${(this.state.meta.achievements || []).filter(a=>a.unlocked).length}`, 16, 122);

    const latest = this.state.log[this.state.log.length - 1];
    const narrative = latest ? latest.narrative : '雨夜里，你们收到第一份委托。';
    ctx.fillStyle = '#a6accd';
    this.wrapText(narrative, 16, 148, width - 32, 18, 5);

    const notes = (this.state.clue_progress.notebook || []).slice(-2).map((x) => `• ${x.name}`).join('  ');
    ctx.fillStyle = '#87a9d8';
    this.wrapText(`最新线索: ${notes || '暂无'}`, 16, 244, width - 32, 18, 2);

    let y = 286;
    ACTIONS.forEach((item, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const bx = 16 + col * ((width - 40) / 2 + 8);
      const by = y + row * 40;
      const bw = (width - 40) / 2;
      this.drawButton(bx, by, bw, 32, item.label, item.action);
    });

    if (this.state.finished) {
      ctx.fillStyle = '#ffdd88';
      this.wrapText(`结局: ${this.state.ending}`, 16, height - 110, width - 32, 18, 2);
      this.wrapText(this.state.meta.share_cards.ending || '', 16, height - 72, width - 32, 16, 3);
    }
  }

  render() {
    this.buttons = [];
    if (!this.state) return;
    if (this.state.phase === 'character_draft') this.renderDraft();
    else this.renderGame();
  }

  wrapText(text, x, y, maxWidth, lineHeight, maxLines = 99) {
    const chars = String(text).split('');
    let line = '';
    let offsetY = y;
    let lines = 0;
    chars.forEach((ch) => {
      if (lines >= maxLines) return;
      const testLine = line + ch;
      if (this.ctx.measureText(testLine).width > maxWidth) {
        this.ctx.fillText(line, x, offsetY);
        line = ch;
        offsetY += lineHeight;
        lines += 1;
      } else line = testLine;
    });
    if (line && lines < maxLines) this.ctx.fillText(line, x, offsetY);
  }
}

module.exports = { CanvasUI };
