const ACTIONS = [
  { label: '前往事务所', action: { type: 'move', target: 'office' } },
  { label: '前往图书馆', action: { type: 'move', target: 'library' } },
  { label: '前往鬼屋', action: { type: 'move', target: 'house' } },
  { label: '前往地下室', action: { type: 'move', target: 'basement' } },
  { label: '侦查(SH)', action: { type: 'check', skill: 'Spot Hidden' } },
  { label: '图书馆检索', action: { type: 'check', skill: 'Library Use' } },
  { label: '神秘学检定', action: { type: 'check', skill: 'Occult' } },
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
    wx.onTouchStart((e) => this.handleTouch(e));
  }

  setState(state) {
    this.state = state;
    this.render();
  }

  openKeyboardInput() {
    if (!wx.showKeyboard) return;
    wx.showKeyboard({
      defaultValue: '',
      maxLength: 140,
      confirmType: 'done',
      success: () => {
        wx.onKeyboardConfirm(async (res) => {
          if (!res || !res.value || this.pending) return;
          this.pending = true;
          const next = await this.engine.nextTurn(this.state, { type: 'custom_input', text: res.value });
          this.pending = false;
          this.setState(next);
          wx.hideKeyboard && wx.hideKeyboard();
        });
      },
    });
  }

  async handleTouch(e) {
    if (this.pending || !this.state) return;
    const t = e.touches[0];
    const hit = this.buttons.find((b) => t.clientX >= b.x && t.clientX <= b.x + b.w && t.clientY >= b.y && t.clientY <= b.y + b.h);
    if (!hit) return;
    if (hit.action && hit.action.type === '__toggle_suggestions__') {
      this.state.ui = this.state.ui || {};
      this.state.ui.suggestion_expanded = !this.state.ui.suggestion_expanded;
      this.render();
      return;
    }
    if (hit.action && hit.action.type === '__open_input__') {
      this.openKeyboardInput();
      return;
    }
    this.pending = true;
    const next = await this.engine.nextTurn(this.state, hit.action);
    this.pending = false;
    this.setState(next);
  }

  drawButton(x, y, w, h, text, action, color = '#1f2a44', font = '15px sans-serif') {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, w, h);
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = font;
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

  renderQuestionPanel(yStart) {
    const { ctx, width } = this;
    let y = yStart;
    const expanded = !!(this.state.ui && this.state.ui.suggestion_expanded);
    this.drawButton(16, y, width - 32, 30, expanded ? '💡 收起建议提问' : '💡 点击查看建议提问', { type: '__toggle_suggestions__' }, '#2f3f62', '14px sans-serif');
    y += 36;

    const suggestions = (this.state.ui && this.state.ui.question_suggestions) || [];
    if (expanded) {
      suggestions.slice(0, 4).forEach((s, idx) => {
        this.drawButton(24, y, width - 48, 28, `${idx + 1}. ${s.text}`, s.action, '#344d7a', '13px sans-serif');
        y += 32;
      });
    }

    this.drawButton(16, y + 2, width - 32, 32, '✍️ 自由输入行动/提问', { type: '__open_input__' }, '#5a3f77');
    y += 40;
    ctx.fillStyle = '#95a9d1';
    ctx.font = '12px sans-serif';
    ctx.fillText('示例：问房东这栋房子的历史 / 去图书馆查1908旧报 / 攻击它', 16, y + 8);
    return y + 16;
  }

  renderGame() {
    const { ctx, width, height } = this;
    const inv = this.state.investigators[0];
    ctx.fillStyle = '#0f0f14';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#d8d8e0';
    ctx.font = '18px sans-serif';
    ctx.fillText('CoC 跑团系统（互动增强）', 16, 28);

    ctx.font = '13px sans-serif';
    ctx.fillText(`${inv.name} | ${inv.occupation}`, 16, 50);
    ctx.fillText(`回合:${this.state.progress.current_round} 地点:${this.state.progress.current_location_id}`, 16, 68);
    ctx.fillText(`SAN:${inv.derived.SAN}/${inv.derived.SAN_max} HP:${inv.derived.HP}/${inv.derived.HP_max} MP:${inv.derived.MP}`, 16, 86);

    const latest = this.state.log[this.state.log.length - 1];
    const narrative = latest ? latest.narrative : '雨夜里，你们收到第一份委托。';
    ctx.fillStyle = '#a6accd';
    this.wrapText(narrative, 16, 112, width - 32, 18, 2);

    const story = inv.background_story || '背景故事生成中...';
    ctx.fillStyle = '#8ba2c7';
    this.wrapText(story, 16, 158, width - 32, 16, 4);

    let y = this.renderQuestionPanel(230);

    ACTIONS.slice(0, 8).forEach((item, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const bx = 16 + col * ((width - 40) / 2 + 8);
      const by = y + row * 34;
      const bw = (width - 40) / 2;
      this.drawButton(bx, by, bw, 28, item.label, item.action, '#243654', '13px sans-serif');
    });

    if (this.state.finished) {
      ctx.fillStyle = '#ffdd88';
      this.wrapText(`结局: ${this.state.ending}`, 16, height - 90, width - 32, 16, 2);
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
