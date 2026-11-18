// Builds the data behind the Item Crafting Guide from the public game-data
// export (RePoE fork, https://repoe-fork.github.io): every base item of every
// craftable category, and every modifier it can roll, tier by tier.
//
//   node scripts/build-crafting-data.mjs            rebuild src/data/crafting/*.json
//   node scripts/build-crafting-data.mjs --icons    also download missing base icons
//   node scripts/build-crafting-data.mjs --digest <dir>   also write a Markdown digest per category
//
// The raw files are large (about 100 MB) and are cached in .cache/repoe,
// which is not committed. Delete that folder to fetch a newer export.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const SOURCE = 'https://repoe-fork.github.io';
const CACHE = '.cache/repoe';
const OUT = 'src/data/crafting';
const ICON_DIR = 'public/img/bases';
const UA = 'poe-guide-build/1.0';
const args = process.argv.slice(2);
const wantIcons = args.includes('--icons');
const digestDir = args.includes('--digest') ? args[args.indexOf('--digest') + 1] : undefined;

async function raw(name) {
  const file = join(CACHE, name + '.json');
  if (!existsSync(file)) {
    mkdirSync(CACHE, { recursive: true });
    const res = await fetch(SOURCE + '/' + name + '.json', { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + name + '.json');
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    console.log('fetched ' + name + '.json');
  }
  return JSON.parse(readFileSync(file, 'utf8'));
}

const [bases, mods, modsByBase, itemClasses, bench, essences, fossils, clusterJewels] = await Promise.all(
  ['base_items', 'mods', 'mods_by_base', 'item_classes', 'crafting_bench_options', 'essences', 'fossils', 'cluster_jewels'].map(raw),
);

/**
 * Cluster jewels are the one category where the pool is not decided by the
 * base. A cluster jewel carries an enchantment (the small passive it adds),
 * and the notables it can roll depend on that enchantment's tag, which no
 * base item has. So the notables are collected here, straight from the
 * modifier list, with their weight per enchantment.
 */
function buildCluster() {
  const sizes = Object.values(clusterJewels).map((jewel) => ({
    base: jewel.name,
    size: jewel.size,
    minSkills: jewel.min_skills,
    maxSkills: jewel.max_skills,
  }));
  const enchants = new Map();
  for (const jewel of Object.values(clusterJewels)) {
    for (const passive of jewel.passive_skills) {
      if (!enchants.has(passive.tag)) enchants.set(passive.tag, { tag: passive.tag, name: passive.name, text: passive.stat_text, sizes: [] });
      enchants.get(passive.tag).sizes.push(jewel.size);
    }
  }
  const list = [];
  for (const mod of Object.values(mods)) {
    if (mod.domain !== 'affliction_jewel' || !['prefix', 'suffix'].includes(mod.generation_type)) continue;
    const weights = Object.fromEntries(mod.spawn_weights.filter((entry) => enchants.has(entry.tag) && entry.weight > 0).map((entry) => [entry.tag, entry.weight]));
    if (Object.keys(weights).length === 0 || lines(mod.text).length === 0) continue;
    const notable = /^1 Added Passive Skill is (.+)$/.exec(lines(mod.text)[0]);
    list.push({
      text: lines(mod.text),
      notable: notable ? notable[1] : undefined,
      ilvl: mod.required_level,
      affix: mod.generation_type,
      group: mod.groups[0],
      weights,
    });
  }
  list.sort((a, b) => Number(Boolean(b.notable)) - Number(Boolean(a.notable)) || a.text[0].localeCompare(b.text[0]));
  return { sizes, enchants: [...enchants.values()].sort((a, b) => a.name.localeCompare(b.name)), mods: list };
}

// ---------------------------------------------------------------------------
// The categories of the guide. `classes` are the game's item classes.
// ---------------------------------------------------------------------------
const isCluster = (base) => base.tags.some((tag) => tag.startsWith('expansion_jewel'));
const CATEGORIES = [
  { id: 'helmets', group: 'armour', classes: ['Helmet'] },
  { id: 'body-armours', group: 'armour', classes: ['Body Armour'] },
  { id: 'gloves', group: 'armour', classes: ['Gloves'] },
  { id: 'boots', group: 'armour', classes: ['Boots'] },
  { id: 'shields', group: 'armour', classes: ['Shield'] },
  { id: 'amulets', group: 'jewellery', classes: ['Amulet'] },
  { id: 'rings', group: 'jewellery', classes: ['Ring'] },
  { id: 'belts', group: 'jewellery', classes: ['Belt'] },
  { id: 'quivers', group: 'jewellery', classes: ['Quiver'] },
  { id: 'one-hand-axes', group: 'one-hand', classes: ['One Hand Axe'] },
  { id: 'one-hand-swords', group: 'one-hand', classes: ['One Hand Sword', 'Thrusting One Hand Sword'] },
  { id: 'one-hand-maces', group: 'one-hand', classes: ['One Hand Mace'] },
  { id: 'sceptres', group: 'one-hand', classes: ['Sceptre'] },
  { id: 'daggers', group: 'one-hand', classes: ['Dagger'] },
  { id: 'rune-daggers', group: 'one-hand', classes: ['Rune Dagger'] },
  { id: 'claws', group: 'one-hand', classes: ['Claw'] },
  { id: 'wands', group: 'one-hand', classes: ['Wand'] },
  { id: 'two-hand-axes', group: 'two-hand', classes: ['Two Hand Axe'] },
  { id: 'two-hand-swords', group: 'two-hand', classes: ['Two Hand Sword'] },
  { id: 'two-hand-maces', group: 'two-hand', classes: ['Two Hand Mace'] },
  { id: 'staves', group: 'two-hand', classes: ['Staff'] },
  { id: 'warstaves', group: 'two-hand', classes: ['Warstaff'] },
  { id: 'bows', group: 'two-hand', classes: ['Bow'] },
  { id: 'jewels', group: 'jewel', classes: ['Jewel'], keep: (base) => !isCluster(base) },
  { id: 'abyss-jewels', group: 'jewel', classes: ['AbyssJewel'] },
  { id: 'cluster-jewels', group: 'jewel', classes: ['Jewel'], keep: isCluster },
  { id: 'flasks', group: 'flask', classes: ['LifeFlask', 'ManaFlask', 'HybridFlask', 'UtilityFlask'] },
  { id: 'tinctures', group: 'flask', classes: ['Tincture'] },
];

// Bases that exist in the data but are not things you craft on.
const SKIP_TAGS = ['demigods', 'talisman', 'unique_only', 'fishing_rod', 'trade_market_legacy_item'];
const INFLUENCES = { shaper: 'shaper', elder: 'elder', crusader: 'crusader', adjudicator: 'warlord', eyrie: 'redeemer', basilisk: 'hunter' };

const slug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// The game marks up keywords for its own tooltips: "[Blind]", "[SkillId|Blood Rage]".
const plain = (text) => text.replace(/\[[^\]|]*\|([^\]]+)\]/g, '$1').replace(/\[([^\]]+)\]/g, '$1');
// A few aura modifiers carry their effect twice: once as the player reads it
// ("Enemies within 6 metres have -9% to Fire Resistance") and once as the bare
// stat the aura applies ("-9% to Fire Resistance"). The game shows only the
// first, so a line that is merely the tail of another line is dropped.
const lines = (text) => {
  const all = plain(text ?? '').split('\n').map((line) => line.trim()).filter(Boolean);
  return all.filter((line) => !all.some((other) => other !== line && other.length > line.length && other.endsWith(line)));
};
/** "+(100-114) to maximum Life" -> "+# to maximum Life" */
const labelOf = (text) => lines(text).map((line) => line.replace(/\(-?[\d.]+-+-?[\d.]+\)/g, '#').replace(/-?\d+(\.\d+)?/g, '#').replace(/#(-#)+/g, '#')).join(' / ');
const range = (prop) => (prop ? (prop.min === prop.max ? [prop.min] : [prop.min, prop.max]) : undefined);

function describeBase(id, base) {
  const p = base.properties ?? {};
  const stats = {};
  for (const key of ['armour', 'evasion', 'energy_shield', 'ward', 'block', 'movement_speed']) {
    const value = typeof p[key] === 'object' ? range(p[key]) : p[key] != null ? [p[key]] : undefined;
    if (value) stats[key] = value;
  }
  if (p.physical_damage_max) {
    stats.physical = [p.physical_damage_min, p.physical_damage_max];
    stats.aps = Math.round(100000 / p.attack_time) / 100;
    stats.crit = p.critical_strike_chance / 100;
    if (p.range) stats.range = p.range;
    stats.dps = Math.round(((p.physical_damage_min + p.physical_damage_max) / 2) * (1000 / p.attack_time) * 10) / 10;
  }
  for (const key of ['charges_max', 'charges_per_use', 'duration', 'life_per_use', 'mana_per_use']) if (p[key] != null) stats[key] = p[key];
  const req = Object.fromEntries(Object.entries(base.requirements ?? {}).filter(([, v]) => v > 0));
  return {
    id: slug(base.name),
    name: base.name,
    class: base.item_class,
    dropLevel: base.drop_level,
    req,
    stats,
    implicits: (base.implicits ?? []).flatMap((mod) => lines(mods[mod]?.text)),
    size: [base.inventory_width, base.inventory_height],
    art: base.visual_identity?.dds_file,
    tags: base.tags.filter((tag) => tag !== 'default'),
  };
}

/** Turn {group: {modId: weight}} from several pools into tier ladders. */
function ladders(perPool, poolIds) {
  // modId -> { pool: weight }
  const weights = new Map();
  for (const [pool, groups] of perPool) {
    for (const ids of Object.values(groups ?? {})) {
      for (const [modId, weight] of Object.entries(ids)) {
        if (!weights.has(modId)) weights.set(modId, {});
        weights.get(modId)[pool] = weight;
      }
    }
  }
  const families = new Map();
  for (const [modId, allPools] of weights) {
    const mod = mods[modId];
    // The export lists some modifiers that can never roll (weight 0) and a
    // few with no text. Neither belongs in a list of what an item can have.
    const byPool = Object.fromEntries(Object.entries(allPools).filter(([, weight]) => weight > 0));
    if (!mod || Object.keys(byPool).length === 0 || lines(mod.text).length === 0) continue;
    // Modifiers of the old Battle Royale event are still in the export with
    // ordinary weights. They do not roll in the game proper.
    if (/Royale/.test(modId)) continue;
    const key = mod.type;
    if (!families.has(key)) families.set(key, { key, group: mod.groups[0], tags: mod.implicit_tags, tiers: [] });
    const values = Object.values(byPool);
    const same = values.every((v) => v === values[0]) && Object.keys(byPool).length === poolIds.length;
    families.get(key).tiers.push({
      name: mod.name,
      ilvl: mod.required_level,
      text: lines(mod.text),
      weight: same ? values[0] : byPool,
      essenceOnly: mod.is_essence_only || undefined,
    });
  }
  const out = [];
  for (const family of families.values()) {
    // Best first. Item level decides it for ordinary modifiers; Eldritch
    // implicits all share one level, so there the size of the number does.
    const size = (tier) => Math.max(0, ...(tier.text.join(' ').match(/\d+(\.\d+)?/g) ?? []).map(Number));
    family.tiers.sort((a, b) => b.ilvl - a.ilvl || size(b) - size(a));
    family.tiers.forEach((tier, index) => (tier.tier = index + 1));
    family.label = labelOf(family.tiers[0].text.join('\n'));
    const pools = new Set(family.tiers.flatMap((tier) => (typeof tier.weight === 'number' ? poolIds : Object.keys(tier.weight))));
    if (pools.size !== poolIds.length) family.on = [...pools];
    out.push(family);
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Each Eldritch implicit exists three times in the export: always on, "while
 * a Unique Enemy is in your Presence" and "while a Pinnacle Atlas Boss is in
 * your Presence", each stronger than the last, and the text of all three
 * reads the same because the condition is not part of it. Keep the weakest,
 * which is the one that is always on, so no number shown is conditional.
 */
function unconditional(families) {
  const top = (family) => Math.max(0, ...(family.tiers[0].text.join(' ').match(/\d+(\.\d+)?/g) ?? []).map(Number));
  const byLabel = new Map();
  for (const family of families) {
    const seen = byLabel.get(family.label);
    if (!seen || top(family) < top(seen)) byLabel.set(family.label, family);
  }
  return [...byLabel.values()];
}

const ATTR = ['str_dex_int_armour', 'str_dex_armour', 'str_int_armour', 'dex_int_armour', 'str_armour', 'dex_armour', 'int_armour', 'ward_armour'];
const currencyName = (id) => bases[id]?.name ?? id.split('/').pop();

function buildCategory(category) {
  // 1. Collect the tag sets (one per distinct list of base tags) of every class.
  const tagsets = [];
  for (const cls of category.classes) {
    const byTags = modsByBase[itemClasses[cls]?.name] ?? {};
    for (const [tagKey, entry] of Object.entries(byTags)) {
      const ids = (entry.bases ?? []).filter((id) => {
        const base = bases[id];
        if (!base || base.release_state !== 'released' || base.tags.some((tag) => SKIP_TAGS.includes(tag))) return false;
        if ((base.implicits ?? []).some((mod) => /Hit by a Player/.test(mods[mod]?.text ?? ''))) return false; // PvP copies
        return !category.keep || category.keep(base);
      });
      if (ids.length === 0) continue;
      tagsets.push({ cls, tags: tagKey.split(','), ids, mods: entry.mods ?? {} });
    }
  }
  // The export holds several items under one name: PvP copies of flasks,
  // low-level event copies of rings and belts with other implicit numbers,
  // empty level 1 copies of tinctures. Of a name's copies, keep the ones
  // that drop highest, and among those one per distinct implicit. Bases that
  // really are several items under one name (the three Two-Toned Boots)
  // survive, because their implicits differ.
  const implicitOf = (id) => (bases[id].implicits ?? []).map((mod) => mods[mod]?.text ?? '').join('|');
  const byName = new Map();
  for (const set of tagsets) {
    for (const id of set.ids) {
      if (!byName.has(bases[id].name)) byName.set(bases[id].name, []);
      byName.get(bases[id].name).push({ id, size: set.ids.length });
    }
  }
  const dropped = new Set();
  for (const copies of byName.values()) {
    if (copies.length < 2) continue;
    const top = Math.max(...copies.map((copy) => bases[copy.id].drop_level));
    const seen = new Set();
    copies.sort((a, b) => b.size - a.size);
    for (const copy of copies) {
      const implicit = implicitOf(copy.id);
      if (bases[copy.id].drop_level < top || seen.has(implicit)) dropped.add(copy.id);
      else seen.add(implicit);
    }
  }
  for (const set of tagsets) set.ids = set.ids.filter((id) => !dropped.has(id));
  for (let i = tagsets.length - 1; i >= 0; i -= 1) if (tagsets[i].ids.length === 0) tagsets.splice(i, 1);
  // 2. Tag sets with the same prefix and suffix pool are one "pool" for the reader.
  const signature = (set) => JSON.stringify([set.mods.prefix ?? {}, set.mods.suffix ?? {}]);
  const pools = [];
  for (const set of tagsets) {
    const sig = signature(set);
    let pool = pools.find((p) => p.sig === sig);
    if (!pool) pools.push((pool = { sig, sets: [] }));
    pool.sets.push(set);
  }
  const common = tagsets.length ? tagsets.map((s) => s.tags).reduce((a, b) => a.filter((t) => b.includes(t))) : [];
  // A pool needs a name a person can say. Armour is named by its attribute;
  // a pool of one base by that base; the biggest of the rest is "standard";
  // anything else by the tag that sets it apart.
  const used = new Set();
  const size = (pool) => pool.sets.reduce((n, set) => n + set.ids.length, 0);
  const biggest = Math.max(...pools.map(size));
  const tidy = (tag) =>
    /minion/.test(tag) ? 'minion' : tag === 'experimental_base' ? 'experimented' : tag.replace(/_flask$|^abyss_jewel_|^expansion_jewel_/g, '').replace(/_/g, '-');
  for (const pool of pools) {
    const tags = pool.sets.map((s) => s.tags).reduce((a, b) => a.filter((t) => b.includes(t)));
    const own = tags.filter((t) => !common.includes(t) && !['not_for_sale', 'top_tier_base_item_type'].includes(t));
    const attr = ATTR.find((t) => tags.includes(t))?.replace('_armour', '');
    const firstBase = slug(bases[pool.sets[0].ids[0]].name);
    let id;
    if (pools.length === 1) id = 'all';
    else if (attr) id = attr;
    else if (size(pool) === 1) id = firstBase;
    else if (size(pool) === biggest && !used.has('standard')) id = 'standard';
    else id = own.length ? tidy(own[0]) : firstBase;
    if (used.has(id)) id = id + '-' + (own.filter((t) => !ATTR.includes(t)).map(tidy)[0] ?? firstBase);
    used.add(id);
    pool.id = id;
    pool.tags = own;
  }
  const poolIds = pools.map((p) => p.id);
  const poolOfBase = new Map();
  for (const pool of pools) for (const set of pool.sets) for (const id of set.ids) poolOfBase.set(id, pool.id);

  const baseList = [...poolOfBase.keys()]
    .map((id) => ({ ...describeBase(id, bases[id]), pool: poolOfBase.get(id) }))
    .sort((a, b) => a.class.localeCompare(b.class) || a.pool.localeCompare(b.pool) || a.dropLevel - b.dropLevel || a.name.localeCompare(b.name));

  // 3. Modifier ladders. The first tag set of a pool speaks for the pool.
  const gen = (name) => ladders(pools.map((pool) => [pool.id, pool.sets[0].mods[name]]), poolIds);
  const out = {
    id: category.id,
    group: category.group,
    classes: category.classes,
    pools: pools.map((pool) => ({
      id: pool.id,
      tags: pool.tags,
      bases: pool.sets.reduce((n, set) => n + set.ids.length, 0),
    })),
    bases: baseList,
    prefix: gen('prefix'),
    suffix: gen('suffix'),
    influence: Object.entries(INFLUENCES)
      .map(([key, id]) => ({ id, prefix: gen('prefix_' + key), suffix: gen('suffix_' + key) }))
      .filter((inf) => inf.prefix.length + inf.suffix.length > 0),
    delve: { prefix: gen('delve_prefix'), suffix: gen('delve_suffix') },
    // Embers and Ichors name four item classes in their own text. The export
    // carries Eldritch implicit weights for amulets too; nothing applies them.
    eldritch: ['helmets', 'body-armours', 'gloves', 'boots'].includes(category.id)
      ? { exarch: unconditional(gen('searing_exarch_implicit')), eater: unconditional(gen('eater_of_worlds_implicit')) }
      : { exarch: [], eater: [] },
    corrupted: gen('corrupted'),
  };

  // 4. Essences: the modifier each one guarantees on these classes.
  out.essences = [];
  const byEssence = new Map();
  for (const [id, essence] of Object.entries(essences)) {
    const base = bases[id];
    if (!base || base.release_state !== 'released') continue;
    for (const cls of category.classes) {
      const mod = mods[essence.mods?.[cls]];
      if (!mod) continue;
      const family = base.name.replace(/^(Whispering|Muttering|Weeping|Wailing|Screaming|Shrieking|Deafening) /, '');
      const key = family + '|' + cls;
      if (!byEssence.has(key)) byEssence.set(key, { essence: family, class: cls, tiers: [] });
      byEssence.get(key).tiers.push({
        name: base.name,
        level: essence.level,
        // The four weakest strengths cap the level of the OTHER modifiers they roll.
        capsOtherModsAt: essence.item_level_restriction ?? undefined,
        affix: mod.generation_type,
        text: lines(mod.text),
        corruptionOnly: essence.type?.is_corruption_only || undefined,
      });
    }
  }
  for (const entry of byEssence.values()) {
    entry.tiers.sort((a, b) => b.level - a.level);
    out.essences.push(entry);
  }
  out.essences.sort((a, b) => a.essence.localeCompare(b.essence) || a.class.localeCompare(b.class));

  // 5. Crafting bench: every modifier the bench can add to these classes.
  const benchFamilies = new Map();
  for (const option of bench) {
    const modId = option.actions?.add_explicit_mod;
    if (!modId || !option.item_classes.some((cls) => category.classes.includes(cls))) continue;
    const mod = mods[modId];
    if (!mod) continue;
    const key = mod.type + '|' + option.item_classes.filter((cls) => category.classes.includes(cls)).join(',');
    if (!benchFamilies.has(key)) {
      benchFamilies.set(key, { key: mod.type, group: mod.groups[0], affix: mod.generation_type, label: labelOf(mod.text), master: option.master, tiers: [] });
      if (category.classes.length > 1) benchFamilies.get(key).classes = option.item_classes.filter((cls) => category.classes.includes(cls));
    }
    benchFamilies.get(key).tiers.push({
      rank: option.bench_tier,
      text: lines(mod.text),
      cost: Object.entries(option.cost).map(([id, n]) => ({ currency: currencyName(id), n })),
    });
  }
  out.bench = [...benchFamilies.values()].map((family) => {
    family.tiers.sort((a, b) => b.rank - a.rank);
    return family;
  });
  out.bench.sort((a, b) => a.affix.localeCompare(b.affix) || a.label.localeCompare(b.label));

  // 6. Veiled modifiers that can be unveiled on these classes.
  const allTags = new Set(tagsets.flatMap((set) => set.tags));
  const spawns = (mod) => {
    for (const { tag, weight } of mod.spawn_weights) if (allTags.has(tag) || tag === 'default') return weight > 0;
    return false;
  };
  const veiled = new Map();
  for (const mod of Object.values(mods)) {
    if (mod.domain !== 'unveiled' || !['prefix', 'suffix'].includes(mod.generation_type) || !spawns(mod)) continue;
    const key = mod.type;
    if (!veiled.has(key)) veiled.set(key, { key, group: mod.groups[0], affix: mod.generation_type, tiers: [] });
    veiled.get(key).tiers.push({ name: mod.name, ilvl: mod.required_level, text: lines(mod.text) });
  }
  out.veiled = [...veiled.values()].map((family) => {
    family.tiers.sort((a, b) => b.ilvl - a.ilvl);
    family.label = labelOf(family.tiers[0].text.join('\n'));
    return family;
  });
  out.veiled.sort((a, b) => a.affix.localeCompare(b.affix) || a.label.localeCompare(b.label));
  if (category.id === 'cluster-jewels') out.cluster = buildCluster();
  return out;
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------
async function fetchIcons(categories) {
  const { default: sharp } = await import('sharp');
  mkdirSync(ICON_DIR, { recursive: true });
  const manifestFile = join(OUT, 'icons.json');
  const manifest = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, 'utf8')) : {};
  const wanted = new Map();
  for (const category of categories) for (const base of category.bases) if (base.art) wanted.set(base.art, base);
  const todo = [...wanted.keys()].filter((art) => !manifest[art] || !existsSync(join('public', manifest[art].file)));
  console.log('icons: ' + wanted.size + ' distinct, ' + todo.length + ' to download');
  let failed = 0;
  const worker = async () => {
    for (;;) {
      const art = todo.pop();
      if (!art) return;
      const name = slug(art.replace(/^Art\/2DItems\//, '').replace(/\.dds$/, ''));
      const file = 'img/bases/' + name + '.webp';
      try {
        const res = await fetch('https://web.poecdn.com/image/' + art.replace(/\.dds$/, '.png'), { headers: { 'User-Agent': UA } });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const [w, h] = wanted.get(art).size;
        // 39px per inventory cell at 2x: sharp on a phone, small on disk.
        const image = sharp(Buffer.from(await res.arrayBuffer())).resize({ width: w * 78, height: h * 78, fit: 'inside', withoutEnlargement: true });
        const info = await image.webp({ quality: 82 }).toFile(join('public', file));
        manifest[art] = { file, width: info.width, height: info.height };
      } catch (error) {
        failed += 1;
        console.warn('  icon failed: ' + art + ' (' + error.message + ')');
      }
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  writeFileSync(manifestFile, JSON.stringify(Object.fromEntries(Object.entries(manifest).sort()), null, 1) + '\n');
  if (failed) console.warn(failed + ' icons failed; run again to retry');
}

// ---------------------------------------------------------------------------
// Markdown digest, for people writing the guides
// ---------------------------------------------------------------------------
function digest(category) {
  const out = ['# ' + category.id + ' (' + category.classes.join(', ') + ')', ''];
  const poolIds = category.pools.map((p) => p.id);
  out.push('## Pools', ...category.pools.map((p) => '- `' + p.id + '`: ' + p.bases + ' bases' + (p.tags.length ? ' (tags: ' + p.tags.join(', ') + ')' : '')), '');
  out.push('## Bases', '', '| name | class | pool | drop lvl | req | stats | implicit | tags |', '|---|---|---|---|---|---|---|---|');
  for (const b of category.bases) {
    const stats = Object.entries(b.stats).map(([k, v]) => k + ' ' + (Array.isArray(v) ? v.join('-') : v)).join(', ');
    const req = Object.entries(b.req).map(([k, v]) => k.slice(0, 3) + ' ' + v).join(', ');
    const tags = b.tags.filter((t) => !/armour$|^default$/.test(t) && !category.classes.some((c) => slug(c) === slug(t))).join(' ');
    out.push('| ' + [b.name, b.class, b.pool, b.dropLevel, req, stats, b.implicits.join(' / '), tags].join(' | ') + ' |');
  }
  const total = (families, pool) =>
    families.reduce((sum, f) => sum + f.tiers.reduce((s, t) => s + (typeof t.weight === 'number' ? (f.on && !f.on.includes(pool) ? 0 : t.weight) : t.weight[pool] ?? 0), 0), 0);
  const table = (title, families, withShare) => {
    if (!families.length) return;
    out.push('', '## ' + title, '');
    const totals = Object.fromEntries(poolIds.map((p) => [p, total(families, p)]));
    for (const f of families) {
      const first = f.on ? f.on[0] : poolIds[0];
      const weight = f.tiers.reduce((s, t) => s + (typeof t.weight === 'number' ? t.weight : t.weight[first] ?? 0), 0);
      const share = withShare && totals[first] ? ' — ' + ((weight / totals[first]) * 100).toFixed(1) + '% of this side\'s weight' + (poolIds.length > 1 ? ' (pool ' + first + ')' : '') : '';
      out.push('- **' + f.label + '** [group ' + f.group + '; tags ' + (f.tags ?? []).join(',') + ']' + (f.on ? ' ONLY on pools: ' + f.on.join(', ') : '') + share);
      for (const t of f.tiers) {
        const w = typeof t.weight === 'number' ? t.weight : JSON.stringify(t.weight);
        out.push('  - T' + t.tier + ' "' + t.name + '" ilvl ' + t.ilvl + ': ' + t.text.join(' / ') + ' (weight ' + w + ')' + (t.essenceOnly ? ' ESSENCE ONLY' : ''));
      }
    }
  };
  table('Prefixes', category.prefix, true);
  table('Suffixes', category.suffix, true);
  for (const inf of category.influence) {
    table('Influence ' + inf.id + ' prefixes', inf.prefix, false);
    table('Influence ' + inf.id + ' suffixes', inf.suffix, false);
  }
  table('Delve (fossil-only) prefixes', category.delve.prefix, false);
  table('Delve (fossil-only) suffixes', category.delve.suffix, false);
  if (category.essences.length) {
    out.push('', '## Essences (guaranteed modifier per class)', '');
    for (const e of category.essences) {
      const top = e.tiers[0];
      const low = e.tiers[e.tiers.length - 1];
      const ladder = e.tiers.map((t) => t.name.split(' ')[0] + ': ' + t.text.join(' / ') + (t.capsOtherModsAt ? ' [other modifiers capped at level ' + t.capsOtherModsAt + '; Normal items only]' : '')).join(' | ');
      out.push('- ' + e.essence + ' on ' + e.class + ' (' + top.affix + '): ' + ladder + (top.corruptionOnly ? ' [corruption-only essence]' : ''));
    }
  }
  if (category.bench.length) {
    out.push('', '## Crafting bench', '');
    for (const f of category.bench) {
      out.push('- (' + f.affix + ') **' + f.label + '** [group ' + f.group + ']' + (f.classes ? ' classes: ' + f.classes.join(', ') : ''));
      for (const t of f.tiers) out.push('  - ' + t.text.join(' / ') + ' — cost ' + t.cost.map((c) => c.n + '× ' + c.currency).join(' + '));
    }
  }
  if (category.veiled.length) {
    out.push('', '## Veiled (unveiled) modifiers', '');
    for (const f of category.veiled) out.push('- (' + f.affix + ') ' + f.tiers.map((t) => t.text.join(' / ') + ' [ilvl ' + t.ilvl + ']').join(' | ') + ' [group ' + f.group + ']');
  }
  const implicitList = (title, families) => {
    if (!families.length) return;
    out.push('', '## ' + title, '');
    for (const f of families) out.push('- ' + f.label + ' — best: ' + f.tiers[0].text.join(' / ') + ' (' + f.tiers.length + ' tiers)');
  };
  implicitList('Searing Exarch implicits', category.eldritch.exarch);
  implicitList('Eater of Worlds implicits', category.eldritch.eater);
  implicitList('Corruption implicits (Vaal Orb)', category.corrupted);
  if (category.cluster) {
    const { sizes, enchants, mods: clusterMods } = category.cluster;
    out.push('', '## Cluster jewel sizes', '', ...sizes.map((s) => '- ' + s.base + ': ' + s.minSkills + '–' + s.maxSkills + ' added passive skills'));
    out.push('', '## Enchantments (the small passive a cluster jewel adds; fixed on the item, not a prefix or suffix)', '');
    for (const e of enchants) out.push('- `' + e.tag + '` "' + e.name + '" [' + e.sizes.join(', ') + ']: ' + e.text.join(' / '));
    out.push('', '## Notables (prefix or suffix; weight is per enchantment tag)', '');
    for (const m of clusterMods.filter((entry) => entry.notable)) {
      out.push('- (' + m.affix + ', ilvl ' + m.ilvl + ', group ' + m.group + ') ' + m.text.join(' / ') + ' — ' + Object.entries(m.weights).map(([tag, w]) => tag.replace('affliction_', '') + ' ' + w).join(', '));
    }
    out.push('', '## Enchant-specific small passive modifiers', '');
    for (const m of clusterMods.filter((entry) => !entry.notable)) {
      out.push('- (' + m.affix + ', ilvl ' + m.ilvl + ', group ' + m.group + ') ' + m.text.join(' / ') + ' — ' + Object.entries(m.weights).map(([tag, w]) => tag.replace('affliction_', '') + ' ' + w).join(', '));
    }
  }
  return out.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
const built = CATEGORIES.map(buildCategory);
if (wantIcons) await fetchIcons(built);
const icons = existsSync(join(OUT, 'icons.json')) ? JSON.parse(readFileSync(join(OUT, 'icons.json'), 'utf8')) : {};
mkdirSync(OUT, { recursive: true });
const index = [];
for (const category of built) {
  for (const base of category.bases) {
    const icon = icons[base.art];
    if (icon) base.icon = icon;
    delete base.art;
  }
  writeFileSync(join(OUT, category.id + '.json'), JSON.stringify(category) + '\n');
  index.push({
    id: category.id,
    group: category.group,
    classes: category.classes,
    bases: category.bases.length,
    pools: category.pools.length,
    prefixes: category.prefix.length,
    suffixes: category.suffix.length,
  });
  console.log(category.id.padEnd(16) + ' bases ' + String(category.bases.length).padStart(3) + '  pools ' + String(category.pools.length).padStart(2) + '  prefix ' + String(category.prefix.length).padStart(3) + '  suffix ' + String(category.suffix.length).padStart(3) + '  bench ' + String(category.bench.length).padStart(3) + '  essences ' + String(category.essences.length).padStart(3) + '  veiled ' + category.veiled.length);
  if (digestDir) {
    mkdirSync(digestDir, { recursive: true });
    writeFileSync(join(digestDir, category.id + '.md'), digest(category));
  }
}
writeFileSync(join(OUT, 'index.json'), JSON.stringify(index, null, 1) + '\n');
