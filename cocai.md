# 多人联机CoC跑团系统 - 完整设计方案

## 项目背景

基于现有 life-restart-ai 项目，重构为支持多人联机的CoC(克苏鲁的呼唤)跑团游戏系统。

**核心设计理念**:
- **内容与代码完全分离**: 所有世界观/AI提示词/模组数据外部化为JSON文件
- **世界驱动，非玩家驱动**: 玩家不是"主角"，只是"世界中的调查者"，世界不会等你
- **硬核调查体验**: 允许失败，不保证通关，多周目Roguelike设计
- **AI是资深KP**: 引擎控制逻辑，AI只负责氛围叙述

**技术栈**:
- 前端: Vue3 + TypeScript + Pinia + Vite
- 后端: Python + FastAPI
- AI: DeepSeek API（微信小游戏密钥环境变量）
- 数据: 单机LocalStorage + 联机PostgreSQL/MySQL
- 平台: 微信小游戏

---

## 一、核心架构：三层内容文件系统

### 1.1 三层架构设计

```
content/
└── versions/
    └── coc_1920s/                        # 版本目录
        ├── world.json                    # 第一层：世界观（固定）
        ├── keeper_prompt.json            # 第二层：AI KP提示词（固定）
        └── scenarios/                    # 第三层：剧本（可变）
            ├── the_haunting.json
            ├── dead_light.json
            └── edge_of_darkness.json
```

### 1.2 第一层：world.json（世界观层）

**作用**: 定义整个版本的世界基础，所有模组共用

**内容结构**:
```json
{
  "version_id": "coc_1920s",
  "name": "1920年代美国",
  "description": "禁酒令时期的波士顿，黑帮与神秘学交织...",
  "era": "1920s",

  "world_lore": {
    "time_period": {
      "year_range": "1920-1929",
      "historical_context": "禁酒令、爵士时代、经济繁荣前夜",
      "technology_level": "早期汽车、电话、煤气灯与电灯并存"
    },

    "cosmic_horror_principles": {
      "reality_nature": "人类理性有限，宇宙真相不可知",
      "horror_source": "未知、失控、人类渺小",
      "forbidden_knowledge": "接触真相必然付出代价（理智）"
    },

    "narrative_guidelines": {
      "horror_presentation": "暗示优于直接、渐进优于突然",
      "atmosphere_building": "环境异常→超自然显现→直面恐怖（三阶段）",
      "player_agency": "玩家选择有意义，但世界不因玩家改变规律"
    }
  },

  "universal_rules": {
    "physics": "现实世界物理定律",
    "supernatural": "超自然存在但隐藏，违背常识，代价高昂",
    "mortality": "调查员脆弱，死亡/疯狂是真实威胁"
  }
}
```

### 1.3 第二层：keeper_prompt.json（AI KP提示词层）

**作用**: 让AI成为"资深KP"的核心提示词，所有模组共用

**内容结构**:
```json
{
  "system_role": "你是一位拥有20年经验的资深CoC守密人(Keeper)。",

  "core_capabilities": {
    "consistency": {
      "description": "维持世界一致性",
      "rules": [
        "NPC动机/性格/知识不能前后矛盾",
        "世界规律不因玩家期待改变",
        "已确立事实不可推翻"
      ]
    },

    "fairness": {
      "description": "公平裁决，不作弊",
      "rules": [
        "骰子结果优先于叙述偏好",
        "不因玩家可怜而降低难度",
        "不因剧情需要而强推情节"
      ]
    },

    "pacing": {
      "description": "节奏控制",
      "rules": [
        "威胁渐进而非突然爆发",
        "恐怖氛围根据threat_level调整",
        "关键时刻放慢节奏，日常时刻加快"
      ]
    },

    "subtlety": {
      "description": "暗示与恐惧",
      "rules": [
        "不把怪物直接丢脸上，先用痕迹/声音/气味",
        "让玩家脑补比直接描述更恐怖",
        "使用'你感到不安'而非'有怪物在盯着你'"
      ]
    },

    "improvisation": {
      "description": "即兴不跑偏",
      "rules": [
        "可自由生成细节（环境/NPC对话/次要物品）",
        "不可改变真相（gm_only.truth）",
        "不可泄露秘密（NPC secrets）",
        "不可创造新的核心线索/地点/NPC（只能用scenario定义的）"
      ]
    },

    "fail_forward": {
      "description": "失败推进",
      "rules": [
        "检定失败不是'没发生'，而是'有代价'",
        "核心线索失败仍可获得，但付出时间/SAN/暴露",
        "失败创造新的麻烦，而非阻止进度"
      ]
    }
  },

  "iron_rules": {
    "never_modify_numbers": "绝不修改HP/SAN/技能值/检定结果，这些由引擎决定",
    "never_spoil_truth": "绝不在叙述中泄露gm_only.truth的内容",
    "never_add_facts": "绝不在叙述中新增：新伤害/新敌人/新线索/新地点变化",
    "never_judge_checks": "绝不自己决定是否需要检定，由引擎触发",
    "only_narrate_results": "只能叙述引擎已裁决的结果，不能改变任何数值或事实"
  },

  "narrative_style": {
    "tone": "冷静叙述为主，偶有压抑不安",
    "pov": "第二人称（'你看到...'），营造代入感",
    "sensory_details": "优先视觉、听觉、嗅觉（触觉用于恐怖强化）",
    "length": "单次叙述控制在100-200字，关键时刻可延长至300字"
  },

  "output_format": {
    "structure": "场景描述 → 行动结果 → 新信息/线索 → 当前选项提示",
    "suggestions": "生成2-4个行动建议（收起状态，玩家可展开查看）",
    "never_force_choice": "建议是提示，玩家可自由输入"
  }
}
```

### 1.4 第三层：scenario_xxx.json（剧本层）

**作用**: 具体模组的完整剧情数据，每个模组独立

**9大模块结构概览**:

1. **meta** - 元数据（ID、名称、难度、标签）
2. **setup** - 开场设定（起始位置、时间、目标）
3. **gm_only.truth** - 真相（核心秘密、时间线、胜利条件）
4. **entities** - 实体定义（地点/NPC/线索/物品）
5. **graph** - 关系图（地点图/线索图）
6. **content_blocks** - 内容库（叙述文本）
7. **systems** - 系统配置（威胁系统/失败前推规则）
8. **encounters** - 触发事件
9. **endings** - 结局

**详细结构示例**（以《鬼屋》为例）:

#### Module 1: meta
```json
{
  "meta": {
    "scenario_id": "the_haunting",
    "version": "coc_1920s",
    "name": "鬼屋",
    "name_en": "The Haunting",
    "difficulty": "beginner",
    "estimated_rounds": "10-15",
    "recommended_players": "1-4",
    "summary": "调查Corbitt宅邸的怪异事件，揭开死灵巫师的秘密"
  }
}
```

#### Module 2: setup
```json
{
  "setup": {
    "start_location_id": "corbitt_mansion_exterior",
    "start_time": "1925-10-15 14:00",
    "intro_prompt": "房东Macario找到你们，说他的房产最近的租客频频搬离，甚至有人发疯。他希望你们调查此事。",
    "player_goal_public": "调查Corbitt宅邸的怪异现象，找出真相",
    "initial_clues": ["clue_landlord_request"]
  }
}
```

#### Module 3: gm_only.truth
```json
{
  "gm_only": {
    "truth": {
      "core_mystery": "Corbitt是死灵术士，被仇家杀死后灵魂困在宅邸，通过地下室法阵吸取生者生命力试图复活",

      "timeline": [
        "1912: Corbitt搬入宅邸，开始研习死灵术",
        "1918: Corbitt被发现秘密并杀死",
        "1919-1924: Corbitt鬼魂持续活动，租客陆续出事",
        "1925: 现在，法阵能量积累接近完成"
      ],

      "win_conditions": [
        "摧毁地下室法阵",
        "烧毁宅邸",
        "进行驱魔仪式"
      ],

      "leak_keywords": ["Corbitt", "necromancy", "ritual"],
      "leak_blacklist_patterns": [
        "直接说'Corbitt是巫师'",
        "直接说'地下室有法阵'"
      ]
    }
  }
}
```

#### Module 4: entities

**locations**:
```json
{
  "entities": {
    "locations": {
      "mansion_basement": {
        "name": "地下室",
        "type": "underground",
        "danger_level": 5,
        "accessibility": "locked",
        "requires": {
          "items": ["basement_key"],
          "or_check": {
            "skill": "Locksmith",
            "difficulty": "hard"
          }
        }
      }
    }
  }
}
```

**npcs**:
```json
{
  "npcs": {
    "landlord_macario": {
      "name": "Macario",
      "role": "房东",
      "personality": "谨慎、胆小、贪财",
      "motive": "不想惹麻烦，想收租金",

      "secrets": ["知道Corbitt是巫师", "曾目睹仪式"],

      "knowledge": [
        "clue_house_history",
        "clue_strange_sounds"
      ],

      "lies": ["声称不知道Corbitt的过去"],

      "initial_attitude": "suspicious",

      "give_clues": {
        "clue_corbitt_background": {
          "condition": "attitude >= friendly AND persuade_success"
        }
      },

      "reactions": {
        "persuade_success": { "attitude_change": 1 },
        "threaten_fail": { "attitude_change": -1 }
      }
    }
  }
}
```

**clues**:
```json
{
  "clues": {
    "clue_ritual_book": {
      "id": "clue_ritual_book",
      "name": "死灵仪式笔记",
      "type": "document",
      "description": "一本皮革装订的笔记，记录了灵魂束缚仪式的步骤",
      "is_core": true,
      "leads_to": ["clue_basement_ritual"],

      "on_read": {
        "san_trigger": {
          "level": "moderate",
          "san_loss": "1/1D4"
        },
        "cthulhu_mythos_gain": 1
      }
    }
  }
}
```

**items**:
```json
{
  "items": {
    "basement_key": {
      "id": "basement_key",
      "name": "地下室钥匙",
      "type": "key_item",
      "description": "生锈的铁钥匙",
      "can_discard": false,
      "unlocks": { "location": "mansion_basement" }
    }
  }
}
```

#### Module 5: graph

**location_graph**:
```json
{
  "graph": {
    "location_graph": {
      "edges": [
        {
          "from": "mansion_living_room",
          "to": "mansion_basement",
          "access": {
            "requires": { "items": ["basement_key"] }
          },
          "travel_cost": { "time": 2 }
        }
      ]
    }
  }
}
```

**clue_graph**:
```json
{
  "clue_graph": {
    "edges": [
      {
        "from": "clue_ritual_book",
        "to": "clue_basement_ritual",
        "relation": "explains"
      }
    ]
  }
}
```

#### Module 6: content_blocks

```json
{
  "content_blocks": {
    "locations": {
      "mansion_basement": {
        "summary": "阴冷的地下室，空气中有霉味和血腥味",
        "first_visit": "石阶向下延伸，光线逐渐被黑暗吞没。你的手电筒照亮狭小的空间，墙上有奇怪的符文。地面中央有一个用血画成的法阵。",
        "san_trigger": {
          "on_first_visit": {
            "level": "severe",
            "san_loss": "1/1D6"
          }
        }
      }
    }
  }
}
```

#### Module 7: systems

```json
{
  "systems": {
    "threat_state": {
      "time_clock": {
        "start_value": 0,
        "deadline": 15,
        "events": [
          {
            "at_round": 10,
            "description": "午夜将至",
            "effects": { "trigger_encounter": "ghost_appearance" }
          }
        ]
      },

      "exposure_level": {
        "start_value": 0,
        "max_value": 100,
        "thresholds": [
          {
            "value": 60,
            "trigger_encounter": "poltergeist_activity"
          }
        ]
      },

      "truth_progress": {
        "core_clues_required": ["clue_corbitt_background", "clue_ritual_book"],
        "stages": [
          {
            "progress": 66,
            "description": "理解Corbitt的真实身份",
            "unlocks": { "flag": "knows_corbitt_necromancer" }
          }
        ]
      }
    },

    "exposure_delta_rules": [
      {
        "action_type": "investigate",
        "tags": ["basement", "ritual"],
        "delta": 20
      }
    ],

    "fail_forward_policy": {
      "mode": "give_but_cost",
      "applies_to": "core_clues_only",
      "clue_cost_mapping": {
        "clue_ritual_book": "moderate"
      },
      "cost_profiles": {
        "moderate": {
          "time_cost": 2,
          "exposure_cost": 20,
          "san_loss": "1/1D3"
        }
      }
    }
  }
}
```

#### Module 8: encounters

```json
{
  "encounters": {
    "ghost_attack": {
      "id": "ghost_attack",
      "when": {
        "exposure_threshold": 90
      },
      "what_happens": "Corbitt的鬼魂具象化，向调查员发起攻击",
      "effects": {
        "enter_combat": {
          "enemy": "corbitt_ghost"
        },
        "san_trigger": {
          "level": "severe",
          "san_loss": "1D4/1D10"
        }
      }
    }
  }
}
```

#### Module 9: endings

```json
{
  "endings": {
    "ending_destroy_ritual": {
      "id": "ending_destroy_ritual",
      "type": "victory",
      "name": "【毁灭】烧毁宅邸，鬼魂被困",
      "conditions": {
        "all": [
          { "flag": "knows_corbitt_necromancer" },
          { "action": "burn_mansion" }
        ]
      },
      "outcome_effects": {
        "san_recovery": "1D6",
        "narrative": "大火吞没了整栋宅邸。在火光中，你仿佛看到Corbitt扭曲的身影在嘶吼，但最终消散在烈焰中。",
        "unlock_achievement": "achievement_burn_it_down"
      }
    }
  }
}
```

---

## 二、9大系统模块设计

### 2.1 房间/大厅系统

**设计原则**: 单人优先，多人预留接口

**流程**:
```
玩家进入游戏
    ↓
【主界面】
  [开始调查] (单人)
  [多人调查] (灰色，暂未开放)
    ↓
【选择年代】
  扫描content/versions/目录
  显示：名称 + 简介（从world.json读取）
    ↓
【选择案件】
  扫描scenarios/目录
  显示：名称 + 简介
  已完成显示：✓ 已完成 - 达成结局：【毁灭】烧毁宅邸
  解锁机制：完成一个解锁下一个
    ↓
【角色抽取】"三选一"
    ↓
进入游戏
```

**数据结构**:
```typescript
interface GameRoom {
  room_id: string
  scenario_id: string
  version_id: string
  max_players: number  // 单机固定为1

  players: Array<{
    player_id: string
    investigator: CoCInvestigator
    is_ready: boolean
  }>

  game_state: GameState
}
```

### 2.2 存档系统

**设计原则**: 每回合结束自动存档，覆盖式，不允许回档SL

**存档内容**（6大类）:

```typescript
interface GameSave {
  room_id: string
  scenario_id: string
  version_id: string

  // ① 当前进度
  progress: {
    current_round: number
    game_time: string
    current_location_id: string
  }

  // ② 角色状态
  investigators: CoCInvestigator[]

  // ③ 线索进度
  clue_progress: {
    discovered_clues: string[]
    deductions_triggered: string[]
  }

  // ④ 世界状态
  world_state: {
    modified_entities: Record<string, any>
    npc_states: Record<string, NPCState>
    triggered_events: string[]
    global_flags: Record<string, boolean>
  }

  // ⑤ 威胁系统
  threat_state: {
    time_clock: number
    exposure_level: number
    truth_progress: number
  }

  // ⑥ AI记忆
  ai_memory: {
    canon_facts: StructuredFact[]
    open_threads: OpenThread[]
    recent_summaries: string[]
  }

  save_timestamp: number
}
```

### 2.3 战斗系统

**设计原则**: 简化剧情战斗，1-3轮结束

**触发方式**:
1. 玩家主动（"攻击它"）
2. 剧情触发（scenario.json定义）

**流程**:
```
进入战斗态
  ↓
每轮：
  所有人选择行动（攻击/逃跑/躲避/使用物品）
  ↓
  引擎按DEX排序
  ↓
  引擎执行检定和伤害
  ↓
  引擎决定怪物目标（优先级规则）
  ↓
  引擎生成裁决摘要
  ↓
  AI根据裁决写恐怖叙述
```

**引擎必须做**:
- 先攻顺序（DEX排序）
- 掷骰（D100+伤害骰）
- 判定成功等级
- 计算伤害
- 怪物目标选择（被挑衅>同场景>最脆>威胁高>随机）

**AI只做**:
- 把裁决结果写成恐怖叙述
- 不得新增事实

**数据结构**:
```typescript
interface CombatRoundResult {
  round_number: number
  action_order: string[]

  actions: Array<{
    actor: string
    action_type: 'attack' | 'flee' | 'dodge'
    success_level: string
    damage_dealt?: number
  }>

  additional_effects: {
    san_checks: any[]
    time_increment: number
  }
}
```

### 2.4 物品/道具系统

**物品获得方式**:
1. 调查发现
2. NPC给予
3. 初始携带
4. 购买（补给点）

**物品类型**（4类）:
- **Consumable**: 有uses/quantity（急救包×3）
- **Equipment**: 影响规则（手枪1D10）
- **Key Item**: 触发剧情（地下室钥匙）
- **Utility**: 叙事交互（笔记本）

**使用规则**:
- 战斗态：使用物品=占一个行动
- 非战斗态：消耗时间(TimeClock)

**背包限制**:
- 武器2件、工具6件、消耗品6组
- 关键道具不限

**关键道具触发**（最重要）:
- scenario.json定义触发条件
- 引擎检查条件
- AI不参与判断

### 2.5 理智值(SAN)系统

**触发时机**（3大类）:
1. 看到超自然/神话现象
2. 目睹死亡/暴力场景
3. 接触神话真相证据

**触发决定**: scenario.json预定义 + 引擎触发

**损失计算**（恐怖等级）:
- minor: 0/1D2
- moderate: 1/1D6
- severe: 1D4/1D10
- cosmic: 1D6/1D20

**疯狂状态**:

**临时疯狂**:
- 触发：单次SAN损失≥5
- 持续：场景结束或2回合
- 表现：引擎从表中抽（逃跑/僵直/歇斯底里/攻击同伴/幻觉/昏厥）

**不定疯狂**:
- 触发：SAN≤0 或 累计损失≥SAN最大值20%
- 表现：表中抽（偏执/抑郁/失忆/强迫）
- 持续：模组结束

**恐惧症**:
- 生成：疯狂触发时30%概率附带
- 触发：场景带匹配tag → 检定
- 后果：行动受限/额外SAN损失/暴露+

**SAN恢复**（有限）:
- 休息：+1，一天一次，代价TimeClock推进
- 治疗：技能检定，恢复1D3
- 结局奖励：成功+1D6

**AI约束**:
1. 不能改数值
2. 不能新增机械后果
3. 只能围绕症状类型发挥

### 2.6 技能检定系统

**UI展示**:
```
侦查 65% | 掷骰 42 → 常规成功
侦查 65%（黑暗-20=45%）| 掷骰 42 → 常规成功
```

**成功等级**（6档）:
1. 大成功: 01
2. 极难成功: ≤技能/5
3. 困难成功: ≤技能/2
4. 常规成功: ≤技能
5. 失败: >技能
6. 大失败: 100或96-100且技能<50

**触发时机**:
- 玩家主动（"搜索房间" → 意图解析 → 引擎触发）
- scenario.json预定义
- 引擎规则触发（被动感知）

**对抗检定**:
- 双方掷D100
- 都成功→比成功等级
- 等级相同→比成功差值

**检定修正**:
- scenario.json预定义（黑暗-20）
- 角色状态/装备（受伤-10）
- AI建议（引擎白名单校验）

**技能成长**:
- 使用成功→打勾
- 模组结束→成长检定：D100>当前技能值 → +1D10

### 2.7 NPC互动系统

**对话方式**: 混合模式

**UI**:
```
你面对房东 Macario

💡 [点击查看建议提问] ← 收起

展开后：
① 询问这栋房子的历史
② 问他是否听过奇怪的声音
③ 观察他的表情（心理学）

[自由输入框]
```

**NPC态度**（5级标签）:
```
hostile → suspicious → neutral → friendly → trusting
```

**态度变化**:
- scenario.json定义reactions
- 引擎控制

**NPC知识管理**:
```json
{
  "personality": "谨慎、胆小",
  "secrets": ["知道Corbitt是巫师"],
  "knowledge": ["clue_house_history"],
  "lies": ["声称不知道过去"],
  "give_clues": {
    "clue_corbitt": {
      "condition": "attitude >= friendly"
    }
  }
}
```

**防泄露**（AI约束）:
```
1. 只能谈论knowledge
2. 绝不说secrets
3. 问到秘密→回避/转移/说谎
```

**线索给予**:
```
玩家对话
  ↓ 意图解析
  ↓ 检定
  ↓ 引擎检查条件
  ↓ 满足→给线索→通知AI
  ↓ AI叙述
```

**NPC记忆**:
```typescript
interface NPCState {
  npc_id: string
  current_attitude: string
  flags: string[]
  given_clues: string[]
  lied_about: string[]
}
```

### 2.8 线索收集与整理系统

**线索笔记本**:
- 名称、描述、来源、获得时间、类型、状态
- ❌不显示：是否核心、是否指向真相

**关系图**:
- scenario.json的clue_graph
- 只能查看，不能手动连线

**线索发现**（4种来源）:
1. 地点调查成功
2. NPC满足条件给予
3. 阅读文件/物品
4. Fail-forward（仅核心线索）

**推理系统**（自动）:
```
线索A+B满足条件
  ↓ 自动解锁推理节点C
  ↓ "你开始意识到..."
  ↓ AI写气氛解释
```

**核心线索与剧情推进**:

**难度分层**:
- 简单：普通成功
- 中等：困难成功
- 困难：高技能+困难成功

**Fail-forward代价**:
| 难度 | 代价 |
|------|------|
| 简单 | 时间+SAN(0/1) |
| 中等 | 时间+暴露 |
| 困难 | 时间+暴露+SAN(1/1D3) |

**不做替代路径**:
```
漏掉关键线索
  ↓ 误判真相
  ↓ 错误决策
  ↓ 威胁推进
  ↓ 坏结局
```

**核心哲学**:
> 玩家不是"主角"，只是"世界中的调查者"。
> 世界不会等你。

### 2.9 微信小游戏特定功能

**微信授权**:
- 联机/云端/排行榜：必须登录（wx.login→后端换openid）
- 单机：可不登录（游客模式）

**登录时机**:
```
首次进入→游客秒进
  ↓
点击联机/云存档/排行榜
  ↓
弹出"微信登录"按钮
```

**分享功能**（3种）:

**① 邀请好友**（联机房间码）

**② 结局炫耀图**（最传播）:
```
🎭 我在《鬼屋》中达成结局：
【毁灭】烧毁宅邸，鬼魂被困
第12轮 | SAN剩余3
挑战你的理智 →
```

**③ 案件挑战书**（拉新）:
```
🕯️ 敢来试试《鬼屋》吗？
1920年代 | 恐怖调查
一键开局 →
```

**分享奖励**（氛围奖励）:
- 额外体力
- 装饰称号
- 音效包

**排行榜**:
- 通关难度榜
- 结局收集度
- SAN极限生还
- 最短回合通关
- 朋友榜>全服榜

**成就系统**（20个）:
```
🏆 "第一次见到祂"
🏆 "理智崩溃但坚持到底"
🏆 "绝望难度幸存者"
```

**云存档**:
| 模式 | 存档 | 登录 |
|------|------|------|
| 默认 | 本地 | ❌ |
| 可选 | 云备份 | ✅ |
| 联机 | 云端 | ✅ |

**性能优化**:
- 主包4MB、总包20MB
- 分包：模组/图片/音频→远程/CDN
- 首屏2秒加载
- 虚拟列表（日志）
- WebSocket复用+心跳
- 前后台切换处理

**MVP必须包含**:
1. 游客秒进+可选登录
2. 结局分享卡
3. 成就系统（20个）
4. 朋友榜
5. 虚拟列表+存档压缩
6. 联机入口占位

### 2.10 角色卡系统 - "三选一"

**核心机制**:
- 生成3个角色→选1个→调整属性→确认

**角色构成**:

**① 名字**（精简版）:
- 20姓+20男名+20女名
- 性别随机
- 同房间不重名

**② 职业**（5种）:
- 记者/侦探/医生/教授/警察
- 技能加成（不是属性加成）
- 倾向不重复但允许重复

**③ 经历标签**（15-20个池）:
- 每角色1-3个
- 有职业专属倾向
- 标签互斥
- 效果：技能加成、属性±5、AI触发词

**④ 属性**:
- 3D6×5 roll点
- 年龄影响：
  - 20-39正常
  - 40-49: EDU+5, STR/DEX-5
  - 50+: EDU+10, STR/DEX-10
- 选定后±5调整（总点数不变）

**⑤ 背景故事**:
- AI生成100-200字
- 基于职业+经历

**⑥ 角色关系**（多人）:
- 随机生成"同事"/"朋友"/"曾合作"
- 影响AI叙述

**流程**:
```
点击"创建角色"
  ↓ 抽卡动画
  ↓ 三选一界面（3张卡片）
  ↓ 点击查看详情
  ↓ 调整属性（±5按钮）
  ↓ [重新抽取][确认创建]
  ↓ 进入游戏
```

**重新抽取**: 消耗资源

---

## 三、核心数据结构

### 调查员
```typescript
interface CoCInvestigator {
  id: string
  name: string
  occupation: string
  age: number
  gender: 'male' | 'female'

  attributes: {
    STR: number, CON: number, SIZ: number, DEX: number,
    APP: number, INT: number, POW: number, EDU: number
  }

  derived: {
    HP: number, HP_max: number,
    SAN: number, SAN_max: number,
    MP: number, Luck: number,
    damageBonus: string, build: number, move: number
  }

  skills: {
    'Fighting (Brawl)': number,
    'Firearms (Handgun)': number,
    'First Aid': number,
    'Library Use': number,
    'Spot Hidden': number,
    'Psychology': number,
    // ... 10-15核心技能
  }

  inventory: string[]
  cash: number
  conditions: string[]
  temporary_insanity?: any
  phobias: any[]
  experience_tags: any[]
}
```

### 游戏状态
```typescript
interface GameState {
  room_id: string
  scenario_id: string

  progress: {
    current_round: number
    game_time: string
    current_location_id: string
  }

  investigators: CoCInvestigator[]

  clue_progress: {
    discovered_clues: string[]
  }

  world_state: {
    npc_states: Record<string, NPCState>
    global_flags: Record<string, boolean>
  }

  threat_state: {
    time_clock: number
    exposure_level: number
    truth_progress: number
  }

  ai_memory: {
    canon_facts: StructuredFact[]
    open_threads: OpenThread[]
    recent_summaries: string[]
  }
}
```

---

## 四、AI集成设计

### 4.1 五层输入架构

```typescript
interface AIKeeperInput {
  // 第1层：系统角色（固定）
  system_role: string  // keeper_prompt.json

  // 第2层：世界观（固定）
  world_context: string  // world.json

  // 第3层：模组框架（固定）
  scenario_framework: {
    truth: string
    current_location: LocationInfo
    available_npcs: NPCInfo[]
  }

  // 第4层：当前状态（动态）
  current_state: {
    round: number
    investigators: InvestigatorSummary[]
    threat_state: ThreatState
    recent_facts: StructuredFact[]
  }

  // 第5层：本轮行动（实时）
  this_round: {
    player_actions: PlayerAction[]
    check_results: SkillCheckResult[]
  }
}
```

### 4.2 三阶段存储（Token优化）

**Raw Log → Turn Summary → Canon Facts**

```typescript
// 原始日志
interface RawLog {
  round: number
  player_inputs: string[]
  ai_narrative: string
}

// 回合摘要
interface TurnSummary {
  round: number
  key_actions: string[]
  important_discoveries: string[]
}

// 结构化事实
interface StructuredFact {
  fingerprint: string  // MD5
  turn_first: number
  turn_latest: number
  type: 'location' | 'npc_state' | 'clue'
  data: any
}
```

**压缩触发**:
- 每回合自动
- Token预警（>800）深度压缩

**时间窗口过滤**:
- 最近3轮：全部保留
- 3-10轮：只保留核心类型
- 10轮以上：只保留OpenThread关联

### 4.3 OpenThreads

```typescript
interface OpenThread {
  thread_id: string
  type: 'unresolved_clue' | 'npc_secret' | 'speculation'
  entity_id: string
  created_turn: number
  resolve_conditions: any[]
  resolve_mode: 'any' | 'all'
}
```

### 4.4 AI输出格式

```typescript
interface AIKeeperOutput {
  narrative: string  // 100-200字

  suggestions: Array<{
    text: string
    type: 'ask' | 'investigate'
  }>

  suggested_modifiers?: Array<{
    skill: string
    modifier: number  // 只能±20/±10
  }>
}
```

### 4.5 AI约束验证

```typescript
function validateAIOutput(output, context): boolean {
  // 1. 不得泄露关键词
  if (containsAny(output.narrative, leakKeywords)) return false

  // 2. 不得包含数值修改
  if (/HP|SAN|技能.*\d+/.test(output.narrative)) return false

  // 3. 不得新增未定义实体
  if (!isSubset(mentionedEntities, definedEntities)) return false

  return true
}
```

---

## 五、技术实施步骤

### Phase 1: 基础架构（Week 1-2）
- Vue3+TypeScript前端
- Python+FastAPI后端
- 内容加载系统
- 基础游戏循环
- DeepSeek API集成

**验证**:
- [ ] 能加载版本/案件列表
- [ ] 能完成一轮对话

### Phase 2: 角色卡（Week 3）
- names.json/occupations.json/experiences.json
- CharacterDraftSystem
- 角色卡UI
- AI背景故事生成

**验证**:
- [ ] 能生成3个随机角色
- [ ] 属性调整正确

### Phase 3: 核心规则（Week 4-5）
- 技能检定（D100+6档）
- 战斗系统（简化版）
- SAN系统（疯狂表）
- 物品系统（4类）

**验证**:
- [ ] 检定显示正确
- [ ] 战斗流程完整
- [ ] SAN损失正确

### Phase 4: NPC与线索（Week 6）
- NPC系统（态度/知识）
- 线索系统（笔记本/关系图）
- 推理系统（自动触发）

**验证**:
- [ ] NPC对话正常
- [ ] 线索正确给予
- [ ] AI不泄露秘密

### Phase 5: 威胁与结局（Week 7）
- 威胁系统（三维）
- 遭遇事件
- 结局判定

**验证**:
- [ ] 威胁推进正确
- [ ] 结局触发正确

### Phase 6: AI记忆优化（Week 8）
- 三阶段存储
- 结构化事实
- OpenThreads
- 压缩触发

**验证**:
- [ ] Token控制1000-1200
- [ ] 长时间不丢信息

### Phase 7: 存档与微信（Week 9-10）
- 存档系统（6大类）
- 微信授权
- 分享功能
- 成就系统
- 性能优化

**验证**:
- [ ] 存档正常
- [ ] 分享卡生成
- [ ] 首屏2秒加载

### Phase 8: 多人预留（Week 11）
- 数据结构多人化
- UI占位

**验证**:
- [ ] 单人完整可玩
- [ ] 数据支持多人扩展

### Phase 9: 测试优化（Week 12）
- 完整流程测试
- 边界情况测试
- AI行为测试
- 性能测试

**验证**:
- [ ] 无bug
- [ ] AI符合约束
- [ ] 性能稳定

---

## 六、总结

这份方案实现了:

✅ **三层内容架构**: world.json + keeper_prompt.json + scenario_xxx.json
✅ **世界驱动设计**: 硬核调查，允许失败，多周目
✅ **AI是资深KP**: 引擎控逻辑，AI只叙述
✅ **9大系统模块**: 完整CoC体验
✅ **Token优化**: 五层输入+三阶段存储
✅ **微信小游戏**: 秒进+分享+性能优化

**核心哲学**:
> 玩家不是"主角"，只是"世界中的调查者"。
> 世界不会等你。
> 引擎控制规则，AI只演绎氛围。

下一步: 按Phase 1-9逐步实施。
