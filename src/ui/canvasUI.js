const ACTIONS = [
  { label: '前往图书馆', action: { type: 'move', target: 'library' } },
  { label: '前往鬼屋', action: { type: 'move', target: 'house' } },
  { label: '侦查线索(Spot Hidden)', action: { type: 'check', skill: 'Spot Hidden' } },
  { label: '图书馆使用(Library Use)', action: { type: 'check', skill: 'Library Use' } },
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

  drawButton(x, y, w, h, text, action) {
    this.ctx.fillStyle = '#1f2a44';
    this.ctx.fillRect(x, y, w, h);
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '16px sans-serif';
    this.ctx.fillText(text, x + 10, y + 24);
    this.buttons.push({ x, y, w, h, action });
  }

  render() {
    const { ctx, width, height } = this;
    this.buttons = [];
    ctx.fillStyle = '#0f0f14';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#d8d8e0';
    ctx.font = '18px sans-serif';
    ctx.fillText('CoC 跑团系统（微信小游戏）', 20, 30);

    if (!this.state) return;
    const inv = this.state.investigators[0];
    ctx.font = '14px sans-serif';
    ctx.fillText(`回合: ${this.state.progress.current_round}`, 20, 58);
    ctx.fillText(`地点: ${this.state.progress.current_location_id}`, 20, 80);
    ctx.fillText(`SAN: ${inv.derived.SAN}/${inv.derived.SAN_max}  HP: ${inv.derived.HP}/${inv.derived.HP_max}`, 20, 102);
    ctx.fillText(`威胁 时钟:${this.state.threat_state.time_clock} 暴露:${this.state.threat_state.exposure_level} 真相:${this.state.threat_state.truth_progress}`, 20, 124);

    const latest = this.state.log[this.state.log.length - 1];
    const narrative = latest ? latest.narrative : '雨夜里，你们收到第一份委托。';
    ctx.fillStyle = '#a6accd';
    this.wrapText(narrative, 20, 150, width - 40, 20);

    let y = height - 220;
    ACTIONS.forEach((item) => {
      this.drawButton(20, y, width - 40, 36, item.label, item.action);
      y += 46;
    });

    if (this.state.finished) {
      ctx.fillStyle = '#ffdd88';
      this.wrapText(`结局: ${this.state.ending}`, 20, height - 260, width - 40, 20);
    }
  }

  wrapText(text, x, y, maxWidth, lineHeight) {
    const chars = text.split('');
    let line = '';
    let offsetY = y;
    chars.forEach((ch) => {
      const testLine = line + ch;
      if (this.ctx.measureText(testLine).width > maxWidth) {
        this.ctx.fillText(line, x, offsetY);
        line = ch;
        offsetY += lineHeight;
      } else {
        line = testLine;
      }
    });
    if (line) this.ctx.fillText(line, x, offsetY);
  }
}

module.exports = { CanvasUI };
