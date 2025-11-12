export function computeLogitDemand({
  priceA,
  priceB,
  config
}) {
  const { marketSize, alpha, sigma } = config;
  // Add delta (constant utility term) - fixed at 10
  const delta = 10;
  const utilityA = delta - alpha * priceA;
  const utilityB = delta - alpha * priceB;
  const expA = Math.exp(utilityA / sigma);
  const expB = Math.exp(utilityB / sigma);
  const expOutside = 1; // Outside option has utility normalized to 0, so exp(0) = 1
  const denom = expA + expB + expOutside;
  const shareA = denom === 0 ? 0 : expA / denom;
  const shareB = denom === 0 ? 0 : expB / denom;
  const demandA = marketSize * shareA;
  const demandB = marketSize * shareB;
  return {
    demandA,
    demandB,
    shareA,
    shareB
  };
}
