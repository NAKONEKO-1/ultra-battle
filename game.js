'use strict';

/* ============================================================
   初代怪兽对战 · 原型 v1.1

   这一版：
   - 八种状态：迟缓 / 眩晕 / 击退 / 浮空 / 混乱 / 倒地 / 神经中毒 / 钳制
   - 技能带效果字段（fx）
   - 被动重写
   - 领域 + 羁绊：见 POLISH 段（下一步接入）
   ============================================================ */

const MAX_TIMER = 24;
const TEAM_COST = 20;
const EP_MAX = 100;
const EP_START = 30;
const EP_REGEN = 8;
const MAX_SWITCH = 3;
const BREAK = 1.6;
const COUNTER_A_GUARD = 0.15;

/* 宇宙人克全体怪兽；怪兽三环：宇宙怪兽 > 超能力怪兽 > 地球怪兽 > 宇宙怪兽 */
const TYPE_CHART = {
  cosmosMan:    { cosmosBeast: 1.1, esper: 1.1, earthMonster: 1.1 },
  cosmosBeast:  { esper: 1.1 },
  esper:        { earthMonster: 1.1 },
  earthMonster: { cosmosBeast: 1.1 },
};
const OVERLORD_BONUS = 0.2;

function typeMult(att, def) {
  const chart = TYPE_CHART[att.type];
  let m = (chart && chart[def.type]) || 1;
  if (att.overlord && m > 1) m += OVERLORD_BONUS;
  return m;
}

const TYPE_NAME = {
  melee: '格斗', beam: '光线', stance: '姿态', ult: '必杀',
  field: '领域', util: '功能', passive: '被动',
};

/* ---------------- 通用技能 ---------------- */
const COMMON = {
  swift:   { id: 'swift',   name: '连击', type: 'melee', power: 50, ep: 6,  desc: '通用格斗' },
  iron:    { id: 'iron',    name: '拳击', type: 'melee', power: 65, ep: 10, desc: '无明显效果' },
  beam:    { id: 'beam',    name: '光束', type: 'beam',  power: 55, ep: 10, desc: '通用光线' },
  scatter: { id: 'scatter', name: '散射', type: 'beam',  power: 40, ep: 7, drain: 5, desc: '通用光线，削 EP' },
};

/* ---------------- 十六只怪 ---------------- */
const MONSTERS = {
  bemular: {
    id: 'bemular', name: '百慕拉', sub: '宇宙怪兽', type: 'cosmosBeast', typeName: '宇宙怪兽',
    hp: 110, atk: 75, def: 60, spd: 70, cost: 5,
    melee: { name: '俯身冲刺', power: 65, ep: 8, desc: '无明显效果' },
    beamM: { name: '苍蓝热射线', power: 70, ep: 12, desc: '无明显效果' },
    counterA: { name: '光球化', dodge: 62, ep: 5, vs: 'beam', orbSet: true, desc: '使用后，光球化冲撞必定先手' },
    counterB: { name: '水中适应能力', dodge: 38, guard: 0.25, ep: 5, vs: 'melee', lakeChance: 75, oceanOrb: true, desc: '在【海洋】地形时使用，自动衔接【光球化】，且是双方进入【龙森湖】' },
    ult: { name: '光球化冲撞', power: 260, ep: 28, acc: 75, orbFirst: true, ultType: 'melee', desc: '上回合光球化则先制' },
    field: { name: '宇宙逃犯', ep: 5, kind: 'cosmosBoost', value: 5, turns: 2, desc: '所有宇宙角色伤害 +5%，2 回合' },
    passive: { name: '潜航', kind: 'dodgeBoost', value: 25, desc: '闪避成功后，下一次攻击伤害 +25%' },
  },

  baltan: {
    id: 'baltan', name: '巴尔坦星人', sub: '宇宙忍者', type: 'cosmosMan', typeName: '宇宙人',
    hp: 95, atk: 70, def: 55, spd: 85, cost: 8,
    melee: { name: '巨钳攻击', power: 55, ep: 6, desc: '无明显效果' },
    beamM: { name: '赤色冷冻光束', power: 72, ep: 12, fx: 'slow', desc: '造成迟缓：敌方接下来两次行动必定慢于我方' },
    counterA: { name: '分身术', dodge: 72, ep: 5, vs: 'beam', givesDouble: true, useGives: 'double', desc: '使用后，获得【二重身】' },
    counterB: { name: '瞬间移动能力', dodge: 50, guard: 0.2, ep: 5, vs: 'melee', desc: '无明显效果' },
    ult: { name: '白色破坏光线', power: 230, ep: 26, acc: 82, doubleBonus: true, ultType: 'beam', desc: '拥有【二重身】时，本次伤害*2，且不消耗【二重身】' },
    field: { name: '高科技族群', ep: 7, kind: 'beamBoost', value: 10, turns: 2, desc: '场上光线技能伤害 +10%，2 回合' },
    passive: { name: '精神感应', kind: 'stackAtk', value: 2, max: 10, desc: '进场后每次命中永久 +2 攻 +2 血（上限 +10）' },
  },

  baltan2: {
    id: 'baltan2', name: '巴尔坦星人二世', sub: '宇宙忍者', type: 'cosmosMan', typeName: '宇宙人',
    hp: 105, atk: 82, def: 65, spd: 76, cost: 6,
    melee: { name: '冲刺钳击', power: 60, ep: 7, desc: '无明显效果' },
    beamM: { name: '重力风暴', power: 75, ep: 11, drain: 6, fx: 'noMelee2', desc: '造成击退：敌方无法使用格斗技能两回合' },
    counterA: { name: '光波屏障', dodge: 70, ep: 5, vs: 'beam', immuneUlt: '八分光轮', desc: '使用时，免疫【八分光轮】' },
    counterB: { name: '瞬间移动能力', dodge: 50, guard: 0.2, ep: 5, vs: 'melee', desc: '无明显效果' },
    ult: { name: '蓝色破坏闪光', power: 255, ep: 32, acc: 78, ultType: 'beam', desc: '无明显效果' },
    field: { name: '复仇的巴尔坦', ep: 6, kind: 'dodgeBoost', value: 10, turns: 3, desc: '我方全体闪避 +10%，3 回合' },
    passive: { name: '斯派修姆反射板', kind: 'dodgeNullify', desc: '闪避成功后，免疫下一次光线攻击' },
  },

  neronga: {
    id: 'neronga', name: '内隆嘎', sub: '透明怪兽', type: 'earthMonster', typeName: '地球怪兽',
    hp: 122, atk: 84, def: 70, spd: 55, cost: 6,
    melee: { name: '舍身冲撞', power: 58, ep: 6, desc: '无明显效果' },
    beamM: { name: '高压电击', power: 62, ep: 12, drain: 6, desc: '无明显效果' },
    counterA: { name: '透明化', dodge: 85, ep: 5, vs: 'beam', chargeDodge: 5, desc: '每一层【电流】 +5% 本技能的闪避率' },
    counterB: { name: '坚硬皮肤', dodge: 40, guard: 0.25, ep: 5, vs: 'melee', desc: '无明显效果' },
    ult: { name: '全身放电', power: 250, ep: 28, acc: 78, ultType: 'beam', desc: '无明显效果' },
    field: { name: '吸电力场', ep: 20, kind: 'chargeField', value: 3, turns: 99, desc: '我方光线技能命中后可为内隆嘎蓄力一层【电流】，满三层【电流】自动释放【全身放电】' },
    passive: { name: '吸电', kind: 'epAbsorb', value: 6, boost: 20, desc: '被光线命中 EP +6，下次高压电击/全身放电 +20%' },
  },

  ragon: {
    id: 'ragon', name: '拉贡', sub: '海底原人', type: 'earthMonster', typeName: '地球怪兽',
    hp: 110, atk: 88, def: 72, spd: 45, cost: 6,
    melee: { name: '怪力', power: 68, ep: 8, desc: '无明显效果' },
    beamM: { name: '放射性射线', power: 66, ep: 14, desc: '无明显效果' },
    counterA: { name: '侧身', dodge: 55, ep: 5, vs: 'beam', desc: '无明显效果' },
    counterB: { name: '粘液护体', dodge: 35, guard: 0.22, ep: 5, vs: 'melee', desc: '无明显效果' },
    ult: { name: '原子爆炸', power: 350, ep: 60, acc: 100, selfDestruct: true, twoPhase: true, oncePerBattle: true, desc: 'EP≥60：350 伤害，保留 1 HP，无视闪避，减伤 10%；EP<60：消耗全部 EP，威力降为 175，可闪避，减伤 20%，不保留 HP' },
    field: { name: '原始恐怖', ep: 10, kind: 'typeBoost', types: ['earthMonster'], value: 10, turns: 2, desc: '全体地球怪兽伤害 +10%，2 回合' },
    passive: { name: '自毁', kind: 'bombDiscount', value: 30, desc: 'HP ≤ 30% 时，原子爆炸 EP 60 → 30' },
  },

  greenmons: {
    id: 'greenmons', name: '绿蒙斯', sub: '巨大植物', type: 'earthMonster', typeName: '地球怪兽',
    hp: 105, atk: 72, def: 58, spd: 65, cost: 5,
    melee: { name: '巨叶重击', power: 52, ep: 6, desc: '无明显效果' },
    beamM: { name: '雾状麻醉液', power: 58, ep: 12, drain: 8, fx: 'stun', cooldown: 1, desc: '造成眩晕：接下来一回合无法行动，该技能使用后冷却一回合' },
    counterA: { name: '粘液', dodge: 60, ep: 5, vs: 'beam', desc: '无明显效果' },
    counterB: { name: '厚叶', dodge: 38, guard: 0.25, ep: 5, vs: 'melee', desc: '无明显效果' },
    ult: { name: '巨大化', power: 0, ep: 28, acc: 100, selfBuff: true, desc: '对自己使用：全属性 +25%，受光线伤害 +15%，2 回合' },
    field: { name: '毒雾领域', ep: 7, kind: 'poisonField', value: 2, heal: 5, turns: 3, desc: '敌方中毒（每回合 -2 HP），我方恩泽（每回合 +5 HP），3 回合' },
    passive: { name: '再生', kind: 'regenFlat', value: 5, desc: '每次受伤回复 5 HP' },
  },

  antlar: {
    id: 'antlar', name: '安东拉', sub: '磁力怪兽', type: 'earthMonster', typeName: '地球怪兽',
    hp: 130, atk: 90, def: 80, spd: 40, cost: 7,
    melee: { name: '巨颚', power: 72, ep: 8, fx: 'clamp', desc: '造成钳制两回合' },
    beamM: { name: '磁力光线', power: 60, ep: 14, pull: 2, desc: '造成【牵引】' },
    counterA: { name: '钻沙', dodge: 55, ep: 5, vs: 'beam', accUpMelee: 75, desc: '使用后，巨颚命中率提高 75%' },
    counterB: { name: '硬化', dodge: 30, guard: 0.3, ep: 5, vs: 'melee', desc: '无明显效果' },
    ult: { name: '砂尘暴', power: 230, ep: 30, acc: 74, autoField: '沙漠化', ultType: 'beam', desc: '使用时没有【沙漠化】领域，则先展开【沙漠化】领域，再使用大招' },
    field: { name: '沙漠化', ep: 8, kind: 'dodgeBoost', value: 15, turns: 3, desc: '展开沙漠地形，自身闪避 +15%，3 回合' },
    passive: { name: '砂岚', kind: 'fieldDodge', value: 12, desc: '场上存在【沙漠化】时，我方全队闪避 +12' },
  },

  redking: {
    id: 'redking', name: '雷德王', sub: '骷髅怪兽', type: 'earthMonster', typeName: '地球怪兽',
    hp: 140, atk: 105, def: 75, spd: 40, cost: 8,
    melee: { name: '铁拳', power: 70, ep: 8, desc: '无明显效果' },
    beamM: { name: '投石', power: 55, ep: 14, combo: 75, desc: '无明显效果' },
    counterA: { name: '咆哮', dodge: 40, ep: 5, vs: 'beam', roarAtk: 10, desc: '反制成功时，若对手是【怪兽】，则降低对手攻击力10%' },
    counterB: { name: '铁壁', dodge: 30, guard: 0.35, ep: 5, vs: 'melee', desc: '无明显效果' },
    ult: { name: '岩石崩落', power: 280, ep: 30, acc: 72, ultType: 'melee', desc: '无明显效果' },
    field: { name: '怪兽之王', ep: 10, kind: 'typeBoost', types: ['earthMonster', 'cosmosBeast', 'esper'], value: 10, turns: 3, desc: '攻击地球怪兽/宇宙怪兽/超能力怪兽伤害 +10%' },
    passive: { name: '蛮力', kind: 'rage', value: 15, hurt: 10, desc: '伤害 +15%，受伤 +10%' },
  },

  zarab: {
    id: 'zarab', name: '扎拉布星人', sub: '凶恶宇宙人', type: 'cosmosMan', typeName: '宇宙人',
    hp: 100, atk: 78, def: 60, spd: 75, cost: 6,
    melee: { name: '肘击', power: 56, ep: 6, desc: '无明显效果' },
    beamM: { name: '高频波', power: 64, ep: 12, drain: 6, desc: '无明显效果' },
    counterA: { name: '隐身', dodge: 45, ep: 5, vs: 'beam', desc: '无明显效果' },
    counterB: { name: '飞行', dodge: 68, guard: 0.2, ep: 5, vs: 'melee', desc: '无明显效果' },
    ult: { name: '催眠光线', power: 175, ep: 26, acc: 80, fx: 'confuse', chance: 65, ultType: 'beam', desc: '65% 使敌人混乱：下一次攻击目标为自身' },
    field: { name: '行星来的兄弟', ep: 13, kind: 'drainStats', value: 5, turns: 5, desc: '吸取两方宇宙角色 5% 攻防' },
    passive: { name: '外形拟态', kind: 'openClone', value: 50, desc: '开场化身假奥特曼（50% HP），致命伤时变回本体，溢出伤害打本体' },
  },

  jamila: {
    id: 'jamila', name: '贾米拉', sub: '栖星怪兽', type: 'cosmosBeast', typeName: '宇宙怪兽',
    hp: 115, atk: 85, def: 65, spd: 60, cost: 6,
    melee: { name: '重击', power: 62, ep: 7, desc: '无明显效果' },
    beamM: { name: '火焰喷射', power: 68, ep: 12, flameChance: 65, desc: '造成【火场】，对双方施加火焰' },
    counterA: { name: '躲避', dodge: 58, ep: 5, vs: 'beam', desc: '无明显效果' },
    counterB: { name: '硬抗', dodge: 35, guard: 0.36, ep: 5, vs: 'melee', desc: '无明显效果' },
    ult: { name: '死前嚎叫', power: 245, ep: 28, acc: 76, passive: true, onDeath: 245, desc: '被动：倒下时对场上敌人使用该技能' },
    field: { name: '我的故乡是地球', ep: 17, kind: 'dmgPerm', value: 10, desc: '持续到自身死亡，所有伤害 +10%' },
    passive: { name: '归乡', kind: 'speedGrow', value: 4, max: 16, desc: '每回合速度 +4（上限 +16）' },
  },

  gomora: {
    id: 'gomora', overlord: true, name: '哥莫拉', sub: '古代怪兽', type: 'earthMonster', typeName: '地球怪兽',
    hp: 130, atk: 88, def: 72, spd: 50, cost: 6,
    melee: { name: '角撞', power: 60, ep: 6, chain: '超振动波', chainChance: 65, desc: '65%概率，立刻衔接【超振动波】' },
    beamM: { name: '超振动波', power: 68, ep: 12, desc: '无明显效果' },
    counterA: { name: '挖地', dodge: 58, ep: 5, vs: 'beam', desc: '无明显效果' },
    counterB: { name: '铁壁', dodge: 38, guard: 0.32, ep: 5, vs: 'melee', desc: '无明显效果' },
    ult: { name: '甩尾攻击', power: 255, ep: 28, acc: 76, fx: 'down', downChance: 75, ultType: 'melee', desc: '75% 使敌人倒地，倒地后连锁追击，每次伤害减半、追击概率 -25%' },
    field: { name: '怪兽殿下', ep: 8, kind: 'secondWind', turns: 9, desc: '使用后，获得【二番战】，可以断尾失去大招，恢复50%HP' },
    passive: { name: '蓄能', kind: 'ultBoost', value: 15, desc: '光线命中后，下次必杀 +15%' },
  },

  mephilas: {
    id: 'mephilas', name: '美菲拉斯星人', sub: '恶劣宇宙人', type: 'cosmosMan', typeName: '宇宙人',
    hp: 120, atk: 92, def: 68, spd: 70, cost: 8,
    melee: { name: '抓投', power: 64, ep: 7, stunChance: 35, stunVs: ['cosmosMan', 'ultra'], desc: '对【宇宙人】、【奥特曼】时 35% 概率眩晕敌方' },
    beamM: { name: '简易抓握光线', power: 68, ep: 12, drain: 8, clashBonus: 5, desc: '对波时，增加5点伤害' },
    counterA: { name: '念力屏障', dodge: 62, ep: 5, vs: 'beam', desc: '无明显效果' },
    counterB: { name: '瞬间移动', dodge: 40, guard: 0.3, ep: 5, vs: 'melee', desc: '无明显效果' },
    ult: { name: '双手光线', power: 245, ep: 30, acc: 78, clashBonus: 10, ultType: 'beam', desc: '对波时，增加10点伤害' },
    field: { name: '恶魔游戏', ep: 21, kind: 'twist', turns: 2, desc: '双方获得游戏：扭转闪避/破姿态效果' },
    passive: { name: '操控人心', kind: 'switchBoost', value: 20, desc: '换人时，换上来的队友下一次伤害 +20%' },
  },

  zetton: {
    id: 'zetton', overlord: true, name: '杰顿', sub: '宇宙恐龙', type: 'cosmosBeast', typeName: '宇宙怪兽',
    hp: 135, atk: 95, def: 78, spd: 60, cost: 9,
    melee: { name: '怪力', power: 62, ep: 6, desc: '无明显效果' },
    beamM: { name: '一兆度火球', power: 85, ep: 14, desc: '无明显效果' },
    counterA: { name: '杰顿屏障', dodge: 70, ep: 5, vs: 'beam', reflectUlt: '八分光轮', desc: '反弹【八分光轮】' },
    counterB: { name: '瞬间移动', dodge: 42, guard: 0.4, ep: 5, vs: 'melee', desc: '无明显效果' },
    ult: { name: '杰顿终极光线', power: 300, ep: 32, acc: 80, ultType: 'beam', instaKillVs: 'ultraman', instaKillRate: 25, mustHitVs: '斯派修姆光线', desc: '击中【奥特曼】时，25% 概率直接致死；反击【斯派修姆光线】时，必定命中' },
    field: { name: '最终侵略兵器', ep: 17, kind: 'statBoost', value: 25, turns: 3, desc: '全属性 +25%，3 回合' },
    passive: { name: '光线吸收', kind: 'absorbJudge', threshold: 45, desc: '受光线伤害 <45 反击满威力，≥45 反击减半并冷却 2 回合' },
  },

  bullton: {
    id: 'bullton', overlord: true, name: '布鲁顿', sub: '四次元怪兽', type: 'esper', typeName: '超能力怪兽',
    hp: 100, atk: 67, def: 72, spd: 78, cost: 7,
    melee: { name: '奇异闪光', power: 55, ep: 4, fx: 'noMelee2', desc: '造成浮空两回合，无法释放格斗技' },
    beamM: { name: '四次元光线', power: 67, ep: 9, drain: 9, extWarp: true, cooldown: 1, desc: '延长一回合四次元扭曲，冷却一回合' },
    counterA: { name: '四次元屏障', dodge: 62, ep: 5, vs: 'beam', desc: '无明显效果' },
    counterB: { name: '超自然现象', dodge: 52, guard: 0.3, ep: 10, vs: 'melee', desc: '无明显效果' },
    ult: { name: '四次元狂想', power: 122, ep: 37, acc: 100, opensWarp: true, ultType: 'beam', desc: '命中后展开四次元扭曲 2 回合' },
    field: { name: '四次元生物', ep: 15, kind: 'alwaysHit', turns: 2, desc: '所有伤害技能必定命中，2 回合' },
    passive: { name: '四次元扭曲', kind: 'warp', value: 60, desc: '大招命中后展开 2 回合，全队受到 <60 伤害无效化' },
  },

  dada: {
    id: 'dada', name: '达达', sub: '三面怪人', type: 'cosmosMan', typeName: '宇宙人',
    hp: 96, atk: 65, def: 60, spd: 75, cost: 4,
    melee: { name: '背后偷袭', power: 45, ep: 4, desc: '使用隐身后，该技能命中率 +75%' },
    beamM: { name: '眼部射线', power: 60, ep: 10, drain: 2, desc: '无明显效果' },
    counterA: { name: '三面变化', dodge: 65, ep: 5, vs: 'beam', faces: true, desc: '随机获得 A/B/C 面相' },
    counterB: { name: '隐身', dodge: 70, guard: 0.25, ep: 5, vs: 'melee', desc: '无明显效果' },
    ult: { name: '微缩化枪', power: 150, ep: 30, acc: 75, appliesShrink: true, ultType: 'beam', desc: '命中后缩小化 2 回合' },
    field: { name: '人类标本', ep: 15, kind: 'shrinkLock', turns: 5, desc: '缩小化目标无法退场，死亡时恢复达达 5% HP' },
    passive: { name: '缩小化', kind: 'shrink', value: 25, desc: '大招命中后，对方攻防 -25%、受伤 +10%' },
  },

  geronimon: {
    id: 'geronimon', name: '杰罗尼蒙', sub: '怪兽酋长', type: 'esper', typeName: '超能力怪兽',
    hp: 148, atk: 78, def: 50, spd: 65, cost: 8,
    melee: { name: '毒羽箭', power: 75, ep: 8, fx: 'poison', desc: '造成神经中毒：每回合 -2 HP，3 回合' },
    beamM: { name: '反重力气体', power: 70, ep: 9, drain: 10, selfStun: true, desc: '被反制成功时，自身无法行动一回合' },
    counterA: { name: '羽箭防御', dodge: 60, ep: 5, vs: 'beam', desc: '无明显效果' },
    counterB: { name: '替死鬼', dodge: 0, guard: 0, ep: 10, vs: 'melee', borrowCounter: true, desc: '借用队友最高防的反制 B' },
    ult: { name: '羽箭风暴', power: 185, ep: 28, acc: 65, chase: '毒羽箭', chaseTable: [75, 45, 15], chasePower: [75, 50, 25], ultType: 'beam', desc: '造成伤害后 75%/45%/15% 连续追击一次 75%/50%/25% 的毒羽箭' },
    field: { name: '怪兽复活宣言', ep: 17, kind: 'extraRevive', turns: 99, desc: '我方队伍怪兽达到 3 个时，额外获得一次被动复活' },
    passive: { name: '怪兽复活', kind: 'revive', value: 75, fallbackHeal: true, desc: '每场一次，倒下时复活队友；无倒下队友时治疗血量最低的队友 75%，不能选自己' },
  },

  /* ---------------- 侵略地球模式专用敌人 ---------------- */
  vtolSmall: {
    id: 'vtolSmall', name: '小型威托', sub: '科特队战机', type: 'squad', typeName: '战队',
    hp: 55, atk: 48, def: 25, spd: 95, cost: 4,
    melee: { name: '机炮扫射', power: 30, ep: 3, desc: '无明显效果' },
    beamM: { name: '小型导弹', power: 45, ep: 6, desc: '无明显效果' },
    counterA: { name: '爬升', dodge: 55, ep: 4, vs: 'beam', desc: '无明显效果' },
    counterB: { name: '横滚', dodge: 45, guard: 0.15, ep: 4, vs: 'melee', desc: '无明显效果' },
    ult: { name: '全弹发射', power: 90, ep: 12, acc: 85, ultType: 'beam', desc: '无明显效果' },
    field: { name: '空中优势', ep: 6, kind: 'dodgeBoost', value: 8, turns: 2, desc: '闪避 +8，2 回合' },
    passive: { name: '高速机体', kind: 'none', desc: '速度极快' },
  },

  vtol: {
    id: 'vtol', name: '威托', sub: '科特队主力机', type: 'squad', typeName: '战队',
    hp: 110, atk: 65, def: 40, spd: 82, cost: 6,
    melee: { name: '机炮扫射', power: 38, ep: 4, desc: '无明显效果' },
    beamM: { name: '火星133', power: 62, ep: 8, vsBugs: 15, desc: '对【巴尔坦星人、巴尔坦星人二世】额外造成15%的伤害' },
    counterA: { name: '爬升', dodge: 50, ep: 4, vs: 'beam', desc: '无明显效果' },
    counterB: { name: '装甲规避', dodge: 35, guard: 0.25, ep: 5, vs: 'melee', desc: '无明显效果' },
    ult: { name: 'QX炮', power: 150, ep: 18, acc: 80, ultType: 'beam', bonus20: 65, desc: '65%概率造成额外20点伤害' },
    field: { name: '制空权', ep: 8, kind: 'beamBoost', value: 10, turns: 2, desc: '光线伤害 +10%，2 回合' },
    passive: { name: '重装机体', kind: 'none', desc: '火力更强' },
  },

  ultraman: {
    id: 'ultraman', name: '初代奥特曼', sub: '光之巨人', type: 'ultra', typeName: '奥特曼',
    hp: 220, atk: 98, def: 78, spd: 80, cost: 9,
    versusStats: { hp: 145, atk: 80, def: 62, spd: 78 },
    melee: { name: '奥特格斗', power: 88, ep: 6, desc: '光之巨人的体术' },
    beamM: { name: '斯派修姆光线', power: 130, ep: 16, desc: '对波成功额外 +10 差值' },
    counterA: { name: '奥特屏障', dodge: 58, ep: 5, vs: 'beam', desc: '反制成功后恢复 10 EP' },
    counterB: { name: '奥特防御', dodge: 40, guard: 0.3, ep: 5, vs: 'melee', desc: '硬吃格斗' },
    ult: { name: '八分光轮', power: 230, ep: 30, acc: 82, ultType: 'beam', desc: '65% 造成切割' },
    field: { name: '光之国使者', ep: 12, kind: 'statBoost', value: 15, turns: 3, desc: '我方全属性 +15%，3 回合' },
    passive: { name: '彩色计时器', kind: 'ultraTimer', desc: 'HP 低于 30% 时进入红区：攻击 +25%、受伤 +15%' },
    pool: [
      { name: '手刀', type: 'melee', power: 88, ep: 6, desc: '无明显效果' },
      { name: '拳击', type: 'melee', power: 78, ep: 5, desc: '无明显效果' },
      { name: '投技', type: 'melee', power: 70, ep: 7, counterMelee: true, desc: '对方使用的技能也是格斗类型时，本次技能必定命中，且75%连击一次' },
      { name: '切割光线', type: 'beam', power: 65, ep: 6, desc: '无明显效果' },
      { name: '捕捉光环', type: 'beam', power: 50, ep: 7, fx: 'noMelee', firstStrike: true, desc: '必定先手，禁格斗一回合（对杰顿无效）' },
      { name: '奥特念力', type: 'beam', power: 30, ep: 8, fx: 'noBeam', triggerMark: true, desc: '禁光线一回合；若对方带标记则引爆（结算奥特攻击光线的伤害）' },
      { name: '奥特屏障', type: 'stance', dodge: 58, ep: 5, vs: 'beam', epBack: 10, desc: '反制成功后恢复 10 EP' },
      { name: '光轮防御', type: 'stance', dodge: 68, ep: 15, vs: 'beam', counterUlt: '八分光轮', desc: '反制成功后释放八分光轮' },
      { name: '奥特V字屏障', type: 'stance', dodge: 40, guard: 0.1, ep: 8, vs: 'melee', desc: '使用时，有效降低10%光线伤害' },
      { name: '身体强度', type: 'stance', dodge: 38, guard: 0.2, ep: 2, vs: 'melee', immuneElectric: true, desc: '使用时，免疫电击伤害【如内隆嘎的光线技能，美菲拉斯星人的简易抓握光线】' },
      { name: '八分光轮', type: 'ult', power: 230, ep: 30, acc: 82, fx: 'cut', chance: 65, ultType: 'beam', desc: '65% 造成切割' },
      { name: '斯派修姆光线', type: 'ult', power: 200, ep: 25, acc: 86, ultType: 'beam', clashBonus: 10, desc: '对波成功额外 +10 差值' },
      { name: '奥特攻击光线', type: 'ult', power: 300, ep: 45, acc: 76, ultType: 'beam', markOnly: true, desc: '命中不造成伤害，只留下标记 3 回合；此期间用奥特念力命中可引爆，结算这招 300 威力' },
    ],
  },
};

const MON_ORDER = ['bemular', 'baltan', 'baltan2', 'neronga', 'ragon', 'greenmons', 'antlar',
  'redking', 'zarab', 'jamila', 'gomora', 'mephilas', 'zetton', 'bullton', 'dada', 'geronimon'];

const MUTEX = [['baltan', 'baltan2'], ['bullton', 'geronimon']];

/* ---------------- 羁绊 ---------------- */
const BONDS = [
  {
    id: 'cosmosAll', name: '宇宙人联盟', members: ['baltan', 'mephilas', 'zarab', 'baltan2'],
    need: 2, all: 5, desc: '全属性 +5%',
  },
  {
    id: 'steelFour', name: '钢魔四天王', members: ['zarab', 'mephilas', 'baltan2'],
    need: 3, all: 10, desc: '全属性 +10%',
  },
  {
    id: 'earthMon', name: '地球怪兽', members: ['ragon', 'greenmons', 'antlar', 'redking', 'gomora', 'geronimon'],
    need: 3, all: 15, desc: '全属性 +15%',
  },
  {
    id: 'duoKing', name: '怪兽双雄', members: ['redking', 'gomora'],
    need: 2, melee: 15, beam: 15, desc: '格斗与光线伤害 +15%',
  },
  {
    id: 'noHome', name: '没有故乡之人', members: ['jamila', 'baltan'],
    need: 2, takeLess: 10, desc: '受到伤害 -10%',
  },
  {
    id: 'zettonFoe', name: '奥特曼的强敌', members: ['zetton', 'bullton'],
    need: 2, def: 10, desc: '防御 +10%',
  },
  {
    id: 'dimension', name: '四次元来的挑战', members: ['bullton'],
    need: 1, takeLess: 15, desc: '受到生物/地底伤害 -15%',
  },
  {
    id: 'humanShield', name: '人类的后盾', members: ['ultraman', 'vtol', 'vtolSmall'],
    need: 3, squadDmg: 15, ultraAll: 10, desc: '战队伤害 +15%，奥特曼全属性 +10%',
  },
];

/* ---------------- 立绘 ---------------- */
const PALETTE = {
  cosmosMan: ['#2f5f95', '#7db6f0'],
  cosmosBeast: ['#5a3a8a', '#b090f0'],
  esper: ['#2a6a6a', '#90e0e0'],
  earthMonster: ['#6f7d63', '#c9d6b8'],
};

const PORTRAIT = {
  bemular:   'icon/百慕拉.png',
  baltan:    'icon/巴尔坦星人.png',
  baltan2:   'icon/巴尔坦星人二代.png',
  neronga:   'icon/内隆嘎.png',
  ragon:     'icon/拉贡.png',
  greenmons: 'icon/绿蒙斯.png',
  antlar:    'icon/安东拉.png',
  redking:   'icon/雷德王.png',
  zarab:     'icon/扎拉布星人.png',
  jamila:    'icon/贾米拉.png',
  gomora:    'icon/哥莫拉.png',
  mephilas:  'icon/美菲拉斯星人.png',
  zetton:    'icon/杰顿.png',
  bullton:   'icon/布鲁顿.png',
  geronimon: 'icon/杰罗尼蒙.png',
  ultraman:  'icon/奥特曼.png',
  vtolSmall: 'icon/小型威托.png',
  vtol:      'icon/威托.png',
};

const PORTRAIT_DADA = {
  A: 'icon/达达A.png',
  B: 'icon/达达B.png',
  C: 'icon/达达C.png',
};

function sprite(key, faces) {
  // 达达按当前面相切换
  if (key === 'dada') {
    const f = faces && PORTRAIT_DADA[faces] ? PORTRAIT_DADA[faces] : PORTRAIT_DADA.A;
    return `<img class="portrait-img" src="${encodeURI(f)}" alt="">`;
  }
  const src = PORTRAIT[key];
  if (src) return `<img class="portrait-img" src="${encodeURI(src)}" alt="">`;
  return '';
};
/* ---------------- 工具 ---------------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rnd = () => Math.random();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const $ = (sel) => document.querySelector(sel);

const SITES = {
  city: {
    name: '城市', icon: '🏙',
    desc: '战队命中 -15%，全体怪兽与宇宙人命中 +10%',
  },
  field: {
    name: '山野', icon: '🏔',
    desc: '地球怪兽伤害 +10%，战队命中 +25%',
  },
  ocean: {
    name: '海洋', icon: '🌊',
    desc: '超能力怪兽防御 +10%，百慕拉伤害 +15%，贾米拉生命削减到 25%',
  },
  space: {
    name: '宇宙', icon: '🌌',
    desc: '宇宙怪兽 / 宇宙人 / 奥特曼生命 +15%',
  },
};
const SITE_KEYS = ['city', 'field', 'ocean', 'space'];

const INVADE_STAGES = [
  ['vtolSmall', 'vtolSmall'],
  ['vtolSmall', 'vtolSmall', 'vtol'],
  ['ultraman'],
];
let gameMode = 'versus';
const UNLOCK_KEY = 'ultra_unlocked';
const BONUS_KEYS = ['vtolSmall', 'vtol', 'ultraman'];
function isUnlocked() {
  try { return localStorage.getItem(UNLOCK_KEY) === '1'; } catch (e) { return false; }
}
function unlockBonus() {
  try { localStorage.setItem(UNLOCK_KEY, '1'); } catch (e) { /* 忽略 */ }
}
function pickableKeys() {
  const base = MON_ORDER.slice();
  if (gameMode === 'invade') return base;
  return isUnlocked() ? [...base, ...BONUS_KEYS] : base;
}
let state = null;
let selected = [];
let loadout = {};
let expanded = null;

function freshStatus() {
  return {
    slow: 0,      // 迟缓：剩余次数
    stun: 0,      // 眩晕：剩余回合
    noMelee: 0,   // 击退/浮空：剩余回合
    confuse: false,
    poison: 0,    // 神经中毒：剩余回合
    clamp: 0,     // 钳制：剩余回合
    down: 0,      // 倒地：一次性
    lake: 0,      // 龙森湖：回合数，双方每回合 -2 EP
    flame: 0,     // 火焰：回合数，双方每回合 -2 HP
    double: 0,    // 二重身：回合数
    charge: 0,    // 蓄力层数
    pull: 0,      // 牵引：剩余回合，必定后手
    cut: 0,       // 切割：受到伤害 +10%
    noBeam: 0,    // 禁光线
    mark: 0,      // 奥特攻击光线标记
  };
}

function freshBuffs() {
  return {
    accUp: 0, ultBoost: 0, weaken: 0, regenOnHit: 0, speedUp: 0,
    copyAtk: 0, copyDef: 0, rage: 0, rageHurt: false,
    clone: null, absorb: false, absorbCd: 0, nullify: false, fieldAura: 0, shrink: 0,
    atkGain: 0, dmgBoost: 0, meleeAcc: 0, firstStrike: false, clashSpent: false, clashUsed: false,
    cooldowns: {}, noRegen: false, forceSlow: false, slowNext: false,
  };
}

function monPool(key) {
  const d = MONSTERS[key];
  if (!d) return [];
  if (d.pool) {
    return d.pool.map((x, i) => ({ ...x, id: key + ':p' + i, slot: 'sig' }));
  }
  const list = [];
  for (const c of Object.values(COMMON)) list.push({ ...c, slot: 'common', id: c.id });
  list.push({ ...d.melee, type: 'melee', slot: 'sig', id: key + ':melee' });
  list.push({ ...d.beamM, type: 'beam', slot: 'sig', id: key + ':beam' });
  list.push({ ...d.counterA, type: 'stance', slot: 'sig', id: key + ':cA' });
  list.push({ ...d.counterB, type: 'stance', slot: 'sig', id: key + ':cB' });
  list.push({ ...d.ult, type: d.ult.passive ? 'passive' : 'ult', slot: 'sp', id: key + ':ult' });
  list.push({ ...d.field, type: 'field', slot: 'sp', id: key + ':field' });
  return list;
}

function defaultLoadout(key) {
  const d = MONSTERS[key];
  if (d && d.pool) {
    // 默认：手刀 / 斯派修姆光线 / 奥特屏障 / 八分光轮
    return [key + ':p0', key + ':p11', key + ':p6', key + ':p10'];
  }
  return [key + ':melee', key + ':beam', key + ':cA', key + ':ult'];
}

function makeMon(key) {
  const d = MONSTERS[key];
  const ids = loadout[key] || defaultLoadout(key);
  const pool = monPool(key);
  const moves = (d.pool && gameMode === 'invade')
    ? d.pool.map((x) => ({ ...x }))
    : ids.map((id) => pool.find((m) => m.id === id)).filter(Boolean);
  const vs = (d.versusStats && gameMode !== 'invade') ? d.versusStats : null;
  const base = vs
    ? { hp: vs.hp, atk: vs.atk, def: vs.def, spd: vs.spd }
    : { hp: d.hp, atk: d.atk, def: d.def, spd: d.spd };
  const m = {
    key, name: d.name, sub: d.sub, type: d.type, typeName: d.typeName,
    overlord: !!d.overlord,
    maxHp: base.hp, hp: base.hp, atk: base.atk, def: base.def, spd: base.spd, cost: d.cost,
    ep: EP_START, moves,
    counterBonus: 0, orbReady: false,
    status: freshStatus(), buffs: freshBuffs(),
    passive: d.passive, passiveBonus: 1,
    deathSaved: false, nullified: false, cloneUses: 0,
    faces: null,
  };
  return m;
}

const hpPct = (m) => m.hp / m.maxHp;
const teamSpeed = (S) => S.team.reduce((a, m) => a + (m.hp > 0 ? m.spd : 0), 0);
const inRedZone = () => state.timer <= 3;

const statMul = (m) => 1 + (m.buffs.statMul || 0) / 100;
const effAtk = (m) => Math.round((m.atk + (m.buffs.copyAtk || 0) + (m.buffs.atkGain || 0)) * (m.buffs.shrink ? 0.75 : 1) * statMul(m));
const effDef = (m) => Math.round((m.def + (m.buffs.copyDef || 0)) * (m.buffs.shrink ? 0.75 : 1) * statMul(m));
const effSpd = (m) => Math.round((m.spd + (m.buffs.speedUp || 0)) * statMul(m));

const canUse = (m, move) => {
  if (move.passive) return false;
  if (m.ep < (move.ep || 0)) return false;
  if (move.type === 'melee' && m.status.noMelee > 0) return false;
  if (move.type === 'beam' && m.status.noBeam > 0) return false;
  if (move.oncePerBattle && m.bombUsed) return false;
  return true;
};

function log(text, cls) {
  if (!state) return;
  state.log.push({ text, cls: cls || '' });
  if (state.log.length > 180) state.log.shift();
  renderLog();
}

/* ---------------- 羁绊结算 ---------------- */
function applyBonds(team) {
  const keys = team.map((m) => m.key);
  const active = [];
  for (const b of BONDS) {
    const hit = b.members.filter((k) => keys.includes(k)).length;
    if (hit >= b.need) active.push(b);
  }
  let allPct = 0, defPct = 0, squadDmg = 0, ultraAll = 0;
  for (const b of active) {
    allPct += b.all || 0;
    defPct += b.def || 0;
    squadDmg += b.squadDmg || 0;
    ultraAll += b.ultraAll || 0;
  }
  for (const m of team) {
    let mul = 1 + allPct / 100;
    // 人类的后盾：奥特曼全属性 +10%
    if (ultraAll && m.type === 'ultra') mul += ultraAll / 100;
    m.maxHp = Math.round(m.maxHp * mul);
    m.hp = Math.round(m.hp * mul);
    m.atk = Math.round(m.atk * mul);
    m.def = Math.round(m.def * (mul + defPct / 100));
    m.spd = Math.round(m.spd * mul);
    // 人类的后盾：战队伤害 +15%
    if (squadDmg && m.type === 'squad') m.buffs.dmgBoost = squadDmg;
  }
  return active;
}

/* ---------------- 开局 ---------------- */
function startGame(playerKeys, enemyTeamKeys, mode) {
  gameMode = mode || 'versus';
  const teamP = playerKeys.map((k) => makeMon(k));
  const enemyKeys = enemyTeamKeys && enemyTeamKeys.length
    ? enemyTeamKeys
    : (gameMode === 'invade' ? INVADE_STAGES[0] : pickEnemyTeam());
  const teamE = enemyKeys.map((k) => makeMon(k));
  const bondsP = applyBonds(teamP);
  const bondsE = applyBonds(teamE);

  const siteKey = SITE_KEYS[Math.floor(rnd() * SITE_KEYS.length)];
  const site = SITES[siteKey];
  state = {
    site: siteKey,
    siteName: site.name,
    player: { team: teamP, active: 0, switches: MAX_SWITCH, bonds: bondsP },
    enemy: { team: teamE, active: 0, switches: MAX_SWITCH, bonds: bondsE },
    mode: gameMode, stage: 1, turn: 1, timer: MAX_TIMER, busy: false, over: false, winner: null,
    log: [], field: null, warp: null,
    playerHistory: [], enemyHistory: [],
    pendingSwitch: null,
  };

  // 扎拉布开场化形
  for (const S of [state.player, state.enemy]) {
    for (const m of S.team) {
      if (m.passive?.kind === 'openClone') startClone(m);
    }
  }

  $('#modeSelect').hidden = true;
  $('#dex').hidden = true;
  $('#pick').hidden = true;
  $('#battle').hidden = false;
  $('#banner').hidden = true;
  if (document.body) document.body.classList.add('in-battle');
  $('#log').innerHTML = '';

  applySiteEffects(siteKey);
  log('战斗开始', 'sys');
  log(`${site.icon} 场地：${site.name}　${site.desc}`, 'sys');
  log(`你：${teamP.map((m) => m.name).join(' / ')}`, 'dim');
  log(`敌：${teamE.map((m) => m.name).join(' / ')}`, 'dim');
  if (bondsP.length) log(`我方羁绊：${bondsP.map((b) => `${b.name}(${b.desc})`).join('、')}`, 'sys');
  if (bondsE.length) log(`敌方羁绊：${bondsE.map((b) => b.name).join('、')}`, 'sys');
  log(`计时器 ${MAX_TIMER} 回合，到点比队伍总血量。`, 'dim');

  render();
  playIntro();
}

/* 开场动画：角色卡轮流出现 + 战斗开始横幅 */
function playIntro() {
  const enemyCard = $('#enemyCard');
  const playerCard = $('#playerCard');
  const actions = $('#actions');
  const optBox = $('#optionBox');

  const hide = (el) => { if (el && el.classList) { el.classList.add('intro-hidden'); el.classList.remove('intro-in'); } };
  const show = (el) => {
    if (!el || !el.classList) return;
    el.classList.remove('intro-hidden');
    el.classList.add('intro-in');
  };

  state.busy = true;
  hide(enemyCard);
  hide(playerCard);
  if (actions) { actions.innerHTML = ''; }
  if (optBox) { optBox.innerHTML = ''; }

  setTimeout(() => {
    show(enemyCard);
    if (state) playMonCry(state.enemy.team[state.enemy.active].key);
  }, 300);

  setTimeout(() => {
    show(playerCard);
    if (state) playMonCry(state.player.team[state.player.active].key);
  }, 1500);

  setTimeout(() => {
    showTurnBanner('战斗开始');
  }, 2800);

  setTimeout(() => {
    if (!state) return;
    state.busy = false;
    render();
    renderActions();
  }, 3600);
}

const BASIC_MOVES = [
  { ...COMMON.swift, type: 'melee' },
  { ...COMMON.iron, type: 'melee' },
  { ...COMMON.beam, type: 'beam' },
  { ...COMMON.scatter, type: 'beam' },
];

function startClone(m) {
  m.buffs.clone = {
    maxHp: m.maxHp, hp: m.hp, atk: m.atk, def: m.def, spd: m.spd, moves: m.moves,
  };
  const r = m.passive.value / 100;
  m.maxHp = Math.round(m.maxHp * r);
  m.hp = m.maxHp;
  // 假奥特曼防御比本体低
  m.def = Math.round(m.def * 0.6);
  // 假奥特曼只有基础技能
  m.moves = BASIC_MOVES.map((x) => ({ ...x }));
}

function applySiteEffects(siteKey) {
  for (const S of [state.player, state.enemy]) {
    for (const m of S.team) {
      // 宇宙：宇宙怪兽 / 宇宙人 / 奥特曼 生命 +15%
      if (siteKey === 'space' && ['cosmosBeast', 'cosmosMan', 'ultra'].includes(m.type)) {
        m.maxHp = Math.round(m.maxHp * 1.15);
        m.hp = m.maxHp;
      }
      // 海洋：超能力怪兽 防御 +10%
      if (siteKey === 'ocean' && m.type === 'esper') {
        m.def = Math.round(m.def * 1.1);
      }
      // 海洋：贾米拉生命削减到 25%
      if (siteKey === 'ocean' && m.key === 'jamila') {
        m.maxHp = Math.max(1, Math.round(m.maxHp * 0.25));
        m.hp = m.maxHp;
      }
    }
  }
}

/* 场地对「命中」的修正（百分比，正为提升） */
function siteAccMod(m) {
  const site = state?.site;
  if (site === 'city') {
    if (m.type === 'squad') return -15;
    if (m.type === 'cosmosMan' || m.type === 'cosmosBeast' || m.type === 'esper' || m.type === 'earthMonster') return 10;
  }
  if (site === 'field' && m.type === 'squad') return 25;
  return 0;
}

/* 场地对「伤害」的修正（百分比） */
function siteDmgMod(m) {
  const site = state?.site;
  if (site === 'field' && m.type === 'earthMonster') return 10;
  if (site === 'ocean' && m.key === 'bemular') return 15;
  return 0;
}

function pickEnemyTeam() {
  const pool = MON_ORDER.slice();
  const team = [];
  let budget = TEAM_COST;
  while (team.length < 3 && pool.length) {
    const i = Math.floor(rnd() * pool.length);
    const key = pool.splice(i, 1)[0];
    const c = MONSTERS[key].cost;
    if (c <= budget) { team.push(key); budget -= c; }
  }
  return team;
}

/* ---------------- 伤害 ---------------- */
function rollHit(att, def, move, defMove) {
  const defType = defMove.type;
  const ab = att.buffs;
  const db = def.buffs;
  let dodge = 0, guard = 0, mult = 1;
  let dualBreak = false;
  let note = '';

  // 必中（布鲁顿领域）
  const alwaysHit = state && state.field && state.field.kind === 'alwaysHit';

  if (move.type === 'beam' && db.nullify) {
    return { dmg: 0, kind: 'nullify', note: '反射板无效化' };
  }
  // 巴尔坦二世：光波屏障 45% 无效光线
  if (move.type === 'beam' && defMove.shieldLight && rnd() * 100 < defMove.shieldLight) {
    def.buffs.nullify = false;
    return { dmg: 0, kind: 'nullify', note: '光波屏障无效化' };
  }
  if (move.type === 'beam' && def.passive?.kind === 'dodgeNullify' && def.buffs.nullify) {
    def.buffs.nullify = false;
    return { dmg: 0, kind: 'nullify', note: '反射板免疫光线' };
  }

  // 杰顿终极光线：反击斯派修姆光线时必定命中
  const mustHit = move.mustHitVs && defMove && defMove.name === move.mustHitVs;
  if (move.type === 'ult' && !move.selfDestruct) {
    const acc = (move.acc || 100) + (effSpd(att) - effSpd(def)) * 0.4
      + (move.type === 'melee' ? ab.meleeAcc : 0) + siteAccMod(att);
    if (!alwaysHit && !mustHit && rnd() * 100 > acc) return { dmg: 0, kind: 'miss', note: '必杀落空' };
  }
  if (mustHit) log('　杰顿锁定斯派修姆光线 —— 必定命中', 'sys');

  // 杰顿屏障：完全反弹八分光轮
  if (defMove.reflectUlt && move.name === defMove.reflectUlt) {
    const back = move.power * (effAtk(def) / effDef(att)) * 0.16 + 2;
    log('　杰顿屏障 —— 八分光轮被原样弹回！', 'sys');
    return { dmg: 0, kind: 'reflect', note: '屏障反弹', reflectDmg: Math.round(back) };
  }

  if (defType === 'stance') {
    if (move.type === 'ult') {
      guard = defMove.vs === 'beam' ? COUNTER_A_GUARD : (defMove.guard || 0);
      note = '反制挡下';
    } else if (defMove.borrowCounter) {
      const side = state.player.team.includes(def) ? state.player : state.enemy;
      const best = side.team.filter((m) => m !== def && m.hp > 0).sort((a, b) => b.def - a.def)[0];
      const bc = best ? best.moves.find((m) => m.type === 'stance' && m.vs === 'melee') : null;
      if (bc) { dodge = bc.dodge; guard = bc.guard; note = `替死鬼（借 ${best.name}）`; }
    } else {
      const same = (move.type === 'melee' && defMove.vs === 'melee')
        || (move.type === 'beam' && defMove.vs === 'beam');
      if (same) {
        dodge = defMove.dodge || 0;
        // 反制 A 默认有 12% 减伤（防御不及也能挡一点）
        guard = defMove.guard || (defMove.vs === 'beam' ? 0.12 : 0);
        note = '被反制';
      } else {
        mult = BREAK;
        note = '破姿态';
      }
    }
  } else if (defType === 'melee' || defType === 'beam') {
    if (move.type !== defType && effSpd(att) > effSpd(def)) {
      mult = BREAK;
      note = '破姿态（先手压制）';
      dualBreak = true;
    }
  }

  if (move.selfDestruct && !move.canDodge) dodge = 0;
  if (alwaysHit) dodge = 0;

  // 美菲拉斯·恶魔游戏：我方被闪避 → 扭转必中
  const attSide = state.player.team.includes(att) ? state.player : state.enemy;
  const defSideRef = state.player.team.includes(def) ? state.player : state.enemy;
  if (state.field?.kind === 'twist' && state.field.owner === attSide && dodge > 0) {
    dodge = 0;
    note = '游戏扭转（必中）';
  }

  if (defMove.chargeDodge && def.status.charge > 0) {
    dodge = Math.min(95, dodge + def.status.charge * defMove.chargeDodge);
  }
  if (def.buffs.fieldAura && state.field && state.field.name === '沙漠化') {
    dodge = Math.min(95, dodge + def.buffs.fieldAura);
  }
  const defSide = state.player.team.includes(def) ? state.player : state.enemy;
  const antlar = defSide.team[defSide.active];
  if (antlar?.passive?.kind === 'fieldDodge' && state.field?.name === '沙漠化') {
    dodge = Math.min(95, dodge + antlar.passive.value);
  }

  // 命中加成统一穿透闪避（正数 = 降低对方闪避）
  const accMod = siteAccMod(att) + (att.buffs.accUp || 0);
  if (accMod) dodge = Math.max(0, dodge - accMod);

  // 奥特曼·投技：对方出格斗技时必定命中
  const foeIsMelee = defMove && defMove.type === 'melee';
  const throwMustHit = move.counterMelee && foeIsMelee;

  if (!throwMustHit && dodge > 0 && rnd() * 100 < dodge) {
    return { dmg: 0, kind: 'dodge', note };
  }

  let dmg = move.power * (effAtk(att) / effDef(def)) * 0.16 + 2;
  dmg *= mult;
  dmg *= typeMult(att, def);
  if (att.counterBonus) dmg *= att.counterBonus;
  if (def.buffs.shrink) dmg *= 1.1;
  if (def.status.cut > 0) dmg *= 1.1;
  if (move.electric && defMove.immuneElectric) dmg = 0;
  if (att.passive?.kind === 'rage') dmg *= 1 + att.passive.value / 100;
  // 奥特曼彩色计时器：红区时攻防变化
  if (att.passive?.kind === 'ultraTimer' && hpPct(att) < 0.3) dmg *= 1.25;
  if (def.passive?.kind === 'ultraTimer' && hpPct(def) < 0.3) dmg *= 1.15;
  if (def.passive?.kind === 'rage') dmg *= 1 + def.passive.hurt / 100;
  if (att.passiveBonus > 1) dmg *= att.passiveBonus;
  if (ab.dmgBoost) dmg *= 1 + ab.dmgBoost / 100;
  // 威托·火星133：对巴尔坦 +15%
  if (move.vsBugs && (def.key === 'baltan' || def.key === 'baltan2')) dmg *= 1 + move.vsBugs / 100;
  // 威托·QX炮：65% 额外 +20
  if (move.bonus20 && rnd() * 100 < move.bonus20) {
    dmg += 20;
    log('　QX炮命中要害，额外 +20 伤害', 'hit');
  }
  if (fieldBoost(att, move)) dmg *= 1 + fieldBoost(att, move) / 100;
  // 贾米拉：我的故乡是地球
  if (state.field?.kind === 'dmgPerm' && state.field.owner === attSide) dmg *= 1.1;
  // 美菲拉斯：被破姿态时伤害减半
  if (state.field?.kind === 'twist' && state.field.owner === defSideRef && mult === BREAK) {
    dmg *= 0.5;
  }
  if (ab.ultBoost && move.type === 'ult') dmg *= 1 + ab.ultBoost / 100;
  // 巴尔坦：拥有二重身时大招伤害翻倍
  if (move.doubleBonus && att.status.double > 0) dmg *= 2;

  // 对波加成：只有对方也出光线时才生效
  const foeIsBeam = defMove && (defMove.type === 'beam' || (defMove.type === 'ult' && defMove.ultType === 'beam'));
  if (move.clashBonus && foeIsBeam) dmg += move.clashBonus;
  if (db.weaken) dmg *= 1 - db.weaken / 100;
  let guardVal = guard;
  if (move.guardFactor) guardVal *= move.guardFactor;
  if (guardVal > 0) dmg *= 1 - guardVal;
  // 双攻时慢的一方：破姿态伤害打八五折，避免被白打死
  if (dualBreak) dmg *= 0.85;
  if (inRedZone()) dmg *= 1.2;
  dmg *= 0.9 + rnd() * 0.2;
  const sdm = siteDmgMod(att);
  if (sdm) dmg *= 1 + sdm / 100;

  // 二重身：受到超过当前血量一半的伤害时，65% 消耗替身免伤
  if (def.status.double > 0 && dmg > def.hp / 2 && rnd() * 100 < 65) {
    def.status.double = 0;
    return { dmg: 0, kind: 'dodge', note: '二重身替身' };
  }

  let absorbJudge = 0;
  if (move.type === 'beam' && def.passive?.kind === 'absorbJudge') {
    absorbJudge = Math.round(move.power * (effAtk(att) / effDef(def)) * 0.16 + 2);
  }

  // 杰顿终极光线：击中奥特曼 25% 直接致死
  if (move.instaKillVs && def.key === move.instaKillVs && rnd() * 100 < (move.instaKillRate || 0)) {
    log(`　${def.name} 被杰顿终极光线贯穿 —— 直接倒下`, 'sys');
    return { dmg: def.hp, kind: 'hit', note: '一击必杀', lethal: true };
  }

  return { dmg: Math.max(1, Math.round(dmg)), kind: 'hit', note, judge: absorbJudge };
}

function fieldBoost(att, move) {
  const f = state.field;
  if (!f) return 0;
  if (f.kind === 'cosmosBoost' && (att.type === 'cosmosMan' || att.type === 'cosmosBeast')) return f.value;
  if (f.kind === 'beamBoost' && move.type === 'beam') return f.value;
  if (f.kind === 'typeBoost' && f.types.includes(att.type)) return f.value;
  return 0;
}

/* ---------------- 一回合 ---------------- */
async function playTurn(action) {
  if (!state || state.busy || state.over) return;
  state.busy = true;
  renderActions();

  const P = state.player;
  const E = state.enemy;
  const pMon = P.team[P.active];
  const eMon = E.team[E.active];

  // 眩晕：只让中招方无法行动，对方照常出手
  const pStunned = pMon.status.stun > 0;
  if (pStunned) {
    pMon.status.stun--;
    log(`你 · ${pMon.name} 眩晕中，这回合无法行动`, 'dim');
  }

  const eAction = aiChoose(E, P);
  recordHistory(state.playerHistory, action);
  recordHistory(state.enemyHistory, eAction);

  log(`── 第 ${state.turn} 回合 ──`, 'turn');
  showTurnBanner(state.turn);


  const pFastSwitch = action.kind === 'switch' && teamSpeed(P) > teamSpeed(E);

  // 换人次数用尽：直接当成跳过处理
  if (action.kind === 'switch' && P.switches <= 0) {
    log('换人次数已用尽，本回合按跳过处理', 'dim');
    action = { kind: 'skip' };
  }

  if (action.kind === 'switch') {
    const oldMon = P.team[P.active];
    // 主动换人解除假奥特曼状态
    if (oldMon.buffs.clone) {
      reviveClone(oldMon);
      log(`　${oldMon.name} 解除拟态，变回本体`, 'sys');
    }
    // 达达·人类标本：被缩小化的目标无法主动退场
    if (state.field?.kind === 'shrinkLock' && state.field.owner === E && oldMon.buffs.shrink > 0) {
      log('缩小化锁定，你无法换下这只', 'dim');
      state.busy = false;
      state.pendingSwitch = null;
      render();
      renderActions();
      return;
    }
    P.switches--;
    P.active = action.next;
    if (oldMon.passive?.kind === 'switchBoost') {
      P.team[P.active].buffs.dmgBoost = oldMon.passive.value;
      log(`　操控人心：${P.team[P.active].name} 下一次伤害 +${oldMon.passive.value}%`, 'ep');
    }
    log(`你换上 ${P.team[P.active].name}`, 'act');
    playMonCry(P.team[P.active].key);
  }
  if (eAction.kind === 'switch') {
    E.switches--;
    E.active = eAction.next;
    log(`对手换上 ${E.team[E.active].name}`, 'act');
    playMonCry(E.team[E.active].key);
  }

  if (action.kind === 'skip') {
    P.team[P.active].ep = clamp(P.team[P.active].ep + 5, 0, EP_MAX);
    log('你跳过了这回合，EP +5', 'ep');
  }

  render();
  await sleep(320);

  const pNow = P.team[P.active];
  const eNow = E.team[E.active];

  // 敌方眩晕判定（放在出手计算之前）
  const eStunned = eNow.status.stun > 0;
  if (eStunned) {
    eNow.status.stun--;
    log(`对手 · ${eNow.name} 眩晕中，这回合无法行动`, 'dim');
  }

  let pMustDefend = action.kind === 'switch' && !pFastSwitch;

  const pMove = pStunned ? null
    : (action.kind === 'move' ? action.move
      : action.kind === 'switch' && action.follow ? action.follow : null);
  const eMove = eStunned ? null
    : (eAction.kind === 'move' ? eAction.move
      : eAction.kind === 'switch' && eAction.follow ? eAction.follow : null);



  // 击退/浮空：格斗技失效
  const pMeleeBlocked = pMove?.type === 'melee' && pNow.status.noMelee > 0;
  const eMeleeBlocked = eMove?.type === 'melee' && eNow.status.noMelee > 0;
  if (pMeleeBlocked) log(`你 · ${pNow.name} 被压制，格斗技无法使用`, 'dim');
  if (eMeleeBlocked) log(`对手 · ${eNow.name} 被压制，格斗技无法使用`, 'dim');

  const pOrb = pMove && pMove.orbFirst && pNow.orbReady;
  const eOrb = eMove && eMove.orbFirst && eNow.orbReady;

  // 对波：双方都出光线，且双方都还没用掉对波机会
  const clashAllowed = !(pNow.buffs.clashUsed && eNow.buffs.clashUsed);
  if (clashAllowed
      && action.kind === 'move' && eAction.kind === 'move'
      && isBeamMove(pMove) && isBeamMove(eMove)
      && !pMeleeBlocked && !eMeleeBlocked) {
    await resolveClash(P, E, pMove, eMove);
    await endTurnOnly(P, E);
    return;
  }

  const order = [];
  if (pMove && !pMeleeBlocked) order.push({ side: 'p', move: pMove });
  if (eMove && !eMeleeBlocked) order.push({ side: 'e', move: eMove });

  if (order.length === 2) {
    let pFirst;
    if (pOrb && !eOrb) pFirst = true;
    else if (eOrb && !pOrb) pFirst = false;
    else if (pNow.buffs.firstStrike) pFirst = true;
    else if (eNow.buffs.firstStrike) pFirst = false;
    else if (state.field?.kind === 'firstStrike' && state.field.owner === P) pFirst = true;
    else if (state.field?.kind === 'firstStrike' && state.field.owner === E) pFirst = false;
    else if (pNow.buffs.slowNext || pNow.status.slow > 0) { pFirst = false; pNow.buffs.slowNext = false; }
    else if (eNow.buffs.slowNext || eNow.status.slow > 0) { pFirst = true; eNow.buffs.slowNext = false; }
    else if (action.kind === 'switch' && pFastSwitch) pFirst = false;
    else if (eAction.kind === 'switch') pFirst = true;
    else pFirst = effSpd(pNow) > effSpd(eNow) || (effSpd(pNow) === effSpd(eNow) && rnd() < 0.5);
    order.sort((a, b) => {
      const ra = a.side === 'p' ? (pFirst ? 0 : 1) : (pFirst ? 1 : 0);
      const rb = b.side === 'p' ? (pFirst ? 0 : 1) : (pFirst ? 1 : 0);
      return ra - rb;
    });
  }

  const pStart = P.active;
  const eStart = E.active;

  for (const step of order) {
    if (state.over) break;
    if (step.side === 'p') {
      if (pMustDefend && step.move.type !== 'stance') continue;
      await execMove(P, E, step.move, eMove, pStart);
    } else {
      await execMove(E, P, step.move, pMove, eStart);
    }
    render();
    await sleep(240);
  }

  await endTurnOnly(P, E);
}

async function tickCooldowns(P, E) {
  for (const side of [P, E]) {
    for (const m of side.team) {
      if (!m.buffs.cooldowns) continue;
      for (const k of Object.keys(m.buffs.cooldowns)) {
        if (m.buffs.cooldowns[k] > 0) m.buffs.cooldowns[k] -= 1;
        if (m.buffs.cooldowns[k] <= 0) delete m.buffs.cooldowns[k];
      }
    }
  }
}

function endTurnOnly(P, E) {
  tickCooldowns(P, E);
  if (!state.over) {
    endOfTurn();
    checkOver();
  }
  if (!state.over) state.turn++;
  state.busy = false;
  state.pendingSwitch = null;
  render();
  renderActions();
}

function recordHistory(arr, action) {
  const t = action && action.kind === 'move' ? action.move.type
    : action && action.kind === 'skip' ? 'skip' : 'switch';
  arr.push(t);
  if (arr.length > 6) arr.shift();
}

/* ---------------- 对波 ---------------- */
const isBeamMove = (m) => m && (m.type === 'beam' || (m.type === 'ult' && m.ultType === 'beam'));

async function resolveClash(P, E, pMove, eMove) {
  const pMon = P.team[P.active];
  const eMon = E.team[E.active];

  log('双方同时放出光线 —— 对波！', 'sys');

  const pBaseCost = pMove.ep || 0;
  const eBaseCost = eMove.ep || 0;
  pMon.ep = Math.max(0, pMon.ep - pBaseCost);
  eMon.ep = Math.max(0, eMon.ep - eBaseCost);

  const pRes = rollHit(pMon, eMon, pMove, eMove);
  const eRes = rollHit(eMon, pMon, eMove, pMove);
  const D1 = pRes.dmg;
  const D2 = eRes.dmg;

  // 任一方落空 → 不进入对波，按普通命中结算
  if (D1 === 0 || D2 === 0) {
    const missed = D1 === 0 && D2 === 0 ? 'both' : (D1 === 0 ? 'p' : 'e');
    log('　有人落空，对波未成立', 'dim');
    if (D1 > 0 && eMon.hp > 0) {
      eMon.hp = Math.max(0, eMon.hp - D1);
      log(`　${pMon.name} 命中，${eMon.name} -${D1} HP`, 'hit');
      floatText('enemy', '-' + D1, 'dmg');
    }
    if (D2 > 0 && pMon.hp > 0) {
      pMon.hp = Math.max(0, pMon.hp - D2);
      log(`　${eMon.name} 命中，${pMon.name} -${D2} HP`, 'hit');
      floatText('player', '-' + D2, 'dmg');
    }
    render();
    await sleep(350);
    checkOver();
    return;
  }

  const pWin = D1 >= D2;
  const diff1 = Math.abs(D1 - D2);
  const winnerDmg1 = Math.max(D1, D2);
  const loserIsP = !pWin;
  const loser0 = pWin ? eMon : pMon;
  const winner0 = pWin ? pMon : eMon;

  log(`　你 ${D1}　对　敌 ${D2}　差值 ${diff1}`, 'act');

  /* 对波机会：每个角色每场只有一次 */
  const canUseChance = (m) => !m.buffs.clashUsed;

  let totalLoserDmg = diff1;
  let finalLoserIsP = loserIsP;
  let tags = [];

  /* ---------- 输家的选择 ---------- */
  let loserChoice = 'tank';
  if (canUseChance(loser0)) {
    const hasCounter = (loser0.moves || []).some((m) => m.type === 'stance' && m.vs === 'beam');
    const counterMove = (loser0.moves || []).find((m) => m.type === 'stance' && m.vs === 'beam');
    const canEmergency = hasCounter && counterMove && loser0.ep >= (counterMove.ep || 0);
    const canAllIn = loser0.ep > 0;
    if (loserIsP) {
      loserChoice = await askClashChoice(diff1, false, {
        emergency: canEmergency,
        allin: canAllIn,
        spend: false,
      });
    } else {
      // AI 决策
      const hpPctNow = loser0.hp / loser0.maxHp;
      const lethal = diff1 >= loser0.hp;
      if (canEmergency && (lethal || hpPctNow < 0.35)) {
        loserChoice = rnd() < 0.7 ? 'emergency' : 'tank';
      } else if (canAllIn && lethal && rnd() < 0.35) {
        loserChoice = 'allin';
      } else {
        loserChoice = 'tank';
      }
    }
  }

  /* ---------- 处理三种选择 ---------- */
  let allInBoost = 0;

  if (loserChoice === 'emergency') {
    const cm = (loser0.moves || []).find((m) => m.type === 'stance' && m.vs === 'beam');
    if (cm && loser0.ep >= (cm.ep || 0)) {
      loser0.ep = Math.max(0, loser0.ep - (cm.ep || 0));
      loser0.buffs.clashUsed = true;
      const dodge = cm.dodge || 50;
      if (rnd() * 100 < dodge) {
        totalLoserDmg = Math.round(diff1 / 2);
        tags.push(`应急 ${cm.name} 闪避成功，伤害减半`);
      } else {
        const guard = cm.guard || 0.12;
        totalLoserDmg = Math.round(diff1 * (1 - guard));
        tags.push(`应急 ${cm.name} 闪避失败，减伤 ${Math.round(guard * 100)}%`);
      }
    }
  } else if (loserChoice === 'allin') {
    const spend = loser0.ep;
    loser0.ep = 0;
    loser0.buffs.clashUsed = true;
    loser0.buffs.noRegen = true;
    loser0.buffs.forceSlow = true;
    allInBoost = 1 + spend / 100;
    tags.push(`全力！投入 ${spend} EP，伤害 ×${allInBoost.toFixed(2)}`);
  }

  /* ---------- 赢家的追加 ---------- */
  let winnerSpend = false;
  if (winner0.buffs && !winner0.buffs.clashUsed) {
    const canSpend = winner0.ep >= (pWin ? pBaseCost : eBaseCost) && allInBoost === 0;
    if (canSpend) {
      if (!loserIsP) {
        // 玩家是赢家
        winnerSpend = (await askClashChoice(diff1, true, { spend: true, emergency: false, allin: false })) === 'spend';
      } else {
        // AI 是赢家
        const worth = diff1 >= Math.max(15, Math.round(winnerDmg1 * 0.35));
        winnerSpend = worth ? rnd() < 0.6 : rnd() < 0.2;
      }
    }
    if (winnerSpend) {
      winner0.ep = Math.max(0, winner0.ep - (pWin ? pBaseCost : eBaseCost));
      winner0.buffs.clashUsed = true;
    }
  }

  /* ---------- 计算第二次差值 ---------- */
  let diff2 = 0;
  if (allInBoost > 0) {
    // 输家全力：自己伤害放大后重新比较
    const newLoserDmg = Math.round((pWin ? D2 : D1) * allInBoost);
    const winnerD = pWin ? D1 : D2;
    diff2 = Math.abs(winnerD - newLoserDmg);
    if (newLoserDmg > winnerD) {
      finalLoserIsP = pWin;
      tags.push('全力翻盘！');
    }
    totalLoserDmg = diff1 + diff2;
  } else if (winnerSpend) {
    // 赢家追加：多产生一次伤害
    diff2 = winnerDmg1;
    totalLoserDmg = diff1 + diff2;
    tags.push('赢家追加，追加伤害');
  }

  const loserMon = finalLoserIsP ? pMon : eMon;
  const winnerMon = finalLoserIsP ? eMon : pMon;

  loserMon.hp = Math.max(0, loserMon.hp - totalLoserDmg);
  log(`　${loserMon.name} 吃下 ${totalLoserDmg} 伤害${tags.length ? '（' + tags.join('；') + '）' : ''}`, 'hit');
  flash(finalLoserIsP ? 'player' : 'enemy');
  floatText(finalLoserIsP ? 'player' : 'enemy', '-' + totalLoserDmg, 'dmg');

  /* 赢家回 EP */
  if (winnerSpend) {
    const base = finalLoserIsP ? eBaseCost : pBaseCost;
    const refund = Math.floor(base / 2);
    if (refund > 0) {
      winnerMon.ep = clamp(winnerMon.ep + refund, 0, EP_MAX);
      log(`　${winnerMon.name} 对波胜出，回复 ${refund} EP`, 'ep');
    }
  }

  if (pMove.orbFirst) pMon.orbReady = false;
  if (eMove.orbFirst) eMon.orbReady = false;

  render();
  await sleep(400);
  checkOver();
}

function askClashChoice(diff, isWinner, opts) {
  return new Promise((resolve) => {
    if (!document.body) {
      // 测试环境：输家默认硬吃，赢家默认不追加
      resolve(isWinner ? 'pass' : 'tank');
      return;
    }
    state.clash = { diff, isWinner, opts, resolve };
    renderClash();
  });
}

function renderClash() {
  const box = $('#clashBox');
  if (!box) return;
  const c = state.clash;
  if (!c) { box.hidden = true; box.innerHTML = ''; return; }
  box.hidden = false;

  const isLoser = !c.isWinner;
  const btns = [];

  if (isLoser) {
    btns.push(`<button id="clashTank" type="button">硬吃（${c.diff} 伤害）</button>`);
    if (c.opts.emergency) {
      btns.push(`<button id="clashEmg" type="button">应急（展开反制，闪避成功减半）</button>`);
    }
    if (c.opts.allin) {
      btns.push(`<button id="clashAllin" class="danger" type="button">全力（耗尽全部 EP，伤害 ×2，下回合瘫痪）</button>`);
    }
  } else {
    if (c.opts.spend) {
      btns.push(`<button id="clashSpend" type="button">追加 EP（多打一次伤害）</button>`);
    }
    btns.push(`<button id="clashPass" type="button">见好就收</button>`);
  }

  box.innerHTML = `
    <div class="clash-title">对波判定</div>
    <div class="clash-diff">差值 ${c.diff}　${c.isWinner ? '你是赢家' : '你是输家'}</div>
    <div class="clash-btns">${btns.join('')}</div>
  `;

  const pick = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', () => {
      const r = c.resolve;
      state.clash = null;
      renderClash();
      r(val);
    });
  };
  pick('clashTank', 'tank');
  pick('clashEmg', 'emergency');
  pick('clashAllin', 'allin');
  pick('clashSpend', 'spend');
  pick('clashPass', 'pass');
}

/* ---------------- 单个技能 ---------------- */
async function execMove(S, T, move, foeMove, activeAtStart) {
  if (state.over) return;
  const sideName = S === state.player ? '你' : '敌';
  if (S.active !== activeAtStart) {
    log(`　${S.team[S.active].name} 刚上场，来不及出手`, 'dim');
    return;
  }
  const att = S.team[S.active];
  const def = T.team[T.active];
  if (att.hp <= 0) return;
  if (move.passive) return;

  // 拉贡原子爆炸：两段式
  if (move.twoPhase) {
    const rich = att.ep >= 60;
    if (rich) {
      move = { ...move, keepHp: 1, guardFactor: 0.1, canDodge: false };
    } else {
      move = { ...move, power: 175, keepHp: 0, guardFactor: 0.2, canDodge: true, allEp: true };
      log(`　EP 不足 60，威力降为 175`, 'dim');
    }
  }

  // 安东拉：砂尘暴自动展开沙漠化
  if (move.autoField && (!state.field || state.field.name !== move.autoField)) {
    state.field = { name: '沙漠化', kind: 'dodgeBoost', value: 15, turns: 3, owner: S, charges: 0, drained: null };
    log('　自动展开沙漠化', 'sys');
  }

  let cost = move.ep || 0;
  if (move.allEp) cost = att.ep;
  if (move.selfDestruct && att.passive?.kind === 'bombDiscount' && hpPct(att) <= 0.3) {
    cost = Math.max(0, cost - att.passive.value);
  }
  // 冷却检查
  const cdKey = move.name;
  if (att.buffs.cooldowns && att.buffs.cooldowns[cdKey] > 0) {
    log(`${sideName} · ${att.name} 的 ${move.name} 冷却中（剩 ${att.buffs.cooldowns[cdKey]} 回合）`, 'dim');
    return;
  }

  if (att.ep < cost) {
    att.ep = clamp(att.ep + 10, 0, EP_MAX);
    log(`${sideName} · ${att.name} EP 不足，只能蓄能`, 'ep');
    return;
  }
  att.ep = Math.max(0, att.ep - cost);

  // 带冷却的技能：使用时立刻登记
  if (move.cooldown) {
    att.buffs.cooldowns[cdKey] = move.cooldown;
  }

  if (move.type === 'stance') {
    log(`${sideName} · ${att.name} 使用 ${move.name}`, 'act');
    // 巴尔坦·分身术：使用即获得二重身
    if (move.useGives === 'double' && att.status.double <= 0) {
      att.status.double = 3;
      log(`　${att.name} 分出二重身（3 回合）`, 'ep');
    }
    // 百慕拉·水中适应能力：海洋地形自动衔接光球化
    if (move.oceanOrb && state.site === 'ocean') {
      att.orbReady = true;
      log(`　${att.name} 潜入水中 —— 光球化待发`, 'ep');
    }
    if (move.orbSet) { att.orbReady = true; log(`　蓄势待发，下一手冲撞先制`, 'ep'); }
    if (move.faces) applyFace(att);
    if (move.accUpMelee) {
      att.buffs.meleeAcc = move.accUpMelee;
      log(`　巨颚命中率 +${move.accUpMelee}%`, 'ep');
    }
    render();
    return;
  }

  if (move.type === 'field') {
    // 哥莫拉·怪兽殿下：获得二番战机会
    if (move.kind === 'secondWind') {
      att.buffs.secondWind = true;
      log(`　${att.name} 藏起尾巴 —— 获得【二番战】`, 'ep');
    }
    const f = {
      name: move.name, kind: move.kind, value: move.value,
      types: move.types, turns: move.turns, owner: S,
      charges: 0, drained: null,
    };
    // 扎拉布：吸取双方宇宙角色 5% 攻防
    if (move.kind === 'drainStats') {
      const drained = [];
      for (const side of [state.player, state.enemy]) {
        for (const mm of side.team) {
          if (mm.hp > 0 && mm.type === 'cosmosMan' && mm !== att) {
            const da = Math.round(mm.atk * move.value / 100);
            const dd = Math.round(mm.def * move.value / 100);
            mm.atk -= da; mm.def -= dd;
            att.atk += da; att.def += dd;
            drained.push({ mon: mm, atk: da, def: dd });
          }
        }
      }
      f.drained = drained;
      log(`　吸取 ${drained.length} 名宇宙角色的攻防`, 'ep');
    }
    // 杰罗尼蒙：队伍生物/地底 ≥3 时，额外一次复活
    if (move.kind === 'extraRevive') {
      const count = S.team.filter((mm) => mm.type !== 'cosmosMan').length;
      if (count >= 3) {
        S.extraRevive = true;
        log(`　额外复活效果生效（生物/地底 ${count} 只）`, 'ep');
      } else {
        log(`　生物/地底只有 ${count} 只，不触发额外复活`, 'dim');
      }
    }
    // 全属性领域：给全队加倍率
    if (move.kind === 'statBoost') {
      for (const mm of S.team) mm.buffs.statMul = move.value;
      log(`　我方全队全属性 +${move.value}%`, 'ep');
    }
    state.field = f;
    log(`${sideName} · ${att.name} 展开 ${move.name}`, 'sys');
    log(`　${move.desc}`, 'dim');
    render();
    await sleep(240);
    return;
  }

  log(`${sideName} · ${att.name} 使用 ${move.name}`, 'act');
  // 大招音效：只有奥特曼有专属音效
  if (move.type === 'ult' && att.key === 'ultraman') {
    playSfx(SFX_MISC.spesium, VOL.ult);
  }
  render();
  await sleep(180);

  const res = rollHit(att, def, move, foeMove || { type: 'none' });

  // 杰顿屏障：把八分光轮原样弹回去
  if (res.kind === 'reflect') {
    const back = res.reflectDmg || 0;
    att.hp = Math.max(0, att.hp - back);
    log(`　屏障反弹！${att.name} 自己吃下 ${back} 伤害`, 'hit');
    floatText(S === state.player ? 'player' : 'enemy', '-' + back, 'dmg');
    flash(S === state.player ? 'player' : 'enemy');
    render();
    await sleep(300);
    checkOver();
    return;
  }

  if (res.kind === 'miss') { log(`　${res.note}`, 'miss'); return; }
  if (res.kind === 'nullify') { def.buffs.nullify = false; log(`　${res.note}`, 'miss'); return; }
  if (res.kind === 'dodge') {
    log(`　${def.name} 闪过这一击`, 'miss');
    floatText(S === state.player ? 'player' : 'enemy', 'MISS', 'miss');
    if (foeMove && foeMove.type === 'stance') {
      def.counterBonus = 1.3;
      log(`　${def.name} 抓住机会，下一手 ×1.3`, 'ep');
    }
    if (def.passive?.kind === 'dodgeBoost') {
      def.passiveBonus = 1 + def.passive.value / 100;
    }
    if (def.passive?.kind === 'dodgeNullify') {
      def.buffs.nullify = true;
      log(`　${def.name} 反射板待发`, 'ep');
    }
    if (foeMove?.givesDouble && def.status.double <= 0) {
      def.status.double = 3;
      log(`　${def.name} 获得二重身（3 回合）`, 'ep');
    }
    // 雷德王·咆哮：反制成功时若对手是怪兽，降攻 10%
    if (foeMove?.roarAtk && ['earthMonster', 'cosmosBeast', 'esper'].includes(att.type)) {
      const cut = Math.max(1, Math.round(att.atk * (foeMove.roarAtk / 100)));
      att.atk = Math.max(10, att.atk - cut);
      log(`　${def.name} 咆哮震慑，${att.name} 攻击 -10%`, 'sys');
    }
    if (foeMove?.epBack) {
      def.ep = clamp(def.ep + foeMove.epBack, 0, EP_MAX);
      log(`　${def.name} 恢复 ${foeMove.epBack} EP`, 'ep');
    }
    if (foeMove?.counterUlt) {
      const cu = def.moves.find((mm) => mm.name === foeMove.counterUlt)
        || MONSTERS[def.key]?.pool?.find((mm) => mm.name === foeMove.counterUlt)
        || { name: foeMove.counterUlt, type: 'ult', power: 230, acc: 82 };
      if (cu) {
        const r2 = rollHit(def, att, cu, { type: 'melee' });
        if (r2.kind === 'hit') {
          att.hp = Math.max(0, att.hp - r2.dmg);
          log(`　${def.name} 反手 ${cu.name}！${att.name} -${r2.dmg} HP`, 'hit');
          flash(S === state.player ? 'player' : 'enemy');
        }
      }
    }
    return;
  }

  // 混乱：打自己
  let target = def;
  if (att.status.confuse) {
    att.status.confuse = false;
    target = att;
    log(`　${att.name} 陷入混乱，攻击了自己`, 'sys');
  }

  // 四次元扭曲
  if (state.warp && state.warp.owner === T && res.dmg < state.warp.value && target === def) {
    log(`　四次元扭曲：${res.dmg} 点伤害被无效化`, 'miss');
    return;
  }

  // 奥特攻击光线：命中不造成伤害，只留标记
  if (move.markOnly) {
    target.status.mark = 3;
    log(`　${target.name} 被标记（3 回合）`, 'sys');
    return;
  }

  // 反制挡下必杀：同样触发反制的后续效果
  if (res.note === '反制挡下' && foeMove) {
    if (foeMove.epBack) {
      def.ep = clamp(def.ep + foeMove.epBack, 0, EP_MAX);
      log(`　${def.name} 反制成功，恢复 ${foeMove.epBack} EP`, 'ep');
    }
    if (foeMove.counterUlt) {
      const cu = def.moves.find((mm) => mm.name === foeMove.counterUlt)
        || MONSTERS[def.key]?.pool?.find((mm) => mm.name === foeMove.counterUlt)
        || { name: foeMove.counterUlt, type: 'ult', power: 230, acc: 82 };
      if (cu) {
        const r2 = rollHit(def, att, cu, { type: 'melee' });
        if (r2.kind === 'hit') {
          att.hp = Math.max(0, att.hp - r2.dmg);
          log(`　${def.name} 反手 ${cu.name}！${att.name} -${r2.dmg} HP`, 'hit');
          flash(S === state.player ? 'player' : 'enemy');
          floatText(S === state.player ? 'player' : 'enemy', '-' + r2.dmg, 'dmg');
        }
      }
    }
  }

  const hpBefore = target.hp;
  target.hp = Math.max(0, target.hp - res.dmg);
  log(`　${target.name} -${res.dmg} HP　${res.note}`, 'hit');
  const tSide = T === state.player ? 'player' : 'enemy';
  flash(tSide);
  floatText(tSide, '-' + res.dmg, res.note && res.note.includes('破姿态') ? 'crit' : 'dmg');

  // 四次元光线：延长扭曲
  if (move.extWarp && state.warp) {
    state.warp.turns += 1;
    log('　四次元扭曲延长 1 回合', 'sys');
  }

  // 布鲁顿：大招命中后展开四次元扭曲
  if (move.opensWarp && target === def) {
    state.warp = { owner: S, turns: 2, value: 60 };
    log('　展开四次元扭曲（2 回合，全队受到 <60 伤害无效化）', 'sys');
  }

  // 羽箭风暴：连锁追击毒羽箭（威力 75%/50%/25% 递减）
  if (move.chase && target === def && target.hp > 0) {
    const table = move.chaseTable || [75, 45, 15];
    const powTable = move.chasePower || [75, 50, 25];
    for (let ci = 0; ci < table.length; ci++) {
      if (rnd() * 100 >= table[ci]) break;
      const cp = powTable[ci] || powTable[powTable.length - 1];
      const d2 = Math.max(1, Math.round(cp * (effAtk(att) / effDef(target)) * 0.16 + 2));
      target.hp = Math.max(0, target.hp - d2);
      log(`　追击 ${move.chase}！${target.name} -${d2} HP`, 'hit');
      if (target.hp <= 0) break;
    }
  }

  // 奥特曼·投技：对方出格斗时 75% 连击一次
  if (move.counterMelee && target === def && target.hp > 0 && foeMove && foeMove.type === 'melee') {
    if (rnd() * 100 < 75) {
      const d3 = Math.max(1, Math.round(move.power * 0.7 * (effAtk(att) / effDef(target)) * 0.16 + 2));
      target.hp = Math.max(0, target.hp - d3);
      log(`　投技连击！${target.name} - ${d3} HP`, 'hit');
    }
  }

  // 哥莫拉·角撞：65% 立刻衔接超振动波
  if (move.chain && target === def && target.hp > 0 && rnd() * 100 < (move.chainChance || 65)) {
    const chainMove = att.moves.find((mm) => mm.name === move.chain)
      || MONSTERS[att.key]?.pool?.find((mm) => mm.name === move.chain)
      || { name: move.chain, power: 70, type: 'beam' };
    const cd = Math.max(1, Math.round(chainMove.power * (effAtk(att) / effDef(target)) * 0.16 + 2));
    target.hp = Math.max(0, target.hp - cd);
    log(`　${move.chain} 立刻跟上！${target.name} -${cd} HP`, 'hit');
  }

  // 技能效果
  if (move.triggerMark && target.status.mark > 0) {
    // 标记只能来自【奥特攻击光线】，引爆时结算它那 300 威力
    target.status.mark = 0;
    const MARK_POWER = 300;
    const boom = Math.max(1, Math.round(MARK_POWER * (effAtk(att) / effDef(target)) * 0.16 + 2));
    target.hp = Math.max(0, target.hp - boom);
    log(`　标记被引爆！${target.name} -${boom} HP（奥特攻击光线结算）`, 'sys');
  }
  // 美菲拉斯抓投：对宇宙人/奥特曼 35% 眩晕
  if (move.stunChance && target === def && move.stunVs && move.stunVs.includes(target.type)) {
    if (rnd() * 100 < move.stunChance) {
      target.status.stun = 1;
      log(`　${target.name} 被摔晕，下回合无法行动`, 'sys');
    }
  }

  if (move.fx && target === def) applyFx(target, move, att);

  // 龙森湖 / 火焰：双方
  if (foeMove?.lakeChance && rnd() * 100 < foeMove.lakeChance) {
    att.status.lake = 2;
    def.status.lake = 2;
    log('　龙森湖泛起（双方 2 回合，每回合 -2 EP）', 'sys');
  }
  if (move.flameChance && rnd() * 100 < move.flameChance) {
    att.status.flame = 3;
    def.status.flame = 3;
    log('　火焰蔓延（双方 3 回合，每回合 -2 HP）', 'sys');
  }
  // 牵引：目标必定后手
  if (move.pull && target === def) {
    target.status.pull = move.pull;
    log(`　${target.name} 被牵引（${move.pull} 回合必定后手）`, 'sys');
  }
  // 连击
  if (move.combo && target === def && target.hp > 0 && rnd() * 100 < move.combo) {
    const extra = Math.max(1, Math.round(move.power * (effAtk(att) / effDef(target)) * 0.16 + 2));
    target.hp = Math.max(0, target.hp - extra);
    log(`　投石连击！${target.name} -${extra} HP`, 'hit');
  }

  // 格斗回 EP
  if (move.type === 'melee') {
    const gain = 5 + Math.floor(rnd() * 4);
    att.ep = clamp(att.ep + gain, 0, EP_MAX);
    log(`　${att.name} 格斗回复 ${gain} EP`, 'ep');
  }

  // 内隆嘎·吸电力场：命中蓄力
  if (state.field?.kind === 'chargeField' && state.field.owner === S) {
    const neronga = S.team.find((mm) => mm.key === 'neronga');
    if (neronga) {
      neronga.status.charge = (neronga.status.charge || 0) + 1;
    }
    state.field.charges = neronga ? neronga.status.charge : state.field.charges + 1;
    if (state.field.charges >= 3) {
      state.field.charges = 0;
      if (neronga) neronga.status.charge = 0;
      if (neronga) {
        const foe = T.team[T.active];
        const extraDmg = Math.max(1, Math.round(250 * (effAtk(neronga) / effDef(foe)) * 0.16 + 2));
        foe.hp = Math.max(0, foe.hp - extraDmg);
        log(`　吸电力场蓄满！${neronga.name} 自动全身放电，${foe.name} -${extraDmg} HP`, 'sys');
        flash(T === state.player ? 'player' : 'enemy');
      }
    } else {
      log(`　吸电力场蓄力 ${state.field.charges}/3`, 'ep');
    }
  }

  // 被动命中
  if (att.passive?.kind === 'stackAtk') {
    att.buffs.atkGain = Math.min((att.buffs.atkGain || 0) + att.passive.value, att.passive.max);
    att.hp = Math.min(att.maxHp, att.hp + att.passive.value);
  }
  if (att.passive?.kind === 'ultBoost' && move.type === 'beam') {
    att.buffs.ultBoost = att.passive.value;
  }

  // 防守方被动
  if (target.passive?.kind === 'epAbsorb' && move.type === 'beam') {
    target.ep = clamp(target.ep + target.passive.value, 0, EP_MAX);
    target.buffs.ultBoost = target.passive.boost;
    log(`　${target.name} 吸电：EP +${target.passive.value}，下一发 +${target.passive.boost}%`, 'ep');
  }
  if (target.passive?.kind === 'regenFlat') {
    target.hp = Math.min(target.maxHp, target.hp + target.passive.value);
  } else if (target.passive?.kind === 'regen' || target.passive?.kind === 'regenSplit') {
    const rate = target.passive.kind === 'regen'
      ? target.passive.value
      : (move.type === 'melee' ? target.passive.melee : target.passive.beam);
    const heal = Math.round(res.dmg * rate / 100);
    target.hp = Math.min(target.maxHp, target.hp + heal);
  }
  if (target.passive?.kind === 'absorbJudge' && move.type === 'beam' && (target.buffs.absorbCd || 0) <= 0) {
    const backUlt = target.moves.find((m) => m.type === 'ult')
      || MONSTERS[target.key]?.ult
      || { power: 300, name: '杰顿终极光线' };
    if (backUlt) {
      let back = backUlt.power;
      if (res.judge >= target.passive.threshold) {
        back = Math.round(back * 0.5);
        target.buffs.absorbCd = 2;
        log('　光线吸收冷却 2 回合', 'dim');
      }
      const dmg2 = Math.max(1, Math.round(back * (effAtk(target) / effDef(att)) * 0.16 + 2));
      att.hp = Math.max(0, att.hp - dmg2);
      log(`　${target.name} 吸收光线，返击 ${dmg2} 伤害`, 'hit');
    }
  }
  if (target.hp <= 0 && target.passive?.kind === 'openClone' && target.buffs.clone) {
    const overflow = res.dmg - hpBefore;
    reviveClone(target);
    if (overflow > 0) {
      target.hp = Math.max(0, target.hp - overflow);
      log(`　假奥特曼被击穿，溢出 ${overflow} 伤害打到本体`, 'sys');
    }
  }

  // 缩小化
  if (move.appliesShrink && att.passive?.kind === 'shrink') {
    target.buffs.shrink = 3;
    log(`　${target.name} 被缩小化`, 'sys');
  }

  // 倒地连锁追击
  if (target.status.down > 0 && target.hp > 0) {
    target.status.down = 0;
    let chance = 75;
    let dmgBase = move.power;
    let chain = 0;
    while (target.hp > 0 && chain < 3) {
      dmgBase *= 0.5;
      const extra = Math.max(1, Math.round(dmgBase * (effAtk(att) / effDef(target)) * 0.16 + 2));
      target.hp = Math.max(0, target.hp - extra);
      log(`　倒地追击 ${chain + 1} -${extra} HP`, 'hit');
      chain++;
      chance -= 25;
      if (chance <= 0) break;
      if (rnd() * 100 >= chance) break;
      log(`　${target.name} 再次倒地`, 'sys');
    }
  }

  // 一次性大招标记
  if (move.oncePerBattle) att.bombUsed = true;

  // 自爆
  if (move.selfDestruct) {
    if (move.keepHp) {
      att.hp = Math.min(att.hp, move.keepHp);
      log(`　${att.name} 自爆，被冲击力压到 ${att.hp} HP`, 'sys');
    } else {
      att.hp = 0;
      log(`　${att.name} 自爆了`, 'sys');
    }
  }

  // 清理
  if (move.type !== 'stance') {
    att.counterBonus = 0;
    att.passiveBonus = 1;
    att.buffs.dmgBoost = 0;
    att.buffs.accUp = 0;
    att.buffs.meleeAcc = 0;
  }
  if (move.orbFirst) att.orbReady = false;

  render();
  await sleep(120);
  checkOver();
}

function applyFace(att) {
  const r = rnd();
  if (r < 0.34) { att.faces = 'A'; att.buffs.dodgeA = 15; }
  else if (r < 0.67) { att.faces = 'B'; att.buffs.counterB = true; }
  else { att.faces = 'C'; att.buffs.guardC = 0.05; }
  log(`　${att.name} 变身 ${att.faces} 面相`, 'ep');
  const faceSrc = SFX_DADA_FACE[att.faces];
  if (faceSrc) playSfx(faceSrc, VOL.cry);
}

function applyFx(target, move, att) {
  switch (move.fx) {
    case 'slow':
      target.status.slow = 2;
      log(`　${target.name} 迟缓（2 次）`, 'sys');
      break;
    case 'stun':
      target.status.stun = 1;
      log(`　${target.name} 眩晕`, 'sys');
      break;
    case 'noMelee':
      if (move.name === '捕捉光环' && target.key === 'zetton') {
        log('　杰顿免疫了捕捉光环', 'dim');
        break;
      }
      target.status.noMelee = 1;
      log(`　${target.name} 无法使用格斗技术（1 回合）`, 'sys');
      break;
    case 'noMelee2':
      if (move.name === '捕捉光环' && target.key === 'zetton') {
        log('　杰顿免疫了捕捉光环', 'dim');
        break;
      }
      if (rnd() * 100 < 50) {
        target.status.noMelee = 1;
        log(`　${target.name} 无法使用格斗技（1 回合）`, 'sys');
      } else {
        log('　压制没有生效', 'dim');
      }
      break;
    case 'confuse':
      if (rnd() * 100 < (move.chance || 35)) {
        target.status.confuse = true;
        log(`　${target.name} 混乱`, 'sys');
      } else {
        log('　混乱没有生效', 'dim');
      }
      break;
    case 'poison':
      target.status.poison = 3;
      log(`　${target.name} 神经中毒（3 回合）`, 'sys');
      break;
    case 'clamp':
      target.status.clamp = 2;
      log(`　${target.name} 被钳制`, 'sys');
      break;
    case 'cut':
      if (rnd() * 100 < (move.chance || 65)) {
        target.status.cut = 2;
        log(`　${target.name} 被切割（受伤 +10%）`, 'sys');
      }
      break;
    case 'noBeam':
      target.status.noBeam = 1;
      log(`　${target.name} 无法使用光线（1 回合）`, 'sys');
      break;
    case 'down':
      if (rnd() * 100 < (move.downChance || 75)) {
        target.status.down = 1;
        log(`　${target.name} 倒地`, 'sys');
      }
      break;
  }
}

// 复活不会重置 bombUsed（原子爆炸每场一次）
function reviveClone(m) {
  const c = m.buffs.clone;
  m.maxHp = c.maxHp;
  m.hp = Math.max(1, c.hp);
  m.atk = c.atk;
  m.def = c.def;
  m.spd = c.spd;
  if (c.moves) m.moves = c.moves;
  m.buffs.clone = null;
  log(`　${m.name} 的假奥特曼倒下，变回本体`, 'sys');
}

/* ---------------- 回合结束 ---------------- */
function endOfTurn() {
  const P = state.player;
  const E = state.enemy;

  for (const S of [P, E]) {
    const m = S.team[S.active];
    if (!m || m.hp <= 0) continue;
    // 全力对波后：本回合不回 EP
    if (m.buffs.noRegen) {
      m.buffs.noRegen = false;
      log(`${m.name} 全力对波后未回复 EP`, 'dim');
    } else {
      m.ep = clamp(m.ep + EP_REGEN, 0, EP_MAX);
    }
    // 全力对波后：下回合必定后手
    if (m.buffs.forceSlow) {
      m.buffs.slowNext = true;
      m.buffs.forceSlow = false;
    }
    if (m.buffs.absorbCd > 0) m.buffs.absorbCd--;
    if (m.buffs.shrink > 0) m.buffs.shrink--;
    if (m.status.noMelee > 0) m.status.noMelee--;
    if (m.status.clamp > 0) m.status.clamp--;
    if (m.status.slow > 0) m.status.slow--;
    if (m.status.poison > 0) {
      m.status.poison--;
      m.hp = Math.max(0, m.hp - 2);
      log(`${m.name} 神经中毒 -2 HP`, 'dim');
    }
    if (m.status.lake > 0) {
      m.status.lake--;
      m.ep = Math.max(0, m.ep - 2);
      log(`${m.name} 龙森湖 -2 EP`, 'dim');
    }
    if (m.status.flame > 0) {
      m.status.flame--;
      m.hp = Math.max(0, m.hp - 2);
      log(`${m.name} 火焰灼烧 -2 HP`, 'dim');
    }
    if (m.status.double > 0) m.status.double--;
    if (m.status.pull > 0) m.status.pull--;
    if (m.status.cut > 0) m.status.cut--;
    if (m.status.noBeam > 0) m.status.noBeam--;
    if (m.status.mark > 0) m.status.mark--;
    if (m.passive?.kind === 'speedGrow') {
      m.buffs.speedUp = Math.min((m.buffs.speedUp || 0) + m.passive.value, m.passive.max);
    }
    m.buffs.firstStrike = false;
  }

  if (state.field) {
    // 永久领域不递减
    if (state.field.kind !== 'dmgPerm' && state.field.kind !== 'chargeField' && state.field.kind !== 'extraRevive') {
      state.field.turns--;
    }
    if (state.field.kind === 'poisonAll') {
      for (const S of [P, E]) {
        const m = S.team[S.active];
        if (m.hp > 0) m.hp = Math.max(0, m.hp - 2);
      }
    }
    // 绿蒙斯：敌方中毒、我方恩泽
    if (state.field.kind === 'poisonField') {
      const owner = state.field.owner;
      const foeSide = owner === P ? E : P;
      const foe = foeSide.team[foeSide.active];
      if (foe && foe.hp > 0) {
        foe.hp = Math.max(0, foe.hp - state.field.value);
        log(`${foe.name} 中毒 -${state.field.value} HP`, 'dim');
      }
      const mine = owner.team[owner.active];
      if (mine && mine.hp > 0) {
        mine.hp = Math.min(mine.maxHp, mine.hp + state.field.heal);
        log(`${mine.name} 恩泽 +${state.field.heal} HP`, 'ep');
      }
    }
    if (state.field.turns <= 0 && state.field.kind !== 'dmgPerm' && state.field.kind !== 'chargeField') {
      // 扎拉布：归还吸取的攻防
      if (state.field.kind === 'drainStats' && state.field.drained) {
        for (const d of state.field.drained) {
          d.mon.atk += d.atk;
          d.mon.def += d.def;
        }
        const owner = state.field.owner;
        const caster = owner.team.find((m) => m.key === 'zarab');
        if (caster) {
          caster.atk -= state.field.drained.reduce((a, d) => a + d.atk, 0);
          caster.def -= state.field.drained.reduce((a, d) => a + d.def, 0);
        }
      }
      if (state.field.kind === 'statBoost') {
        for (const side of [P, E]) for (const mm of side.team) mm.buffs.statMul = 0;
      }
      log(`${state.field.name} 消散了`, 'dim');
      state.field = null;
    }
  }

  if (state.warp) {
    state.warp.turns--;
    if (state.warp.turns <= 0) { state.warp = null; log('四次元扭曲消散', 'dim'); }
  }

  state.timer = Math.max(0, state.timer - 1);
  log(`计时器 ${state.timer} 回合`, 'dim');
}

/* ---------------- 胜负 ---------------- */
function teamHpPctPercent(S) {
  const total = S.team.reduce((a, m) => a + m.hp, 0);
  const max = S.team.reduce((a, m) => a + m.maxHp, 0);
  return total / max;
}

function triggerOnDeath(dead, foe) {
  const passive = dead.moves.find((m) => m.onDeath);
  if (!passive || foe.hp <= 0) return;
  const dmg = Math.max(1, Math.round(passive.onDeath * (dead.atk / foe.def) * 0.16 + 2));
  foe.hp = Math.max(0, foe.hp - dmg);
  log(`${dead.name} 倒下时发动 ${passive.name}，${foe.name} -${dmg} HP`, 'hit');
}

function checkOver() {
  if (state.over) return;
  const P = state.player;
  const E = state.enemy;

  // 哥莫拉·二番战：断尾保命
  for (const side of [P, E]) {
    const m = side.team[side.active];
    if (m.hp > 0 && m.hp / m.maxHp <= 0.25 && m.buffs.secondWind) {
      m.buffs.secondWind = false;
      const heal = Math.round(m.maxHp * 0.5);
      m.hp = Math.min(m.maxHp, m.hp + heal);
      // 断尾：失去大招
      const ultIdx = m.moves.findIndex((mv) => mv.type === 'ult');
      if (ultIdx >= 0) {
        m.moves[ultIdx] = { ...COMMON.swift, name: '断尾', desc: '尾巴断了，暂时没法用大招' };
      }
      log(`${m.name} 断尾求生 —— 恢复 ${heal} HP，失去大招`, 'sys');
    }
  }

  if (P.team[P.active].hp <= 0) {
    const dead = P.team[P.active];
    if (dead.passive?.kind === 'revive' && (!dead.reviveUsed || P.extraRevive)) {
      const ally = P.team.find((m) => m !== dead && m.hp <= 0);
      if (ally) {
        ally.hp = Math.round(ally.maxHp * dead.passive.value / 100);
        ally.ep = Math.max(ally.ep, 30);
        if (P.extraRevive) {
          P.extraRevive = false;
          log(`${dead.name} 发动额外复活，${ally.name} 回来`, 'sys');
        } else {
          dead.reviveUsed = true;
          log(`${dead.name} 倒下前发动怪兽复活，${ally.name} 回来`, 'sys');
        }
      } else if (dead.passive.fallbackHeal) {
        const lowest = P.team
          .filter((m) => m !== dead && m.hp > 0)
          .sort((a, b) => a.hp - b.hp)[0];
        if (lowest) {
          const heal = Math.round(lowest.maxHp * dead.passive.value / 100);
          lowest.hp = Math.min(lowest.maxHp, lowest.hp + heal);
          if (P.extraRevive) P.extraRevive = false;
          else dead.reviveUsed = true;
          log(`${dead.name} 发动怪兽复活，治疗 ${lowest.name} ${heal} HP`, 'sys');
        }
      }
    }
    if (dead.key === 'jamila' && state.field?.kind === 'dmgPerm' && state.field.owner === P) {
      state.field = null;
      log('我的故乡是地球 结束', 'dim');
    }
    triggerOnDeath(dead, E.team[E.active]);
    const next = P.team.findIndex((m) => m.hp > 0);
    if (next === -1) {
      state.over = true; state.winner = 'enemy';
      log('你的三只全倒了。', 'sys'); showBanner(); return;
    }
    P.active = next;
    log(`你的 ${P.team[next].name} 上场`, 'act');
    playMonCry(P.team[next].key);
  }

  if (E.team[E.active].hp <= 0) {
    const dead = E.team[E.active];
    if (dead.passive?.kind === 'revive' && (!dead.reviveUsed || E.extraRevive)) {
      const ally = E.team.find((m) => m !== dead && m.hp <= 0);
      if (ally) {
        ally.hp = Math.round(ally.maxHp * dead.passive.value / 100);
        ally.ep = Math.max(ally.ep, 30);
        if (E.extraRevive) {
          E.extraRevive = false;
          log(`对手的 ${dead.name} 发动额外复活，${ally.name} 回来`, 'sys');
        } else {
          dead.reviveUsed = true;
          log(`对手的 ${dead.name} 发动怪兽复活，${ally.name} 回来`, 'sys');
        }
      } else if (dead.passive.fallbackHeal) {
        const lowest = E.team
          .filter((m) => m !== dead && m.hp > 0)
          .sort((a, b) => a.hp - b.hp)[0];
        if (lowest) {
          const heal = Math.round(lowest.maxHp * dead.passive.value / 100);
          lowest.hp = Math.min(lowest.maxHp, lowest.hp + heal);
          if (E.extraRevive) E.extraRevive = false;
          else dead.reviveUsed = true;
          log(`对手的 ${dead.name} 发动怪兽复活，治疗 ${lowest.name} ${heal} HP`, 'sys');
        }
      }
    }
    if (dead.key === 'jamila' && state.field?.kind === 'dmgPerm' && state.field.owner === E) {
      state.field = null;
    }
    triggerOnDeath(dead, P.team[P.active]);
    const next = E.team.findIndex((m) => m.hp > 0);
    if (next === -1) {
      if (state.mode === 'invade' && state.stage < 3) {
        state.over = true;
        state.winner = 'player';
        state.pendingStage = true;
        log(`第 ${state.stage} 轮胜利`, 'sys');
        showBanner();
        return;
      }
      state.over = true; state.winner = 'player';
      if (state.mode === 'invade' && !isUnlocked()) {
        unlockBonus();
        log('侵略成功！解锁了初代奥特曼、小型威托、威托，可以在怪兽对战里选用。', 'sys');
      } else {
        log(state.mode === 'invade' ? '三轮全胜，侵略成功！' : '对手的三只全倒了。', 'sys');
      }
      showBanner(); return;
    }
    E.active = next;
    log(`对手的 ${E.team[next].name} 上场`, 'act');
    playMonCry(E.team[next].key);
  }

  if (state.timer <= 0) {
    state.over = true;
    const pp = teamHpPctPercent(P);
    const ee = teamHpPctPercent(E);
    if (Math.abs(pp - ee) < 0.001) {
      state.winner = P.team[P.active].spd >= E.team[E.active].spd ? 'player' : 'enemy';
      log('计时器熄灭，血量打平。速度快的赢。', 'sys');
    } else {
      state.winner = pp > ee ? 'player' : 'enemy';
      log(`计时器熄灭了。${state.winner === 'player' ? '你' : '对手'}的队伍血量更多。`, 'sys');
    }
    showBanner();
  }
}

/* ---------------- AI ---------------- */
/* 估算伤害（不含随机），AI 用来算斩杀和挑招 */
function estimateDamage(att, def, move) {
  if (!move.power) return 0;
  let dmg = move.power * (effAtk(att) / effDef(def)) * 0.16 + 2;
  dmg *= typeMult(att, def);
  let guard = 0;
  return Math.round(dmg * (1 - guard));
}

function aiChoose(S, foeS, history) {
  const me = S.team[S.active];
  const foe = foeS.team[foeS.active];
  if (me.status.stun > 0) return { kind: 'skip' };

  const atkMoves = me.moves.filter((m) => ['melee', 'beam', 'ult'].includes(m.type)
    && me.ep >= m.ep && !m.selfDestruct
    && !(m.type === 'melee' && me.status.noMelee > 0));

  // 1. 残血换人
  if (hpPct(me) < 0.2 && S.switches > 0 && rnd() < 0.3) {
    const next = S.team.findIndex((m, i) => i !== S.active && m.hp > 0);
    if (next !== -1) {
      const fast = teamSpeed(S) > teamSpeed(foeS);
      const stance = me.moves.find((m) => m.type === 'stance');
      return { kind: 'switch', next, follow: fast ? pickAttack(me) : stance || null };
    }
  }

  // 2. 斩杀：有能打死的招就用
  for (const m of atkMoves) {
    if (estimateDamage(me, foe, m) >= foe.hp) {
      return { kind: 'move', move: m };
    }
  }

  // 3. 读牌：对面连续同类就反制
  const recent = (history || state.playerHistory).slice(-3);
  if (recent.length >= 3 && rnd() < 0.45) {
    const counts = { melee: 0, beam: 0, stance: 0 };
    for (const t of recent) if (t in counts) counts[t]++;
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (top[1] >= 2) {
      const wantVs = top[0] === 'beam' ? 'beam' : 'melee';
      const c = me.moves.find((m) => m.type === 'stance' && m.vs === wantVs && me.ep >= m.ep);
      if (c) { state.aiRead = true; return { kind: 'move', move: c }; }
    }
  }

  // 4. 自爆：残血且能炸到
  const bomb = me.moves.find((m) => m.selfDestruct && me.ep >= m.ep);
  if (bomb && hpPct(me) < 0.35 && rnd() < 0.5) return { kind: 'move', move: bomb };

  // 5. 领域：没领域且 EP 充裕
  const field = me.moves.find((m) => m.type === 'field' && me.ep >= m.ep);
  if (field && !state.field && rnd() < 0.3) return { kind: 'move', move: field };

  // 6. 挑期望伤害最高的招（类型克制 + 威力）
  let best = null;
  let bestDmg = -1;
  for (const m of atkMoves) {
    const d = estimateDamage(me, foe, m) + rnd() * 6;
    if (d > bestDmg) { bestDmg = d; best = m; }
  }
  if (best && rnd() < 0.75) return { kind: 'move', move: best };

  return { kind: 'move', move: pickAttack(me) };
}

function pickAttack(me) {
  const atk = me.moves.filter((m) => ['melee', 'beam', 'ult'].includes(m.type)
    && me.ep >= m.ep && !m.selfDestruct
    && !(m.type === 'melee' && me.status.noMelee > 0));
  if (atk.length) return atk[Math.floor(rnd() * atk.length)];
  const st = me.moves.find((m) => m.type === 'stance');
  if (st) return st;
  return me.moves[0];
}

/* ---------------- 渲染 ---------------- */
function render() {
  if (!state) return;
  $('#turnNum').textContent = state.turn;
  $('#timerNum').textContent = state.timer;

  const tc = $('#timerCircle');
  if (tc) tc.classList.toggle('danger', state.timer <= 3);
  if (!state.over && state.timer <= 3 && state.timer > 0 && state.lastTimerWarn !== state.timer) {
    state.lastTimerWarn = state.timer;
    playSfx(SFX_MISC.timer, VOL.timer);
  }

  const siteBox = $('#siteBox');
  if (siteBox) siteBox.textContent = state.siteName ? `${SITES[state.site]?.icon || ''} ${state.siteName}` : '';

  const fieldBox = $('#fieldBox');
  if (fieldBox) {
    if (state.field) {
      fieldBox.hidden = false;
      fieldBox.textContent = `${state.field.name}（剩 ${state.field.turns}）`;
    } else fieldBox.hidden = true;
  }

  paintSide('enemy', state.enemy);
  paintSide('player', state.player);
  renderActions();
}

function paintSide(side, S) {
  const m = S.team[S.active];
  const card = $(`#${side}Card`);
  if (card) {
    card.dataset.type = m.type;
    card.classList.toggle('low-hp', m.hp / m.maxHp < 0.3);
  }
  const typeEl = $(`#${side}Type`);
  if (typeEl) typeEl.dataset.type = m.type;
  $(`#${side}Name`).textContent = m.name;
  $(`#${side}Sub`).textContent = m.sub;
  const pvEl = $(`#${side}Passive`);
  if (pvEl) pvEl.textContent = m.passive ? `被动 · ${m.passive.name}：${m.passive.desc || ''}` : '';
  $(`#${side}Type`).textContent = m.typeName;
  $(`#${side}Sprite`).innerHTML = sprite(m.key, m.faces);

  $(`#${side}HpBar`).style.width = (m.hp / m.maxHp) * 100 + '%';
  $(`#${side}HpTxt`).textContent = `${m.hp} / ${m.maxHp}`;
  $(`#${side}EpBar`).style.width = m.ep + '%';
  $(`#${side}EpTxt`).textContent = `${m.ep} EP`;

  const tag = $(`#${side}Dodge`);
  const icons = [];
  if (m.counterBonus) icons.push(['⚡', '反击加成 ×1.3']);
  if (m.orbReady) icons.push(['🔵', '光球待发（下一手先制）']);
  if (m.status.stun) icons.push(['💫', '眩晕']);
  if (m.status.slow) icons.push(['🐌', '迟缓']);
  if (m.status.noMelee) icons.push(['🚫', '禁格斗']);
  if (m.status.noBeam) icons.push(['🚫', '禁光线']);
  if (m.status.poison) icons.push(['☠', '神经中毒']);
  if (m.status.clamp) icons.push(['🔗', '钳制']);
  if (m.status.confuse) icons.push(['😵', '混乱']);
  if (m.status.cut) icons.push(['✂', '切割（受伤 +10%）']);
  if (m.status.pull) icons.push(['🧲', '牵引（必定后手）']);
  if (m.status.double) icons.push(['👥', '二重身']);
  if (m.status.mark) icons.push(['🎯', '奥特攻击光线标记']);
  if (m.buffs.nullify) icons.push(['🛡', '反射板待发']);
  if (m.buffs.clone) icons.push(['🎭', '假奥特曼']);
  if (tag) {
    tag.className = 'state-icons';
    tag.innerHTML = icons.map(([ic, tip]) => `<span class="state-icon" title="${tip}">${ic}</span>`).join('');
    tag.hidden = icons.length === 0;
  }

  const box = $(`#${side}Bench`);
  if (box) {
    box.innerHTML = S.team.map((b, i) => {
      const cls = i === S.active ? 'bench-dot active' : b.hp <= 0 ? 'bench-dot down' : 'bench-dot';
      return `<span class="${cls}" title="${b.name} ${b.hp}/${b.maxHp}"></span>`;
    }).join('');
  }

  const sw = $(`#${side}SwitchTxt`);
  if (sw) {
    const pct = Math.round(teamHpPctPercent(S) * 100);
    sw.textContent = side === 'player'
      ? `队伍 ${pct}% · 换人 ${S.switches}/${MAX_SWITCH}`
      : `队伍 ${pct}%`;
  }
}

function renderActions() {
  if (!state) return;
  const box = $('#actions');
  const optBox = $('#optionBox');
  if (!box) return;
  if (state.over) { box.innerHTML = ''; if (optBox) optBox.innerHTML = ''; return; }

  const P = state.player;
  const m = P.team[P.active];

  if (state.pendingSwitch === 'pick') {
    box.innerHTML = '';
    P.team.forEach((b, i) => {
      if (i === P.active || b.hp <= 0) return;
      const fast = teamSpeed(P) > teamSpeed(state.enemy);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'move m-switch';
      btn.disabled = state.busy || P.switches <= 0;
      btn.innerHTML = `
        <span class="move-name">换上 ${b.name}</span>
        <span class="move-meta">HP ${b.hp}/${b.maxHp} · 速 ${b.spd}</span>
        <span class="move-desc">${fast ? '你更快，换完还能出招（后手）' : '你更慢，换完只能防御'}</span>
      `;
      btn.addEventListener('click', () => {
        state.pendingSwitch = { next: i, fast };
        renderActions();
      });
      box.appendChild(btn);
    });
    addCancel(box);
    return;
  }

  if (state.pendingSwitch && typeof state.pendingSwitch === 'object') {
    const { next, fast } = state.pendingSwitch;
    const nm = P.team[next];
    box.innerHTML = '';
    const pool = nm.moves.filter((mv) => fast ? !mv.passive : (mv.type === 'stance' && !mv.passive));
    if (pool.length === 0) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'move m-switch';
      btn.innerHTML = `<span class="move-name">跳过</span><span class="move-meta">没有可用防御</span><span class="move-desc">直接换人</span>`;
      btn.addEventListener('click', () => playTurn({ kind: 'switch', next }));
      box.appendChild(btn);
    } else {
      pool.forEach((mv) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'move m-' + mv.type;
        btn.disabled = !canUse(nm, mv);
        btn.innerHTML = moveHtml(mv);
        btn.addEventListener('click', () => playTurn({ kind: 'switch', next, follow: mv }));
        box.appendChild(btn);
      });
    }
    addCancel(box);
    return;
  }

  box.innerHTML = '';
  const all = m.moves.filter((mv) => !mv.passive);
  const atkMoves = all.filter((mv) => ['melee', 'beam', 'ult'].includes(mv.type));
  const defMoves = all.filter((mv) => mv.type === 'stance');
  const otherMoves = all.filter((mv) => ['field'].includes(mv.type));

  function makeCard(move) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'skill-card m-' + move.type;
    btn.disabled = state.busy || !canUse(m, move);
    const stanceKind = move.type === 'stance' ? (move.vs === 'beam' ? '反制A' : '反制B') : '';
    const typeLabel = move.type === 'stance' ? stanceKind : (TYPE_NAME[move.type] || '技能');
    let powerTxt = '';
    if (move.type === 'stance') powerTxt = `闪避 ${move.dodge || 0}%`;
    else if (move.type === 'field') powerTxt = '领域';
    else if (!move.passive) powerTxt = `威力 ${move.power || 0}`;
    btn.innerHTML = `
      <div class="sk-name">${move.name}</div>
      <div class="sk-desc">${move.desc || ''}</div>
      <div class="sk-foot">
        <span class="sk-type">${typeLabel}</span>
        <span>${powerTxt}</span>
        <span>EP ${move.ep || 0}</span>
      </div>`;
    btn.addEventListener('click', () => playTurn({ kind: 'move', move }));
    return btn;
  }

  const grid = document.createElement('div');
  grid.className = 'skill-grid-2';
  [...atkMoves, ...defMoves, ...otherMoves].forEach((mv) => grid.appendChild(makeCard(mv)));
  box.appendChild(grid);

  const benchAlive = P.team.filter((b, i) => i !== P.active && b.hp > 0).length;
  const host = optBox || box;
  if (optBox) optBox.innerHTML = '';

  const sw = document.createElement('button');
  sw.type = 'button';
  sw.className = 'move m-switch';
  sw.disabled = state.busy || P.switches <= 0 || benchAlive === 0;
  sw.innerHTML = `
    <span class="move-name">换人</span>
    <span class="move-meta">剩余 ${P.switches} 次</span>
  `;
  sw.addEventListener('click', () => { state.pendingSwitch = 'pick'; renderActions(); });
  host.appendChild(sw);

  const skip = document.createElement('button');
  skip.type = 'button';
  skip.className = 'move m-skip';
  skip.disabled = state.busy;
  skip.innerHTML = `
    <span class="move-name">跳过</span>
    <span class="move-meta">EP +5</span>
  `;
  skip.addEventListener('click', () => playTurn({ kind: 'skip' }));
  host.appendChild(skip);
}

function addCancel(box) {
  const c = document.createElement('button');
  c.type = 'button';
  c.className = 'move m-switch';
  c.innerHTML = `<span class="move-name">取消</span><span class="move-meta">不换</span><span class="move-desc">回到技能选择</span>`;
  c.addEventListener('click', () => { state.pendingSwitch = null; renderActions(); });
  box.appendChild(c);
}

function moveHtml(move) {
  const stanceKind = move.type === 'stance' ? (move.vs === 'beam' ? '反制A' : '反制B') : '';
  const fullTip = `${move.name}｜${move.type === 'stance' ? stanceKind + (move.vs === 'beam' ? '（挡光线）' : '（挡格斗）') : (TYPE_NAME[move.type] || move.type)}｜EP ${move.ep || 0}｜${move.desc || ''}`;
  const typeLabel = move.type === 'stance' ? stanceKind : (TYPE_NAME[move.type] || '技能');
  let meta;
  if (move.type === 'stance') {
    meta = move.vs === 'melee'
      ? `挡格斗 · 闪避 ${move.dodge || 0}% → 失败减伤 ${Math.round((move.guard || 0) * 100)}%`
      : `挡光线 · 闪避 ${move.dodge || 0}%`;
  } else if (move.type === 'field') meta = '领域 · 消耗一回合';
  else if (move.passive) meta = '被动';
  else meta = `威力 ${move.power}` + (move.acc ? ` · 命中 ${move.acc}%` : '');
  return `
    <span class="move-name" title="${fullTip}">${move.name}</span>
    <span class="move-meta"><em class="mtype t-${move.type}">${typeLabel}</em>${meta} · EP ${move.ep || 0}</span>
    <span class="move-desc">${move.desc || ''}</span>
  `;
}

function showTurnBanner(turn) {
  if (!document.body) return;
  const el = document.createElement('div');
  el.className = 'turn-banner';
  el.textContent = typeof turn === 'number' ? `第 ${turn} 回合` : String(turn);
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1100);
}

function renderLog() {
  const box = $('#log');
  if (!box || !state) return;
  box.innerHTML = state.log.map((l) => `<div class="line ${l.cls}">${l.text}</div>`).join('');
  box.scrollTop = box.scrollHeight;
}

function flash(side) {
  const sp = $(`#${side}Sprite`);
  if (!sp) return;
  sp.classList.remove('hit');
  void sp.offsetWidth;
  sp.classList.add('hit');
}

/* 伤害 / 闪避 飘字 */
function floatText(side, text, cls) {
  const card = $(`#${side}Card`);
  if (!card || !card.appendChild) return;
  const el = document.createElement('div');
  el.className = 'float-text ' + (cls || 'dmg');
  el.textContent = text;
  card.appendChild(el);
  card.classList.add('hit-shake');
  setTimeout(() => {
    el.remove();
    card.classList.remove('hit-shake');
  }, 900);
}

function showBanner() {
  // 战斗结束：停掉所有还在响的音效
  stopAllSfx();
  const b = $('#banner');
  b.hidden = false;
  const w = state.winner;
  b.className = 'banner ' + (w === 'player' ? 'win' : 'lose');
  b.innerHTML = `
    <div class="banner-title">${w === 'player' ? '胜利' : '败北'}</div>
    <div class="banner-sub">${w === 'player' ? '还剩 ' + state.player.team.filter((m) => m.hp > 0).length + ' 只站着' : '三只都倒了'}</div>
    <button id="again" type="button">${state.pendingStage ? '进入下一轮' : (state.mode === 'invade' ? '再打一次' : '重新编队')}</button>
  `;
  $('#again').addEventListener('click', () => {
    if (state.pendingStage) {
      const stage = state.stage + 1;
      const keys = state.player.team.map((m) => m.key);
      state = null;
      startGame(keys, INVADE_STAGES[stage - 1], 'invade');
      state.stage = stage;
      return;
    }
    const wasTutorial = state && state.mode === 'tutorial';
    $('#battle').hidden = true;
    $('#modeSelect').hidden = false;
    $('#pick').hidden = true;
    $('#dex').hidden = true;
    $('#banner').hidden = true;
    if (document.body) document.body.classList.remove('in-battle');
    state = null;
    if (wasTutorial) log = log;
  });
}


/* ---------------- 图鉴 ---------------- */
const DEX_ORDER = [...MON_ORDER, 'vtolSmall', 'vtol', 'ultraman'];

function skillLine(m) {
  const t = m.type === 'stance'
    ? (m.vs === 'beam' ? '反制A·挡光线' : '反制B·挡格斗')
    : (TYPE_NAME[m.type] || m.type);
  let extra = '';
  if (m.type === 'stance') extra = m.vs === 'melee' ? `闪避 ${m.dodge || 0}% / 减伤 ${Math.round((m.guard || 0) * 100)}%` : `闪避 ${m.dodge || 0}%`;
  else if (m.type === 'field') extra = '领域';
  else if (m.passive) extra = '被动';
  else extra = `威力 ${m.power || 0}` + (m.acc ? ` / 命中 ${m.acc}%` : '');
  return `<li><b>${m.name}</b><em>${t}</em><span>${extra} · EP ${m.ep || 0}</span><p>${m.desc || ''}</p></li>`;
}

function renderDex() {
  const grid = $('#dexGrid');
  if (!grid) return;
  grid.innerHTML = DEX_ORDER.map((key) => {
    const d = MONSTERS[key];
    if (!d) return '';
    return `
      <div class="pick-card dex-card" data-dex="${key}">
        <span class="pick-cost">${d.cost || '—'}</span>
        <div class="pick-sprite">${sprite(key)}</div>
        <div class="pick-bottom">
          <div class="pick-row">
            <span class="pick-name">${d.name}</span>
          </div>
          <div class="pick-sub">${d.sub}</div>
          <div class="pick-tag">${d.overlord ? '豪强 · ' : ''}${d.typeName}</div>
        </div>
      </div>`;
  }).join('');

  grid.querySelectorAll('.dex-card').forEach((card) => {
    card.addEventListener('click', () => openDetail(card.dataset.dex, true));
  });
}

function openDex() {
  $('#modeSelect').hidden = true;
  $('#pick').hidden = true;
  $('#dex').hidden = false;
  renderDex();
}

function closeDex() {
  $('#dex').hidden = true;
  $('#modeSelect').hidden = false;
}


/* ---------------- 教程 ---------------- */
const TUT_STEPS = [
  {
    title: '主界面',
    text: '主界面四个入口：怪兽对战是 3v3 打 AI；侵略地球要连打三轮，最后对初代奥特曼；图鉴能查所有角色和技能；教程就是这里。',
    target: null,
  },
  {
    title: '你的怪兽',
    text: '左边是你出场的怪兽。名字下面是它的被动，会自动触发，不用你操作。HP 打空就倒下。',
    target: '#playerSprite',
  },
  {
    title: '技能的类型',
    text: '技能按颜色区分：橙金是格斗，蓝色是光线，青绿是姿态（反制），橙红是大招。姿态分反制A和反制B，卡片上会写清楚挡的是哪一类。',
    target: '#actions',
  },
  {
    title: '反制的博弈',
    text: '反制A专门挡光线，反制B专门挡格斗。猜对了就能闪掉，猜错就露破绽——这就是每回合要猜的东西。',
    target: '#actions',
  },
  {
    title: '破姿态',
    text: '攻击类型和对方反制对不上，就是「破姿态」，伤害 ×1.6。双方都出攻击、类型又不同时，速度快的一方先出手，同样能吃到这个优势。',
    target: '#actions',
  },
  {
    title: 'EP 是资源',
    text: '放技能要消耗 EP。每回合自然回 8 点，格斗命中还能再回一点。大招要攒够才能放。',
    target: '#playerEpBar',
  },
  {
    title: '对波 · 触发',
    text: '双方同一回合都出光线技能时，进入对波。这时不按正常流程结算，而是比较两边这次能打出多少伤害，差值就是差额伤害。',
    target: '#actions',
  },
  {
    title: '对波 · 追加 EP',
    text: '看完伤害后，双方各有一次机会追加 EP（金额等于自己那招的 EP）。追加会让对方再比一次：两边伤害都翻倍，谁的伤害低谁吃两次差值之和。赢家追加则输家吃原伤害加差额。都不追加，输家只吃差额。',
    target: '#clashBox',
  },
  {
    title: '类型克制',
    text: '每只怪兽有类型。宇宙人克全体怪兽；怪兽之间是环：宇宙怪兽→超能力怪兽→地球怪兽→宇宙怪兽，克制时 1.1 倍。',
    target: '#enemyType',
  },
  {
    title: '大招与速度',
    text: '大招不参与破姿态，只吃基础减伤。速度快的先出手，百慕拉比内隆嘎快。预备好就开始吧。',
    target: '#enemySprite',
  },
];

function clearTutHighlight() {
  document.querySelectorAll('.tut-highlight').forEach((el) => el.classList.remove('tut-highlight'));
}

function showTutStep(i) {
  const overlay = $('#tutOverlay');
  if (!overlay) return;
  clearTutHighlight();
  if (i >= TUT_STEPS.length) {
    overlay.hidden = true;
    if (tutorialPending) beginTutorialBattle();
    return;
  }
  const step = TUT_STEPS[i];
  $('#tutStep').textContent = (i + 1) + ' / ' + TUT_STEPS.length;
  $('#tutTitle').textContent = step.title;
  $('#tutText').textContent = step.text;
  overlay.hidden = false;
  const target = step.target ? $(step.target) : null;
  if (target) target.classList.add('tut-highlight');
  $('#tutNext').textContent = i === TUT_STEPS.length - 1 ? '开始战斗' : '下一步';
  $('#tutNext').onclick = () => showTutStep(i + 1);
}

let tutorialPending = false;

function startTutorial() {
  state = null;
  tutorialPending = true;
  $('#modeSelect').hidden = true;
  $('#dex').hidden = true;
  $('#pick').hidden = true;
  $('#battle').hidden = true;
  showTutStep(0);
}

/* 教程讲完后才真正进入战斗 */
function beginTutorialBattle() {
  tutorialPending = false;
  $('#battle').hidden = false;
  if (document.body) document.body.classList.add('in-battle');
  startGame(['bemular'], ['neronga'], 'tutorial');
  for (const m of state.enemy.team) {
    m.maxHp = Math.round(m.maxHp * 0.45);
    m.hp = m.maxHp;
  }
}


/* ---------------- 音效 ---------------- */
const SFX = {
  bemular:   'music/cry/bemular.mp3',
  baltan:    'music/cry/baltan.mp3',
  baltan2:   'music/cry/baltan2.mp3',
  neronga:   'music/cry/neronga.mp3',
  greenmons: 'music/cry/greenmons.mp3',
  antlar:    'music/cry/antlar.mp3',
  redking:   'music/cry/redking.mp3',
  zarab:     'music/cry/zarab.mp3',
  jamila:    'music/cry/jamila.mp3',
  gomora:    'music/cry/gomora.mp3',
  mephilas:  'music/cry/mephilas.mp3',
  zetton:    'music/cry/zetton.mp3',
  bullton:   'music/cry/bullton.mp3',
  dada:      'music/cry/dada_a.mp3',
  geronimon: 'music/cry/geronimon.mp3',
  ultraman:  'music/cry/ultraman.mp3',
};

/* 达达三面变化专用 */
const SFX_DADA_FACE = {
  A: 'music/cry/dada_a.mp3',
  B: 'music/cry/dada_b.mp3',
  C: 'music/cry/dada_c.mp3',
};

const SFX_MISC = {
  spesium: 'music/skill/spesium_3s.mp3',
  henshin: 'music/skill/henshin_4s.mp3',
  timer:   'music/ui/timer.mp3',
  victory: 'music/ui/victory.mp3',
};

/* 统一音量（每组单独可调） */
const VOL = {
  cry: 0.22,
  ult: 0.32,
  timer: 0.18,
  victory: 0.28,
};

const audioCache = new Map();
let sfxEnabled = true;
let audioUnlocked = false;

function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  preloadAllSfx();
  // 用一次静音播放解锁音频上下文
  try {
    const a = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA=');
    a.volume = 0;
    const p = a.play();
    if (p && p.catch) p.catch(() => {});
  } catch (e) { /* 忽略 */ }
}

/* 预加载全部音效，避免首次播放延迟 */
let preloaded = false;
function preloadAllSfx() {
  if (preloaded) return;
  preloaded = true;
  const all = [
    ...Object.values(SFX),
    ...Object.values(SFX_DADA_FACE),
    ...Object.values(SFX_MISC),
  ];
  for (const src of all) {
    if (!src) continue;
    try {
      const a = new Audio(encodeURI(src));
      a.preload = 'auto';
      a.load && a.load();
      audioCache.set(src, a);
    } catch (e) { /* 忽略 */ }
  }
}

/* 停止所有正在播放的音效 */
function stopAllSfx() {
  for (const a of audioCache.values()) {
    try { a.pause(); a.currentTime = 0; } catch (e) { /* 忽略 */ }
  }
}

function playSfx(src, volume) {
  if (!sfxEnabled || !src) return;
  try {
    let a = audioCache.get(src);
    if (!a) {
      a = new Audio(encodeURI(src));
      a.preload = 'auto';
      a.addEventListener('error', () => {
        console.warn('[音效加载失败]', src);
      });
      audioCache.set(src, a);
    }
    a.volume = volume === undefined ? 0.5 : volume;
    try { a.currentTime = 0; } catch (e) {}
    const p = a.play();
    if (p && p.catch) p.catch((err) => {
      console.warn('[音效播放被拒]', src, err && err.name);
    });
  } catch (e) {
    console.warn('[音效异常]', e);
  }
}

/* 调试：打印当前音效映射 */
function dumpSfxMap() {
  console.log('[音效映射]', SFX);
  console.log('[技能音效]', SFX_MISC);
}

function playMonCry(key) {
  if (key === 'ultraman') {
    // 奥特曼：先变身音，再叫声
    playSfx(SFX_MISC.henshin, VOL.cry);
    setTimeout(() => playSfx(SFX.ultraman, VOL.cry), 1600);
    return;
  }
  const src = SFX[key];
  if (src) playSfx(src, VOL.cry);
}

function toggleSfx() {
  sfxEnabled = !sfxEnabled;
  const btn = $('#sfxBtn');
  if (btn) btn.textContent = sfxEnabled ? '🔊' : '🔇';
}


/* ---------------- 角色详情弹层 ---------------- */
let detailKey = null;

function openDetail(key, readOnly) {
  const d = MONSTERS[key];
  if (!d) return;
  detailKey = key;

  const overlay = document.createElement('div');
  overlay.className = 'detail-overlay';
  overlay.id = 'detailOverlay';

  const pool = monPool(key);
  // 统一成 { id, move } 列表
  const allSkill = d.pool
    ? d.pool.map((mv, i) => ({ id: key + ':p' + i, move: mv }))
    : pool.map((mv) => ({ id: mv.id, move: mv }));
  const noLoadout = !!d.pool; // 奥特曼在 3v3 也走 loadout，但池子里是全部技能

  const statBar = (label, val, max) => {
    const pct = Math.min(100, (val / max) * 100);
    return `<div class="ds-row"><span class="ds-label">${label}</span><div class="ds-bar"><i style="width:${pct}%"></i></div><span class="ds-num">${val}</span></div>`;
  };

  const skillCard = (entry) => {
    const m = entry.move;
    const t = m.type === 'stance'
      ? (m.vs === 'beam' ? '反制A' : '反制B')
      : (TYPE_NAME[m.type] || m.type);
    let extra = '';
    if (m.type === 'stance') extra = `闪避 ${m.dodge || 0}%`;
    else if (m.type === 'field') extra = '领域';
    else if (m.power) extra = `威力 ${m.power}`;
    return `<div class="ds-skill m-${m.type}" data-sid="${entry.id}">
      <div class="ds-sk-name">${m.name}</div>
      <div class="ds-sk-desc">${m.desc || ''}</div>
      <div class="ds-sk-foot"><span>${t}</span><span>${extra}</span><span>EP ${m.ep || 0}</span></div>
    </div>`;
  };

  overlay.innerHTML = `
    <div class="detail-panel">
      <button class="detail-close" type="button">×</button>
      <div class="detail-top">
        <div class="detail-portrait">${sprite(key)}</div>
        <div class="detail-passive">
          <div class="dp-label">角色被动</div>
          <div class="dp-name">${d.passive ? d.passive.name : '无'}</div>
          <div class="dp-desc">${d.passive ? (d.passive.desc || '') : ''}</div>
        </div>
      </div>
      <div class="detail-namerow">
        <span class="detail-name">${d.name}</span>
        <span class="detail-alias">${d.sub}</span>
        <span class="detail-type">${d.overlord ? '豪强 · ' : ''}${d.typeName}</span>
      </div>
      <div class="detail-stats">
        ${statBar('HP', d.hp, 200)}
        ${statBar('攻', d.atk, 130)}
        ${statBar('防', d.def, 110)}
        ${statBar('速', d.spd, 110)}
      </div>
      <div class="detail-skills">
        <div class="ds-title">技能　<span class="ds-count"></span></div>
        <div class="ds-grid">${allSkill.map(skillCard).join('')}</div>
      </div>
      ${readOnly ? '' : '<div class="detail-actions"><button class="da-pick" type="button"></button></div>'}
    </div>`;

  document.body.appendChild(overlay);

  /* 技能选择 */
  const grid = overlay.querySelector('.ds-grid');
  const countEl = overlay.querySelector('.ds-count');

  function syncSkills() {
    const ids = loadout[key] || defaultLoadout(key);
    grid.querySelectorAll('.ds-skill').forEach((el) => {
      el.classList.toggle('on', ids.includes(el.dataset.sid));
    });
    if (countEl) countEl.textContent = `${ids.length} / 4`;
  }

  grid.querySelectorAll('.ds-skill').forEach((el) => {
    el.addEventListener('click', () => {
      const sid = el.dataset.sid;
      const ids = (loadout[key] || defaultLoadout(key)).slice();
      const idx = ids.indexOf(sid);
      if (idx >= 0) {
        if (ids.length <= 1) return; // 至少留一个
        ids.splice(idx, 1);
      } else {
        if (ids.length >= 4) return; // 最多四个
        ids.push(sid);
      }
      loadout[key] = ids;
      syncSkills();
      renderPick();
    });
  });

  syncSkills();

  /* 选入 / 移出（图鉴只读时没有这个按钮） */
  const pickBtn = overlay.querySelector('.da-pick');
  if (!pickBtn) {
    overlay.querySelector('.detail-close').addEventListener('click', closeDetail);
    overlay.addEventListener('click', (ev) => {
      if (ev.target === overlay) closeDetail();
    });
    return;
  }
  const updatePickBtn = () => {
    const on = selected.includes(key);
    pickBtn.textContent = on ? '移出队伍' : '选入队伍';
    pickBtn.classList.toggle('on', on);
  };
  updatePickBtn();

  pickBtn.addEventListener('click', () => {
    if (selected.includes(key)) {
      selected = selected.filter((k) => k !== key);
    } else if (selected.length < 3) {
      selected.push(key);
    }
    updatePickBtn();
    renderPick();
  });

  overlay.querySelector('.detail-close').addEventListener('click', closeDetail);
  overlay.addEventListener('click', (ev) => {
    if (ev.target === overlay) closeDetail();
  });
}

function closeDetail() {
  const ov = document.getElementById('detailOverlay');
  if (ov) ov.remove();
  detailKey = null;
}

/* ---------------- 编成界面 ---------------- */
function renderPick() {
  const grid = $('#pickGrid');
  if (!grid) return;
  const banner = $('#unlockNote');
  if (banner) {
    banner.hidden = gameMode === 'invade' || !isUnlocked();
    banner.textContent = '已解锁：初代奥特曼（9）、小型威托（4）、威托（6）';
  }

  grid.innerHTML = pickableKeys().map((key) => {
    const d = MONSTERS[key];
    if (!d) return '';
    const on = selected.includes(key);
    const isOpen = expanded === key;
    const ids = loadout[key] || defaultLoadout(key);
    const pool = monPool(key);
    const chosen = ids.map((id) => pool.find((x) => x.id === id)).filter(Boolean);

    return `
      <div class="pick-card ${on ? 'on' : ''}" data-key="${key}">
        <span class="pick-cost">${d.cost}</span>
        <div class="pick-sprite">${sprite(key)}</div>
        <div class="pick-bottom">
          <div class="pick-row">
            <span class="pick-name">${d.name}</span>
          </div>
          <div class="pick-sub">${d.sub}</div>
          <div class="pick-tag">${d.overlord ? '豪强 · ' : ''}${d.typeName}</div>
        </div>
        ${on ? '<div class="pick-check">✓</div>' : ''}
      </div>
    `;
  }).join('');

  const cost = selected.reduce((a, k) => a + MONSTERS[k].cost, 0);
  $('#costNum').textContent = cost;
  $('#costBar').style.width = Math.min(100, (cost / TEAM_COST) * 100) + '%';
  $('#costBox').classList.toggle('over', cost > TEAM_COST);

  const mutexHit = MUTEX.some((pair) => pair.every((k) => selected.includes(k)));
  const ready = selected.length === 3 && cost <= TEAM_COST && !mutexHit
    && selected.every((k) => (loadout[k] || defaultLoadout(k)).length === 4);
  $('#startBtn').disabled = !ready;
  $('#startBtn').textContent = selected.length !== 3
    ? `还要选 ${3 - selected.length} 只`
    : mutexHit ? '这两只不能同时上场'
      : !ready ? '技能没配满' : '开始战斗';

  bindPickEvents(grid);
}

function skillPanel(key, pool, ids) {
  const groups = [
    { slot: 'common', label: '通用' },
    { slot: 'sig', label: '特色' },
    { slot: 'sp', label: '特殊' },
  ];
  return `
    <div class="skill-panel">
      ${groups.map((g) => `
        <div class="skill-group">
          <div class="skill-group-label">${g.label}</div>
          <div class="skill-list">
            ${pool.filter((m) => m.slot === g.slot).map((m) => {
              const on = ids.includes(m.id);
              const tip = `${m.name}｜${TYPE_NAME[m.type]}${m.type === 'stance' ? (m.vs === 'melee' ? `｜闪避${m.dodge || 0}% 减伤${Math.round((m.guard || 0) * 100)}%` : `｜闪避${m.dodge || 0}%`) : (m.power ? `｜威力${m.power}` : '')}｜EP ${m.ep || 0}｜${m.desc || ''}`;
              return `<button class="skill-chip ${on ? 'on' : ''}" data-skill="${m.id}" data-mon="${key}" type="button" title="${tip}">
                <span class="chip-name">${m.name}</span>
                <span class="chip-meta">${m.type === 'stance' ? (m.vs === 'beam' ? '反制A·挡光线' : '反制B·挡格斗') : TYPE_NAME[m.type]} · EP ${m.ep || 0}</span>
              </button>`;
            }).join('')}
          </div>
        </div>
      `).join('')}
      <div class="skill-tip">选 4 个，自由搭配</div>
    </div>
  `;
}

function bindPickEvents(grid) {
  grid.querySelectorAll('.pick-card').forEach((card) => {
    card.addEventListener('click', () => openDetail(card.dataset.key));
  });
}

/* ---------------- 启动 ---------------- */
window.addEventListener('DOMContentLoaded', () => {
  renderPick();
  const vl = $('#verLine');
  if (vl) {
    const total = isUnlocked() ? 19 : 16;
    vl.textContent = 'v1.0 · 已解锁 ' + total + ' 只';
  }
  document.querySelectorAll('[data-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      unlockAudio();
      const mode = btn.dataset.mode;
      if (mode === 'dex') { openDex(); return; }
      if (mode === 'tutorial') { startTutorial(); return; }
      gameMode = mode;
      selected = [];
      $('#modeSelect').hidden = true;
      $('#pick').hidden = false;
      const t = $('#pickTitle');
      const hint = $('#pickHint');
      if (t) t.textContent = mode === 'invade' ? '侵略地球' : '怪兽对战';
      if (hint) {
        hint.textContent = mode === 'invade'
          ? '选 3 只去打三轮：两轮威托编队，最后一轮是初代奥特曼。只能用怪兽阵容。'
          : '3v3 对 AI。编成点数上限 20，每只带 4 个技能。满足羁绊会给全队加成。';
      }
      renderPick();
    });
  });
  const db = $('#dexBack');
  if (db) db.addEventListener('click', closeDex);

  const pb = $('#pickBack');
  if (pb) {
    pb.addEventListener('click', () => {
      selected = [];
      gameMode = 'versus';
      $('#pick').hidden = true;
      $('#battle').hidden = true;
      $('#dex').hidden = true;
      $('#modeSelect').hidden = false;
      if (document.body) document.body.classList.remove('in-battle');
      const vl = $('#verLine');
      if (vl) vl.textContent = 'v1.0 · 已解锁 ' + (isUnlocked() ? 19 : 16) + ' 只';
    });
  }
  $('#startBtn').addEventListener('click', () => {
    unlockAudio();
    if (selected.length === 3) startGame(selected.slice(), null, gameMode);
  });
});

if (typeof window !== 'undefined') {
  window.__TEST__ = {
    startGame, startTutorial, showTutStep, playTurn, aiChoose, getState: () => state, MONSTERS, TEAM_COST, monPool, MUTEX,
    SFX, SFX_MISC, VOL, playSfx, playMonCry, makeMon, rollHit, applyFx, execMove, resolveClash, effAtk, effDef, effSpd, typeMult, fieldBoost, freshStatus, freshBuffs, COMMON, MAX_TIMER,
    BONDS, PASSIVES_REF: null,
    setLoadout: (key, ids) => { loadout[key] = ids; },
    getLoadout: () => loadout,
    defaultLoadout,
  };
}
