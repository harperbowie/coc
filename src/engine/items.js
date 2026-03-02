const { rollDice } = require('./rules');

function canCarry(state, itemType) {
  const inv = state.investigators[0].inventory_detail || [];
  const count = (type) => inv.filter((x) => x.type === type).length;
  if (itemType === 'Equipment') return count('Equipment') < 2;
  if (itemType === 'Utility') return count('Utility') < 6;
  if (itemType === 'Consumable') return count('Consumable') < 6;
  return true;
}

function addItem(state, item) {
  const inv = state.investigators[0].inventory_detail || [];
  if (!canCarry(state, item.type)) return false;
  inv.push({ ...item, current_uses: item.uses || 1 });
  state.investigators[0].inventory_detail = inv;
  return true;
}

function useItem(state, itemId) {
  const actor = state.investigators[0];
  const inv = actor.inventory_detail || [];
  const item = inv.find((x) => x.id === itemId);
  if (!item) return { ok: false, reason: 'not_found' };

  if (item.type === 'Consumable' && item.effect && item.effect.heal) {
    actor.derived.HP = Math.min(actor.derived.HP_max, actor.derived.HP + item.effect.heal);
  }
  if (item.type === 'Consumable') {
    item.current_uses -= 1;
    if (item.current_uses <= 0) actor.inventory_detail = inv.filter((x) => x !== item);
  }

  if (item.type === 'Equipment' && item.damage) {
    return { ok: true, combat_bonus: { damage: item.damage, weaponSkill: item.skill } };
  }

  return { ok: true };
}

function startingItemsFromScenario(scenario) {
  return (scenario.setup.seed_items || []).map((name) => {
    if (name.includes('手枪')) return { id: 'revolver', name: '左轮手枪', type: 'Equipment', damage: '1D10', skill: 'Firearms (Handgun)' };
    return { id: name, name, type: 'Utility' };
  });
}

module.exports = { addItem, useItem, canCarry, startingItemsFromScenario };
