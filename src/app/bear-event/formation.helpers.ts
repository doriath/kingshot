export interface March {
  name: string;
  infantry: number;
  cavalry: number;
  archers: number;
  ratio: number;
}

export function formations(
  totalInfantry: number,
  totalCavalry: number,
  totalArchers: number,
  hasAmadeus: boolean,
  numMarches: number,
  damageRatio: number
): March[] {
  const result: March[] = [];
  const troopTypes = [
    { name: 'Infantry', total: totalInfantry, count: 0 },
    { name: 'Cavalry', total: totalCavalry, count: 0 },
    { name: 'Archers', total: totalArchers, count: 0 },
  ].filter(t => t.total > 0);

  if (troopTypes.length === 0 || numMarches === 0) {
    return [];
  }

  let marchesLeft = numMarches;
  let typeIndex = 0;
  while (marchesLeft > 0) {
    troopTypes[typeIndex % troopTypes.length].count++;
    marchesLeft--;
    typeIndex++;
  }

  const totalTroops = totalInfantry + totalCavalry + totalArchers;

  troopTypes.forEach(type => {
    if (type.count > 0) {
      const troopsPerMarch = Math.floor(type.total / type.count);
      let remainingTroops = type.total;
      for (let i = 1; i <= type.count; i++) {
        const marchTroops = i === type.count ? remainingTroops : troopsPerMarch;
        remainingTroops -= marchTroops;

        const march: March = {
          name: `${type.name} March ${i}`,
          infantry: 0,
          cavalry: 0,
          archers: 0,
          ratio: totalTroops > 0 ? marchTroops / totalTroops : 0,
        };

        if (type.name === 'Infantry') march.infantry = marchTroops;
        if (type.name === 'Cavalry') march.cavalry = marchTroops;
        if (type.name === 'Archers') march.archers = marchTroops;

        result.push(march);
      }
    }
  });

  return result;
}
