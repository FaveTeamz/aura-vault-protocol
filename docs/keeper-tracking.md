# Keeper Tracking

## Overview
The keeper tracking system tracks which keeper triggered each harvest so that an off-chain rewards system can fairly compensate keepers.

## Architecture

### Data Storage

#### KeeperStats
```solidity
struct KeeperStats {
    uint256 totalHarvests;
    uint256 totalYieldInjected;
    uint256 lastHarvestTimestamp;
    uint256 lastHarvestAmount;
}
struct HarvestRecord {
    address keeper;
    uint256 yieldAmount;
    uint256 timestamp;
    uint256 blockNumber;
    bytes32 txHash;
}
event HarvestTriggered(
    address indexed keeper,
    uint256 yieldAmount,
    uint256 totalHarvests,
    uint256 totalYieldInjected
);
event KeeperStatsUpdated(
    address indexed keeper,
    uint256 totalHarvests,
    uint256 totalYieldInjected
);
const events = await contract.queryFilter("HarvestTriggered", fromBlock, toBlock);
const leaderboard = new Map();

for (const event of events) {
    const keeper = event.args.keeper;
    const yieldAmount = event.args.yieldAmount;
    
    if (!leaderboard.has(keeper)) {
        leaderboard.set(keeper, { totalHarvests: 0, totalYield: 0 });
    }
    
    const stats = leaderboard.get(keeper);
    stats.totalHarvests++;
    stats.totalYield += yieldAmount;
}

// Sort by totalYield descending
const sorted = Array.from(leaderboard.entries())
    .sort((a, b) => b[1].totalYield - a[1].totalYield);
