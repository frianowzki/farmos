export type PositionLike = {
  size: number;
  entryPrice: number;
  exitPrice: number | null;
  currentPrice: number | null;
  status: string;
};

export type ProjectMoneyLike = {
  costSpent: number;
  capitalDeployed: number;
  rewardsReceived: number;
};

export type PositionPnl = {
  costBasis: number;
  value: number | null;
  realized: number;
  unrealized: number;
  roi: number | null;
};

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export function positionPnl(p: PositionLike): PositionPnl {
  const size = n(p.size);
  const costBasis = size * n(p.entryPrice);
  if (p.status === "closed") {
    const exit = p.exitPrice == null ? n(p.entryPrice) : n(p.exitPrice);
    const realized = size * exit - costBasis;
    return { costBasis, value: size * exit, realized, unrealized: 0, roi: costBasis > 0 ? realized / costBasis : null };
  }
  if (p.currentPrice == null) {
    return { costBasis, value: null, realized: 0, unrealized: 0, roi: null };
  }
  const value = size * n(p.currentPrice);
  const unrealized = value - costBasis;
  return { costBasis, value, realized: 0, unrealized, roi: costBasis > 0 ? unrealized / costBasis : null };
}

export type ProjectPnl = {
  invested: number;
  positionsCost: number;
  realized: number;
  unrealized: number;
  net: number;
  roi: number | null;
  openPositions: number;
  closedPositions: number;
};

/**
 * Money model:
 * - invested  = gas/fees spent + capital deployed outside positions + cost basis of every position
 * - realized  = rewards received + closed-position PnL
 * - unrealized = open-position PnL (only positions with a current price)
 * - net       = realized + unrealized − gas/fees spent
 * - ROI       = net / invested (null when nothing invested)
 */
export function projectPnl(project: ProjectMoneyLike, positions: PositionLike[]): ProjectPnl {
  let positionsCost = 0;
  let closedPnl = 0;
  let unrealized = 0;
  let openPositions = 0;
  let closedPositions = 0;
  for (const p of positions) {
    const r = positionPnl(p);
    positionsCost += r.costBasis;
    closedPnl += r.realized;
    unrealized += r.unrealized;
    if (p.status === "closed") closedPositions++;
    else openPositions++;
  }
  const cost = n(project.costSpent);
  const invested = cost + n(project.capitalDeployed) + positionsCost;
  const realized = n(project.rewardsReceived) + closedPnl;
  const net = realized + unrealized - cost;
  return {
    invested,
    positionsCost,
    realized,
    unrealized,
    net,
    roi: invested > 0 ? net / invested : null,
    openPositions,
    closedPositions,
  };
}

export function sumPnl(list: ProjectPnl[]): ProjectPnl {
  const t = list.reduce(
    (a, b) => ({
      invested: a.invested + b.invested,
      positionsCost: a.positionsCost + b.positionsCost,
      realized: a.realized + b.realized,
      unrealized: a.unrealized + b.unrealized,
      net: a.net + b.net,
      roi: null,
      openPositions: a.openPositions + b.openPositions,
      closedPositions: a.closedPositions + b.closedPositions,
    }),
    { invested: 0, positionsCost: 0, realized: 0, unrealized: 0, net: 0, roi: null, openPositions: 0, closedPositions: 0 } as ProjectPnl,
  );
  t.roi = t.invested > 0 ? t.net / t.invested : null;
  return t;
}
