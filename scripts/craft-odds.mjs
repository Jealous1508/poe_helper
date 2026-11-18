// Odds of rolling a modifier, from the weights in src/data/crafting.
//
//   node scripts/craft-odds.mjs two-hand-maces --ilvl 83
//   node scripts/craft-odds.mjs helmets --pool int --ilvl 84 --side prefix
//   node scripts/craft-odds.mjs two-hand-maces --ilvl 83 --fossil "Jagged Fossil"
//   node scripts/craft-odds.mjs rings --ilvl 84 --find "maximum Life"
//
// For each modifier family it prints the chance that ONE random modifier on
// that side is from the family, and the chance that it is Tier 1, Tier 2 or
// better, Tier 3 or better. That is the right number for an Orb of
// Augmentation, an Exalted Orb, or one slot of a reforge. It is not the chance
// that a whole Chaos Orb or Essence result contains the modifier: a rare gets
// several rolls, and a modifier already on the item removes its group from
// the next roll. Say which one you mean when you quote a figure.
//
// Fossils multiply weights by tag (the game data gives the multipliers). A
// modifier with several matching tags is multiplied once per matching entry,
// which is how the community tools model it; treat the result as close, not
// exact.
import { existsSync, readFileSync } from 'node:fs';

const [category, ...rest] = process.argv.slice(2);
const opt = (name, fallback) => (rest.includes('--' + name) ? rest[rest.indexOf('--' + name) + 1] : fallback);
if (!category || !existsSync('src/data/crafting/' + category + '.json')) {
  console.error('usage: node scripts/craft-odds.mjs <category> [--pool id] [--ilvl n] [--side prefix|suffix] [--fossil "A Fossil,B Fossil"] [--find text]');
  process.exit(2);
}
const data = JSON.parse(readFileSync('src/data/crafting/' + category + '.json', 'utf8'));
const pool = opt('pool', data.pools[0].id);
if (!data.pools.some((p) => p.id === pool)) {
  console.error('pool must be one of: ' + data.pools.map((p) => p.id).join(', '));
  process.exit(2);
}
const ilvl = Number(opt('ilvl', 100));
const find = opt('find', '').toLowerCase();
const sides = opt('side') ? [opt('side')] : ['prefix', 'suffix'];

const multipliers = [];
const fossilNames = opt('fossil', '').split(',').map((s) => s.trim()).filter(Boolean);
if (fossilNames.length) {
  const fossils = Object.values(JSON.parse(readFileSync('.cache/repoe/fossils.json', 'utf8')));
  for (const name of fossilNames) {
    const fossil = fossils.find((f) => f.name === name);
    if (!fossil) {
      console.error('unknown fossil "' + name + '"');
      process.exit(2);
    }
    for (const entry of [...fossil.positive_mod_weights, ...fossil.negative_mod_weights]) multipliers.push({ tag: entry.tag, factor: entry.weight / 100 });
  }
}

const weightOf = (family, tier) => {
  if (family.on && !family.on.includes(pool)) return 0;
  if (tier.ilvl > ilvl || tier.essenceOnly) return 0;
  let weight = typeof tier.weight === 'number' ? tier.weight : (tier.weight[pool] ?? 0);
  for (const { tag, factor } of multipliers) if (family.tags.includes(tag)) weight *= factor;
  return weight;
};
const pct = (x) => (x * 100 >= 10 ? (x * 100).toFixed(1) : (x * 100).toFixed(2)) + '%';
const oneIn = (x) => (x > 0 ? '1 in ' + (1 / x >= 10 ? Math.round(1 / x) : (1 / x).toFixed(1)) : 'never');

console.log(category + ' · pool ' + pool + ' · item level ' + ilvl + (fossilNames.length ? ' · ' + fossilNames.join(' + ') : ''));
for (const side of sides) {
  const families = data[side].map((family) => ({ family, weights: family.tiers.map((tier) => weightOf(family, tier)) }));
  const total = families.reduce((sum, f) => sum + f.weights.reduce((a, b) => a + b, 0), 0);
  console.log('\n' + side.toUpperCase() + ' — total weight ' + total);
  families
    .map((f) => ({ ...f, sum: f.weights.reduce((a, b) => a + b, 0) }))
    .filter((f) => f.sum > 0 && (!find || f.family.label.toLowerCase().includes(find)))
    .sort((a, b) => b.sum - a.sum)
    .forEach(({ family, weights, sum }) => {
      // Tiers the item level cannot reach are left out, so "best" means best reachable.
      const reachable = weights.map((w, i) => ({ w, tier: family.tiers[i] })).filter((entry) => entry.w > 0);
      const upTo = (n) => reachable.slice(0, n).reduce((a, entry) => a + entry.w, 0) / total;
      const best = reachable[0].tier;
      console.log(
        '  ' + pct(sum / total).padStart(6) + '  ' + family.label +
          '\n          best reachable T' + best.tier + ' "' + best.name + '" (' + best.text.join(' / ') + '): ' + pct(upTo(1)) + ' = ' + oneIn(upTo(1)) +
          (reachable.length > 1 ? ' · top two: ' + pct(upTo(2)) + ' = ' + oneIn(upTo(2)) : '') +
          (reachable.length > 2 ? ' · top three: ' + pct(upTo(3)) + ' = ' + oneIn(upTo(3)) : ''),
      );
    });
}
