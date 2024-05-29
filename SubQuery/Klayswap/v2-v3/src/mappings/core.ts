// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Bundle, Burn, Factory, Mint, Pool, Swap, Tick, Token, V2Pool } from "../types";
import {
  FACTORY_ADDRESS,
  ONE_BI,
  ZERO_BI,
  convertTokenToDecimal,
  loadTransaction,
  findKlayPerToken,
  getklayPriceinUSD,
  getTrackedAmountUSD,
  sqrtPriceX96ToTokenPrices,
  updatePoolDayData,
  updatePoolHourData,
  updatePoolMinData,
  updateTickDayData,
  updateTokenDayData,
  updateTokenHourData,
  updateTokenMinData,
  updateUniswapDayData,
  createTick,
  feeTierToTickSpacing,
  safeDivNum,
  ZERO_BD,
} from "./utils";
import { EthereumLog } from "@subql/types-ethereum";
import { BigNumber } from "@ethersproject/bignumber";
import {
  BurnEvent,
  FlashEvent,
} from "../types/contracts/Pool";
import { Pool__factory } from "../types/contracts/factories/Pool__factory";
import assert from "assert";
import {InitializeLog, MintLog, SwapLog} from "../types/abi-interfaces/Pool";
import { AddLiquidityLog, ExchangeNegLog, ExchangePosLog, RemoveLiquidityLog } from "../types/abi-interfaces/V2pool";
import { V2pool__factory } from "../types/contracts";

export async function handleInitialize(
  event: InitializeLog
): Promise<void> {
  const [pool, klayPrice] = await Promise.all([
    Pool.get(event.address),
    getklayPriceinUSD(),
  ]);
  assert(pool);
  assert(event.args);
  pool.sqrtPrice = event.args.sqrtPriceX96.toBigInt();
  pool.tick = BigNumber.from(event.args.tick).toBigInt();
  assert(pool.token0Id);
  assert(pool.token1Id);

  // update token prices
  const [token0, token1] = await Promise.all([
    Token.get(pool.token0Id),
    Token.get(pool.token1Id),
  ]);
  const bundle = await Bundle.get("1");
  assert(bundle);
  bundle.klayPriceUSD = klayPrice;

  await Promise.all([updatePoolDayData(event), updatePoolHourData(event), updatePoolMinData(event)]);
  assert(token0);
  assert(token1);
  const [derivedKLAY0, derivedKLAY1] = await Promise.all([
    findKlayPerToken(token0),
    findKlayPerToken(token1),
  ]);

  // update token prices
  token0.derivedKLAY = derivedKLAY0;
  token1.derivedKLAY = derivedKLAY1;

  await Promise.all([pool.save(), bundle.save(), token0.save(), token1.save()]);
  // update KLAY price now that prices could have changed
}

export async function handleMint(
  event: MintLog
): Promise<void> {

  const poolAddress = event.address;
  const pool = await Pool.get(poolAddress);

  if (pool === undefined || pool === null) {
    logger.warn(
      `Could not get pool address ${poolAddress} for mint at transaction ${event.transactionHash}, log id ${event.logIndex}`
    );
    return;
  }

  assert(pool.token0Id);
  assert(pool.token1Id);
  const [bundle, factory, token0, token1, transaction] = await Promise.all([
    Bundle.get("1"),
    Factory.get(FACTORY_ADDRESS),
    Token.get(pool.token0Id),
    Token.get(pool.token1Id),
    loadTransaction(event),
  ]);

  assert(event.args);
  assert(token0);
  assert(token1);
  assert(bundle);
  const amount0 = convertTokenToDecimal(event.args.amount0, token0.decimals);
  const amount1 = convertTokenToDecimal(event.args.amount1, token1.decimals);

  const amountUSD =
    amount0 * (token0.derivedKLAY * bundle.klayPriceUSD) +
    amount1 * (token1.derivedKLAY * bundle.klayPriceUSD);

  assert(factory);
  // reset tvl aggregates until new amounts calculated
  factory.totalValueLockedKLAY =
    factory.totalValueLockedKLAY - pool.totalValueLockedKLAY;

  // update globals
  factory.txCount = factory.txCount + ONE_BI;

  // update token0 data
  token0.txCount = token0.txCount + ONE_BI;
  token0.totalValueLocked = token0.totalValueLocked + amount0;
  token0.totalValueLockedUSD =
    token0.totalValueLocked * token0.derivedKLAY * bundle.klayPriceUSD;

  // update token1 data
  token1.txCount = token1.txCount + ONE_BI;
  token1.totalValueLocked = token1.totalValueLocked + amount1;
  token1.totalValueLockedUSD =
    token1.totalValueLocked * token1.derivedKLAY * bundle.klayPriceUSD;

  // pool data
  pool.txCount = pool.txCount + ONE_BI;

  // Pools liquidity tracks the currently active liquidity given pools current tick.
  // We only want to update it on mint if the new position includes the current tick.
  if (
    pool.tick !== undefined &&
    BigNumber.from(event.args.tickLower).lte(pool.tick) &&
    BigNumber.from(event.args.tickUpper).gt(pool.tick)
  ) {
    pool.liquidity = pool.liquidity + event.args.amount.toBigInt();
  }

  pool.totalValueLockedToken0 =
    pool.totalValueLockedToken0 + amount0;
  pool.totalValueLockedToken1 =
    pool.totalValueLockedToken1 + amount1;
  pool.totalValueLockedKLAY =
    pool.totalValueLockedToken0 * token0.derivedKLAY +
    pool.totalValueLockedToken1 * token1.derivedKLAY;
  pool.totalValueLockedUSD = pool.totalValueLockedKLAY + bundle.klayPriceUSD;

  // reset aggregates with new amounts
  factory.totalValueLockedKLAY =
    factory.totalValueLockedKLAY + pool.totalValueLockedKLAY;
  factory.totalValueLockedUSD =
    factory.totalValueLockedKLAY + bundle.klayPriceUSD;

  const mint = Mint.create({
    id: transaction.id.toString() + "#" + pool.txCount.toString(),
    transactionId: transaction.id,
    timestamp: transaction.timestamp,
    poolId: pool.id,
    token0Id: pool.token0Id,
    token1Id: pool.token1Id,
    owner: event.args.owner,
    sender: event.args.sender,
    origin: event.transaction.from,
    amount: event.args.amount.toBigInt(),
    amount0: amount0,
    amount1: amount1,
    amountUSD: amountUSD,
    tickLower: BigInt(event.args.tickLower),
    tickUpper: BigInt(event.args.tickUpper),
    logIndex: BigInt(event.logIndex),
  });

  // tick entities
  const lowerTickIdx = event.args.tickLower;
  const upperTickIdx = event.args.tickUpper;
  const lowerTickId = poolAddress + "#" + event.args.tickLower;
  const upperTickId = poolAddress + "#" + event.args.tickUpper;

  let [lowerTick, upperTick] = await Promise.all([
    Tick.get(lowerTickId),
    Tick.get(upperTickId),
  ]);

  if (lowerTick === null || lowerTick === undefined) {
    lowerTick = createTick(lowerTickId, lowerTickIdx, pool.id, event);
  }

  if (upperTick === null || upperTick === undefined) {
    upperTick = createTick(upperTickId, upperTickIdx, pool.id, event);
  }

  const amount = event.args.amount;
  lowerTick.liquidityGross = lowerTick.liquidityGross + amount.toBigInt();
  lowerTick.liquidityNet = lowerTick.liquidityNet + amount.toBigInt();
  upperTick.liquidityGross = upperTick.liquidityGross + amount.toBigInt();
  upperTick.liquidityNet = upperTick.liquidityNet - amount.toBigInt();

  // TODO: Update Tick's volume, fees, and liquidity provider count. Computing these on the tick
  // level requires reimplementing some of the swapping code from v3-core.

  await Promise.all([
    updateUniswapDayData(event),
    updatePoolDayData(event),
    updatePoolHourData(event),
    updatePoolMinData(event),
    updateTokenDayData(token0, event),
    updateTokenDayData(token1, event),
    updateTokenHourData(token0, event),
    updateTokenHourData(token1, event),
    updateTokenMinData(token0, event),
    updateTokenMinData(token1, event),

    token0.save(),
    token1.save(),
    pool.save(),
    factory.save(),
    mint.save(),

    // Update inner tick vars and save the ticks
    updateTickFeeVarsAndSave(lowerTick, event),
    updateTickFeeVarsAndSave(upperTick, event),
  ]);
}

export async function handleBurn(
  event: EthereumLog<BurnEvent["args"]>
): Promise<void> {
  const poolAddress = event.address;
  const pool = await Pool.get(poolAddress);
  assert(pool?.token0Id);
  assert(pool?.token1Id);

  const [bundle, factory, token0, token1, transaction] = await Promise.all([
    Bundle.get("1"),
    Factory.get(FACTORY_ADDRESS),
    Token.get(pool.token0Id),
    Token.get(pool.token1Id),
    loadTransaction(event),
  ]);
  assert(event.args);
  assert(token0);
  assert(token1);

  const amount0 = convertTokenToDecimal(event.args.amount0, token0.decimals);
  const amount1 = convertTokenToDecimal(event.args.amount1, token1.decimals);
  assert(bundle);

  const amountUSD =
    amount0 * token0.derivedKLAY * bundle.klayPriceUSD +
    amount1 * token1.derivedKLAY * bundle.klayPriceUSD;

  assert(factory);
  // reset tvl aggregates until new amounts calculated
  factory.totalValueLockedKLAY =
    factory.totalValueLockedKLAY - pool.totalValueLockedKLAY;

  // update globals
  factory.txCount = factory.txCount + ONE_BI;

  // update token0 data
  token0.txCount = token0.txCount + ONE_BI;
  token0.totalValueLocked = token0.totalValueLocked - amount0;
  token0.totalValueLockedUSD =
    token0.totalValueLocked * token0.derivedKLAY * bundle.klayPriceUSD;

  // update token1 data
  token1.txCount = token1.txCount + ONE_BI;
  token1.totalValueLocked = token1.totalValueLocked - amount1;
  token1.totalValueLockedUSD =
    token1.totalValueLocked * token1.derivedKLAY * bundle.klayPriceUSD;

  // pool data
  pool.txCount = pool.txCount + ONE_BI;
  // Pools liquidity tracks the currently active liquidity given pools current tick.
  // We only want to update it on burn if the position being burnt includes the current tick.
  if (
    pool.tick !== undefined &&
    BigNumber.from(event.args.tickLower).lte(pool.tick) &&
    BigNumber.from(event.args.tickUpper).gt(pool.tick)
  ) {
    pool.liquidity = pool.liquidity - event.args.amount.toBigInt();
  }

  pool.totalValueLockedToken0 =
    pool.totalValueLockedToken0 - amount0;
  pool.totalValueLockedToken1 =
    pool.totalValueLockedToken1 - amount1;
  pool.totalValueLockedKLAY =
    pool.totalValueLockedToken0 * token0.derivedKLAY +
    pool.totalValueLockedToken1 * token1.derivedKLAY;
  pool.totalValueLockedUSD = pool.totalValueLockedKLAY * bundle.klayPriceUSD;

  // reset aggregates with new amounts
  factory.totalValueLockedKLAY =
    factory.totalValueLockedKLAY * pool.totalValueLockedKLAY;
  factory.totalValueLockedUSD =
    factory.totalValueLockedKLAY * bundle.klayPriceUSD;

  // burn entity
  // const transaction = await loadTransaction(event)
  const burn = Burn.create({
    id: transaction.id + "#" + pool.txCount.toString(),
    transactionId: transaction.id,
    timestamp: transaction.timestamp,
    poolId: pool.id,
    token0Id: pool.token0Id,
    token1Id: pool.token1Id,
    owner: event.args.owner,
    origin: event.transaction.from,
    amount: event.args.amount.toBigInt(),
    amount0: amount0,
    amount1: amount1,
    amountUSD: amountUSD,
    tickLower: BigInt(event.args.tickLower),
    tickUpper: BigInt(event.args.tickUpper),
    logIndex: BigInt(event.logIndex),
  });

  // tick entities
  const lowerTickId = poolAddress + "#" + event.args.tickLower;
  const upperTickId = poolAddress + "#" + event.args.tickUpper;
  const [lowerTick, upperTick] = await Promise.all([
    Tick.get(lowerTickId),
    Tick.get(upperTickId),
  ]);
  const amount = event.args.amount;
  assert(lowerTick);
  assert(upperTick);
  lowerTick.liquidityGross = lowerTick.liquidityGross - amount.toBigInt();
  lowerTick.liquidityNet = lowerTick.liquidityNet - amount.toBigInt();
  upperTick.liquidityGross = upperTick.liquidityGross - amount.toBigInt();
  upperTick.liquidityNet = upperTick.liquidityNet + amount.toBigInt();

  await Promise.all([
    updateUniswapDayData(event),
    updatePoolDayData(event),
    updatePoolHourData(event),
    updatePoolMinData(event),
    updateTokenDayData(token0, event),
    updateTokenDayData(token1, event),
    updateTokenHourData(token0, event),
    updateTokenHourData(token1, event),
    updateTokenMinData(token0, event),
    updateTokenMinData(token1, event),
    updateTickFeeVarsAndSave(lowerTick, event),
    updateTickFeeVarsAndSave(upperTick, event),
    token0.save(),
    token1.save(),
    pool.save(),
    factory.save(),
    burn.save(),
  ]);
}

export async function handleSwap(
  event: SwapLog
): Promise<void> {
  const poolContract = Pool__factory.connect(event.address, api);
  const [
    bundle,
    factory,
    pool,
    transaction,
    klayPrice,
    feeGrowthGlobal0X128,
    feeGrowthGlobal1X128,
  ] = await Promise.all([
    Bundle.get("1"),
    Factory.get(FACTORY_ADDRESS),
    Pool.get(event.address),
    loadTransaction(event),
    getklayPriceinUSD(),
    poolContract.feeGrowthGlobal0X128(),
    poolContract.feeGrowthGlobal1X128(),
  ]);
  assert(pool);

  // hot fix for bad pricing
  if (pool.id == "0x9663f2ca0454accad3e094448ea6f77443880454") {
    return;
  }
  assert(pool.token0Id);
  assert(pool.token1Id);

  const [token0, token1] = await Promise.all([
    Token.get(pool.token0Id),
    Token.get(pool.token1Id),
  ]);
  const oldTick = pool.tick;
  assert(event.args);
  assert(token0);
  assert(token1);

  // amounts - 0/1 are token deltas: can be positive or negative
  const amount0 = convertTokenToDecimal(event.args.amount0, token0.decimals);
  const amount1 = convertTokenToDecimal(event.args.amount1, token1.decimals);

  // need absolute amounts for volume
  let amount0Abs = amount0;
  if (amount0 < 0) {
    amount0Abs = amount0 * (-1)
  }

  let amount1Abs = amount1;
  if (amount1 < 0) {
    amount1Abs = amount1 * (-1)
  }
  assert(bundle);

  const amount0KLAY = amount0Abs * token0.derivedKLAY;
  const amount1KLAY = amount1Abs * token1.derivedKLAY;
  const amount0USD = amount0KLAY * bundle.klayPriceUSD;
  const amount1USD = amount1KLAY * bundle.klayPriceUSD;

  // get amount that should be tracked only - div 2 because cant count both input and output as volume
  const amountTotalUSDTracked = (
    await getTrackedAmountUSD(amount0Abs, token0, amount1Abs, token1)
  ) / 2;
  const amountTotalKLAYTracked = safeDivNum(
    amountTotalUSDTracked,
    bundle.klayPriceUSD
  );
  const amountTotalUSDUntracked = (amount0USD+amount1USD)/2

  const feesKLAY = amountTotalKLAYTracked * Number(pool.feeTier) / 1000000
  const feesUSD = amountTotalUSDTracked * Number(pool.feeTier) / 1000000

  assert(factory);
  // global updates
  factory.txCount = factory.txCount + ONE_BI; //BigNumber.from(factory.txCount).add(ONE_BI).toBigInt()
  factory.totalVolumeKLAY =
    factory.totalVolumeKLAY + amountTotalKLAYTracked; //BigNumber.from(factory.totalVolumeKLAY).add(amountTotalKLAYTracked).toNumber()
  factory.totalVolumeUSD =
    factory.totalVolumeUSD + amountTotalUSDTracked; // BigNumber.from(factory.totalVolumeUSD).add(amountTotalUSDTracked).toNumber()
  factory.untrackedVolumeUSD =
    factory.untrackedVolumeUSD + amountTotalUSDUntracked; // BigNumber.from(factory.untrackedVolumeUSD).add(amountTotalUSDUntracked).toNumber()
  factory.totalFeesKLAY = factory.totalFeesKLAY + feesKLAY; // BigNumber.from(factory.totalFeesKLAY).add(feesKLAY).toNumber()
  factory.totalFeesUSD = factory.totalFeesUSD + feesUSD; // BigNumber.from(factory.totalFeesUSD).add(feesUSD).toNumber()

  // reset aggregate tvl before individual pool tvl updates
  // const currentPoolTvlKLAY = pool.totalValueLockedKLAY
  factory.totalValueLockedKLAY =
    factory.totalValueLockedKLAY - pool.totalValueLockedKLAY; //BigNumber.from(factory.totalValueLockedKLAY).sub(currentPoolTvlKLAY).toNumber()

  // pool volume
  pool.volumeToken0 = pool.volumeToken0 + amount0Abs; //BigNumber.from(pool.volumeToken0).add(amount0Abs).toNumber()
  pool.volumeToken1 = pool.volumeToken1 + amount1Abs; //BigNumber.from(pool.volumeToken1).add(amount1Abs).toNumber()
  pool.volumeUSD = pool.volumeUSD + amountTotalUSDTracked;
  pool.untrackedVolumeUSD =
    pool.untrackedVolumeUSD + amountTotalUSDUntracked;
  pool.feesUSD = pool.feesUSD + feesUSD; //BigNumber.from(pool.feesUSD).add(feesUSD).toNumber()
  pool.txCount = pool.txCount + ONE_BI; //BigNumber.from(pool.txCount).add(ONE_BI).toBigInt()

  // Update the pool with the new active liquidity, price, and tick.
  pool.liquidity = event.args.liquidity.toBigInt();
  pool.tick = BigInt(event.args.tick);
  pool.sqrtPrice = event.args.sqrtPriceX96.toBigInt();
  pool.totalValueLockedToken0 =
    pool.totalValueLockedToken0 + amount0; // BigNumber.from(pool.totalValueLockedToken0).add(amount0).toNumber()
  pool.totalValueLockedToken1 =
    pool.totalValueLockedToken1 + amount1; // BigNumber.from(pool.totalValueLockedToken1).add(amount1).toNumber()

  // update token0 data
  token0.volume = token0.volume + amount0Abs;
  token0.totalValueLocked = token0.totalValueLocked + amount0;
  token0.volumeUSD = token0.volumeUSD + amountTotalUSDTracked;
  token0.untrackedVolumeUSD =
    token0.untrackedVolumeUSD + amountTotalUSDUntracked;
  token0.feesUSD = token0.feesUSD + feesUSD;
  token0.txCount = token0.txCount + ONE_BI;

  // update token1 data
  token1.volume = token1.volume + amount1Abs;
  token1.totalValueLocked = token1.totalValueLocked + amount1;
  token1.volumeUSD = token1.volumeUSD + amountTotalUSDTracked;
  token1.untrackedVolumeUSD =
    token1.untrackedVolumeUSD + amountTotalUSDUntracked;
  token1.feesUSD = token1.feesUSD + feesUSD;
  token1.txCount = token1.txCount + ONE_BI;
  // updated pool ratess
  const prices = sqrtPriceX96ToTokenPrices(pool.sqrtPrice, token0, token1);

  pool.token0Price = prices[0];
  pool.token1Price = prices[1];

  // update USD pricing
  bundle.klayPriceUSD = klayPrice;

  const [derivedKLAY0, derivedKLAY1] = await Promise.all([
    findKlayPerToken(token0),
    findKlayPerToken(token1),
  ]);
  token0.derivedKLAY = derivedKLAY0;
  token1.derivedKLAY = derivedKLAY1;

  /**
   * Things afffected by new USD rates
   */

  pool.totalValueLockedKLAY =
    pool.totalValueLockedToken0 * token0.derivedKLAY +
    pool.totalValueLockedToken1 * token1.derivedKLAY;
  pool.totalValueLockedUSD = pool.totalValueLockedKLAY * bundle.klayPriceUSD;

  factory.totalValueLockedKLAY =
    factory.totalValueLockedKLAY + pool.totalValueLockedKLAY;
  factory.totalValueLockedUSD =
    factory.totalValueLockedKLAY * bundle.klayPriceUSD;

  token0.totalValueLockedUSD =
    token0.totalValueLocked * token0.derivedKLAY * bundle.klayPriceUSD;
  token1.totalValueLockedUSD =
    token1.totalValueLocked * token1.derivedKLAY * bundle.klayPriceUSD;

  // create Swap event
  // const transaction = await loadTransaction(event)
  const swap = Swap.create({
    id: transaction.id + "#" + pool.txCount.toString(),
    transactionId: transaction.id,
    timestamp: transaction.timestamp,
    poolId: pool.id,
    token0Id: pool.token0Id,
    token1Id: pool.token1Id,
    sender: event.args.sender,
    origin: event.transaction.from,
    recipient: event.args.recipient,
    amount0: amount0,
    amount1: amount1,
    amountUSD: amountTotalUSDTracked,
    tick: BigInt(event.args.tick),
    sqrtPriceX96: event.args.sqrtPriceX96.toBigInt(),
    logIndex: BigInt(event.logIndex),
  });

  // update fee growth
  pool.feeGrowthGlobal0X128 = feeGrowthGlobal0X128.toBigInt();
  pool.feeGrowthGlobal1X128 = feeGrowthGlobal1X128.toBigInt();

  // interval data
  const [
    uniswapDayData,
    poolDayData,
    poolHourData,
    poolMinData,
    token0DayData,
    token1DayData,
    token0HourData,
    token1HourData,
    token0MinData,
    token1MinData,
  ] = await Promise.all([
    updateUniswapDayData(event),
    updatePoolDayData(event),
    updatePoolHourData(event),
    updatePoolMinData(event),
    updateTokenDayData(token0, event),
    updateTokenDayData(token1, event),
    updateTokenHourData(token0, event),
    updateTokenHourData(token1, event),
    updateTokenMinData(token0, event),
    updateTokenMinData(token1, event),
  ]);

  // update volume metrics
  uniswapDayData.volumeKLAY =
    uniswapDayData.volumeKLAY + amountTotalKLAYTracked;
  uniswapDayData.volumeUSD =
    uniswapDayData.volumeUSD + amountTotalUSDTracked;
  uniswapDayData.feesUSD = uniswapDayData.feesUSD + feesUSD;

  poolDayData.volumeUSD =
    poolDayData.volumeUSD + amountTotalUSDTracked;
  poolDayData.volumeToken0 = poolDayData.volumeToken0 + amount0Abs;
  poolDayData.volumeToken1 = poolDayData.volumeToken1 + amount1Abs;
  poolDayData.feesUSD = poolDayData.feesUSD + feesUSD;

  poolHourData.volumeUSD =
    poolHourData.volumeUSD + amountTotalUSDTracked;
  poolHourData.volumeToken0 = poolHourData.volumeToken0 + amount0Abs;
  poolHourData.volumeToken1 = poolHourData.volumeToken1 + amount1Abs;
  poolHourData.feesUSD = poolHourData.feesUSD + feesUSD;

  poolMinData.volumeUSD =
    poolMinData.volumeUSD + amountTotalUSDTracked;
  poolMinData.volumeToken0 = poolMinData.volumeToken0 + amount0Abs;
  poolMinData.volumeToken1 = poolMinData.volumeToken1 + amount1Abs;
  poolMinData.feesUSD = poolMinData.feesUSD + feesUSD;


  token0DayData.volume = token0DayData.volume + amount0Abs;
  token0DayData.volumeUSD =
    token0DayData.volumeUSD + amountTotalUSDTracked;
  token0DayData.untrackedVolumeUSD =
    token0DayData.untrackedVolumeUSD + amountTotalUSDTracked;
  token0DayData.feesUSD = token0DayData.feesUSD + feesUSD;

  token0HourData.volume = token0HourData.volume + amount0Abs;
  token0HourData.volumeUSD =
    token0HourData.volumeUSD + amountTotalUSDTracked;
  token0HourData.untrackedVolumeUSD =
    token0HourData.untrackedVolumeUSD + amountTotalUSDTracked;
  token0HourData.feesUSD = token0HourData.feesUSD + feesUSD;

  token0MinData.volume = token0MinData.volume + amount0Abs;
  token0MinData.volumeUSD =
    token0MinData.volumeUSD + amountTotalUSDTracked;
  token0MinData.untrackedVolumeUSD =
    token0MinData.untrackedVolumeUSD + amountTotalUSDTracked;
  token0MinData.feesUSD = token0MinData.feesUSD + feesUSD;

  token1DayData.volume = token1DayData.volume + amount1Abs;
  token1DayData.volumeUSD =
    token1DayData.volumeUSD + amountTotalUSDTracked;
  token1DayData.untrackedVolumeUSD =
    token1DayData.untrackedVolumeUSD + amountTotalUSDTracked;
  token1DayData.feesUSD = token1DayData.feesUSD + feesUSD;

  token1HourData.volume = token1HourData.volume + amount1Abs;
  token1HourData.volumeUSD =
    token1HourData.volumeUSD + amountTotalUSDTracked;
  token1HourData.untrackedVolumeUSD =
    token1HourData.untrackedVolumeUSD + amountTotalUSDTracked;
  token1HourData.feesUSD = token1HourData.feesUSD + feesUSD;

  token1MinData.volume = token1MinData.volume + amount1Abs;
  token1MinData.volumeUSD =
    token1MinData.volumeUSD + amountTotalUSDTracked;
  token1MinData.untrackedVolumeUSD =
    token1MinData.untrackedVolumeUSD + amountTotalUSDTracked;
  token1MinData.feesUSD = token1MinData.feesUSD + feesUSD;

  
  await Promise.all([
    bundle.save(),
    swap.save(),
    token0DayData.save(),
    token1DayData.save(),
    uniswapDayData.save(),
    poolDayData.save(),
    token0HourData.save(),
    token1HourData.save(),
    poolHourData.save(),
    factory.save(),
    pool.save(),
    token0.save(),
    token1.save(),
  ]);

  // Update inner vars of current or crossed ticks
  const newTick = BigNumber.from(pool.tick);
  const tickSpacing = feeTierToTickSpacing(BigNumber.from(pool.feeTier));
  const modulo = newTick.mod(tickSpacing);
  if (modulo.eq(ZERO_BI)) {
    // Current tick is initialized and needs to be updated
    await loadTickUpdateFeeVarsAndSave(newTick.toString(), event);
  }

  const numIters = BigNumber.from(oldTick).sub(newTick).abs().div(tickSpacing);
  assert(oldTick !== null && oldTick !== undefined);

  if (numIters.gt(BigNumber.from(100))) {
    // In case more than 100 ticks need to be updated ignore the update in
    // order to avoid timeouts. From testing this behavior occurs only upon
    // pool initialization. This should not be a big issue as the ticks get
    // updated later. For early users this error also disappears when calling
    // collect
  } else if (newTick.gt(oldTick)) {
    const firstInitialized = BigNumber.from(oldTick).add(
      BigNumber.from(tickSpacing).add(modulo)
    );
    for (let i = firstInitialized; i.lte(newTick); i = i.add(tickSpacing)) {
      await loadTickUpdateFeeVarsAndSave(i.toString(), event);
    }
  } else if (newTick.lt(oldTick)) {
    const firstInitialized = BigNumber.from(oldTick).sub(modulo);
    for (let i = firstInitialized; i.gte(newTick); i = i.sub(tickSpacing)) {
      await loadTickUpdateFeeVarsAndSave(i.toString(), event);
    }
  }
}

export async function handleFlash(
  event: EthereumLog<FlashEvent["args"]>
): Promise<void> {
  // update fee growth
  const pool = await Pool.get(event.address);
  const poolContract = Pool__factory.connect(event.address, api);

  const [feeGrowthGlobal0X128, feeGrowthGlobal1X128] = await Promise.all([
    poolContract.feeGrowthGlobal0X128(),
    poolContract.feeGrowthGlobal1X128(),
  ]);
  assert(pool);
  pool.feeGrowthGlobal0X128 = feeGrowthGlobal0X128.toBigInt();
  pool.feeGrowthGlobal1X128 = feeGrowthGlobal1X128.toBigInt();
  await pool.save();
}

async function updateTickFeeVarsAndSave(
  tick: Tick,
  event: EthereumLog
): Promise<void> {
  const poolAddress = event.address;
  // not all ticks are initialized so obtaining null is expected behavior
  const poolContract = Pool__factory.connect(poolAddress, api);
  const tickResult = await poolContract.ticks(tick.tickIdx);
  tick.feeGrowthOutside0X128 = tickResult[2].toBigInt();
  tick.feeGrowthOutside1X128 = tickResult[3].toBigInt();
  await tick.save();

  await updateTickDayData(tick, event);
}

async function loadTickUpdateFeeVarsAndSave(
  tickId: string,
  event: EthereumLog
): Promise<void> {
  const poolAddress = event.address;
  const tick = await Tick.get(`${poolAddress}#${tickId.toString()}`);
  if (tick !== undefined) {
    await updateTickFeeVarsAndSave(tick, event);
  }
}

export async function handleExchangePos(event: ExchangePosLog) : Promise<void> {
  const [bundle, pool, transaction, klayPrice,] = await Promise.all([Bundle.get("1"),V2Pool.get(event.address),loadTransaction(event),getklayPriceinUSD(),]);
  assert(pool);
  assert(pool.tokenAId);
  assert(pool.tokenBId);

  const [tokenA, tokenB] = await Promise.all([
    Token.get(pool.tokenAId),
    Token.get(pool.tokenBId)
  ])
  assert(event.args);
  assert(tokenA);
  assert(tokenB);

  // amounts - 0/1 are token deltas: can be positive or negative
  let amountA:number = 0
  let amountB:number = 0
  let rawAmountA:BigNumber = ZERO_BD
  let rawAmountB:BigNumber = ZERO_BD
  if (tokenA.id == event.args.tokenA) {
    amountA = convertTokenToDecimal(event.args.amountA, tokenA.decimals);
    amountB = convertTokenToDecimal(event.args.amountB, tokenB.decimals);
  } else {
    amountA = convertTokenToDecimal(event.args.amountA, tokenB.decimals);
    amountB = convertTokenToDecimal(event.args.amountB, tokenA.decimals);
  }
  rawAmountA = event.args.amountA
  rawAmountB = event.args.amountB

  // need absolute amounts for volume
  let amountAAbs = amountA;
  if (amountA < 0) {
    amountAAbs = amountA * (-1)
  }

  let amountBAbs = amountB;
  if (amountB < 0) {
    amountBAbs = amountB * (-1)
  }
  assert(bundle);

  // get amount that should be tracked only - div 2 because cant count both input and output as volume
  const amountTotalUSDTracked = (
    await getTrackedAmountUSD(amountAAbs, tokenA, amountBAbs, tokenB)
  ) / 2;
  const amountTotalKLAYTracked = safeDivNum(
    amountTotalUSDTracked,
    bundle.klayPriceUSD
  );

  const a = pool.liquidityA
  const b = pool.liquidityB

  if (event.args.tokenA == pool.tokenAId) { // tokenA is to sell, pool.tokenA == event.args.tokenA
    // pool volume
    pool.volumeTokenA = pool.volumeTokenA + amountAAbs; // BigNumber.from(pool.volumeTokenA).add(amountAAbs).toNumber()
    pool.volumeTokenB = pool.volumeTokenB + amountBAbs; // BigNumber.from(pool.volumeTokenB).add(amountBAbs).toNumber()
    pool.volumeUSD = pool.volumeUSD + amountTotalUSDTracked;
  
    // Update the pool with the new active liquidity, price, and tick.
    pool.liquidityA = pool.liquidityA + rawAmountA.toBigInt()
    pool.liquidityB = pool.liquidityB - rawAmountB.toBigInt()
  
    pool.tokenAPrice = amountB / amountA
    pool.tokenBPrice = amountA / amountB
  
    tokenA.totalValueLocked = tokenA.totalValueLocked + amountA;
    tokenB.totalValueLocked = tokenB.totalValueLocked - amountB;
  } else { // pool.tokenB == event.args.tokenA
    // pool volume
    pool.volumeTokenA = pool.volumeTokenA + amountBAbs; //BigNumber.from(pool.volumeTokenA).add(amountAAbs).toNumber()
    pool.volumeTokenB = pool.volumeTokenB + amountAAbs; //BigNumber.from(pool.volumeTokenB).add(amountBAbs).toNumber()
    pool.volumeUSD = pool.volumeUSD + amountTotalUSDTracked;
  
    // Update the pool with the new active liquidity, price, and tick.
    pool.liquidityA = pool.liquidityA - rawAmountA.toBigInt()
    pool.liquidityB = pool.liquidityB + rawAmountB.toBigInt()
  
    pool.tokenAPrice = amountA / amountB
    pool.tokenBPrice = amountB / amountA

    tokenA.totalValueLocked = tokenA.totalValueLocked - amountA;
    tokenB.totalValueLocked = tokenB.totalValueLocked + amountB;
  }

  if (pool.liquidityA <= 0 || pool.liquidityB <= 0) {
    const v2PoolContract = V2pool__factory.connect(pool.id, api)
    const [updateLiqA, updateLiqB] = await v2PoolContract.getCurrentPool()
    pool.liquidityA = updateLiqA.toBigInt()
    pool.liquidityB = updateLiqB.toBigInt()
  }

  // update tokenA data
  tokenA.volume = tokenA.volume + amountAAbs;
  tokenA.volumeUSD = tokenA.volumeUSD + amountTotalUSDTracked;
  tokenA.txCount = tokenA.txCount + ONE_BI;

  // update tokenB data
  tokenB.volume = tokenB.volume + amountBAbs;
  tokenB.volumeUSD = tokenB.volumeUSD + amountTotalUSDTracked;
  tokenB.txCount = tokenB.txCount + ONE_BI;


  // update USD pricing
  bundle.klayPriceUSD = klayPrice;

  const [derivedKLAYA, derivedKLAYB] = await Promise.all([
    findKlayPerToken(tokenA),
    findKlayPerToken(tokenB),
  ]);
  tokenA.derivedKLAY = derivedKLAYA;
  tokenB.derivedKLAY = derivedKLAYB;

  tokenA.totalValueLockedUSD =
    tokenA.totalValueLocked * tokenA.derivedKLAY * bundle.klayPriceUSD;
  tokenB.totalValueLockedUSD =
    tokenB.totalValueLocked * tokenB.derivedKLAY * bundle.klayPriceUSD;

  // create Swap event
  const swap = Swap.create({
    id: transaction.id + "#" + pool.txCount.toString(),
    transactionId: transaction.id,
    timestamp: transaction.timestamp,
    poolId: pool.id,
    token0Id: pool.tokenAId,
    token1Id: pool.tokenBId,
    origin: event.transaction.from,
    amount0: Number(event.args.amountA),
    amount1: Number(event.args.amountB),
    amountUSD: amountTotalUSDTracked,
    tick: ZERO_BI,
    sqrtPriceX96: ZERO_BI,
    logIndex: BigInt(event.logIndex),
    sender: "",
    recipient: ""
  });

  // interval data
  const [
    // poolDayData,
    // poolHourData,
    // poolMinData,
    token0DayData,
    token1DayData,
    token0HourData,
    token1HourData,
    token0MinData,
    token1MinData,
  ] = await Promise.all([
    // updatePoolDayData(event),
    // updatePoolHourData(event),
    // updatePoolMinData(event),
    updateTokenDayData(tokenA, event),
    updateTokenDayData(tokenB, event),
    updateTokenHourData(tokenA, event),
    updateTokenHourData(tokenB, event),
    updateTokenMinData(tokenA, event),
    updateTokenMinData(tokenB, event),
  ]);

  // poolDayData.volumeUSD = poolDayData.volumeUSD + amountTotalUSDTracked;
  // poolDayData.volumeToken0 = poolDayData.volumeToken0 + amountAAbs;
  // poolDayData.volumeToken1 = poolDayData.volumeToken1 + amountBAbs;

  // poolHourData.volumeUSD = poolHourData.volumeUSD + amountTotalUSDTracked;
  // poolHourData.volumeToken0 = poolHourData.volumeToken0 + amountAAbs;
  // poolHourData.volumeToken1 = poolHourData.volumeToken1 + amountBAbs;

  // poolMinData.volumeUSD = poolMinData.volumeUSD + amountTotalUSDTracked;
  // poolMinData.volumeToken0 = poolMinData.volumeToken0 + amountAAbs;
  // poolMinData.volumeToken1 = poolMinData.volumeToken1 + amountBAbs;


  token0DayData.volume = token0DayData.volume + amountAAbs;
  token0DayData.volumeUSD = token0DayData.volumeUSD + amountTotalUSDTracked;
  token0DayData.untrackedVolumeUSD = token0DayData.untrackedVolumeUSD + amountTotalUSDTracked;

  token0HourData.volume = token0HourData.volume + amountAAbs;
  token0HourData.volumeUSD = token0HourData.volumeUSD + amountTotalUSDTracked;
  token0HourData.untrackedVolumeUSD = token0HourData.untrackedVolumeUSD + amountTotalUSDTracked;

  token0MinData.volume = token0MinData.volume + amountAAbs;
  token0MinData.volumeUSD = token0MinData.volumeUSD + amountTotalUSDTracked;
  token0MinData.untrackedVolumeUSD = token0MinData.untrackedVolumeUSD + amountTotalUSDTracked;

  token1DayData.volume = token1DayData.volume + amountBAbs;
  token1DayData.volumeUSD = token1DayData.volumeUSD + amountTotalUSDTracked;
  token1DayData.untrackedVolumeUSD = token1DayData.untrackedVolumeUSD + amountTotalUSDTracked;

  token1HourData.volume = token1HourData.volume + amountBAbs;
  token1HourData.volumeUSD = token1HourData.volumeUSD + amountTotalUSDTracked;
  token1HourData.untrackedVolumeUSD = token1HourData.untrackedVolumeUSD + amountTotalUSDTracked;

  token1MinData.volume = token1MinData.volume + amountBAbs;
  token1MinData.volumeUSD = token1MinData.volumeUSD + amountTotalUSDTracked;
  token1MinData.untrackedVolumeUSD = token1MinData.untrackedVolumeUSD + amountTotalUSDTracked;

  
  await Promise.all([
    bundle.save(),
    swap.save(),
    token0DayData.save(),
    token1DayData.save(),
    token0HourData.save(),
    token1HourData.save(),
    // poolDayData.save(),
    // poolHourData.save(),
    pool.save(),
    tokenA.save(),
    tokenB.save(),
  ]);
}

export async function handleExchangeNeg(event: ExchangeNegLog) : Promise<void> {
  await handleExchangePos(event)
}

export async function handleAddLiquidity(event: AddLiquidityLog) : Promise<void> {
  const poolAddress = event.address;
  const pool = await V2Pool.get(poolAddress);

  if (pool === undefined || pool === null) {
    logger.warn(
      `Could not get pool address ${poolAddress} for mint at transaction ${event.transactionHash}, log id ${event.logIndex}`
    );
    return;
  }

  assert(pool.tokenAId); assert(pool.tokenBId);
  const [bundle, token0, token1, transaction] = await Promise.all([
    Bundle.get("1"),
    Token.get(pool.tokenAId),
    Token.get(pool.tokenBId),
    loadTransaction(event),
  ]);

  assert(event.args); assert(token0); assert(token1); assert(bundle);
  const amountA = convertTokenToDecimal(event.args.amountA, token0.decimals);
  const amountB = convertTokenToDecimal(event.args.amountB, token1.decimals);

  const amountUSD =
    amountA * (token0.derivedKLAY * bundle.klayPriceUSD) +
    amountB * (token1.derivedKLAY * bundle.klayPriceUSD);

  // update token0 data
  token0.txCount = token0.txCount + ONE_BI;
  token0.totalValueLocked = token0.totalValueLocked + amountA;
  token0.totalValueLockedUSD =
    token0.totalValueLocked * token0.derivedKLAY * bundle.klayPriceUSD;

  // update token1 data
  token1.txCount = token1.txCount + ONE_BI;
  token1.totalValueLocked = token1.totalValueLocked + amountB;
  token1.totalValueLockedUSD =
    token1.totalValueLocked * token1.derivedKLAY * bundle.klayPriceUSD;

  // pool data
  pool.txCount = pool.txCount + ONE_BI;
  pool.liquidityA = pool.liquidityA + event.args.amountA.toBigInt();
  pool.liquidityB = pool.liquidityB + event.args.amountB.toBigInt();

  if (pool.liquidityA <= 0 || pool.liquidityB <= 0) {
    const v2PoolContract = V2pool__factory.connect(pool.id, api)
    const [updateLiqA, updateLiqB] = await v2PoolContract.getCurrentPool()
    pool.liquidityA = updateLiqA.toBigInt()
    pool.liquidityB = updateLiqB.toBigInt()
  }

  const mint = Mint.create({
    id: transaction.id.toString() + "#" + pool.txCount.toString(),
    transactionId: transaction.id,
    timestamp: transaction.timestamp,
    poolId: pool.id,
    token0Id: pool.tokenAId,
    token1Id: pool.tokenBId,
    owner: event.args.user,
    sender: event.args.user,
    origin: event.transaction.from,
    amount: ZERO_BI,
    amount0: amountA,
    amount1: amountB,
    amountUSD: amountUSD,
    tickLower: ZERO_BI,
    tickUpper: ZERO_BI,
    logIndex: BigInt(event.logIndex),
  });

  await Promise.all([
    // updatePoolDayData(event),
    // updatePoolHourData(event),
    // updatePoolMinData(event),
    updateTokenDayData(token0, event),
    updateTokenDayData(token1, event),
    updateTokenHourData(token0, event),
    updateTokenHourData(token1, event),
    updateTokenMinData(token0, event),
    updateTokenMinData(token1, event),

    token0.save(),
    token1.save(),
    pool.save(),
    mint.save(),
  ]);
}
export async function handleRemoveLiquidity(event: RemoveLiquidityLog) : Promise<void> {
  const poolAddress = event.address;
  const pool = await V2Pool.get(poolAddress);
  assert(pool?.tokenAId);
  assert(pool?.tokenBId);

  const [bundle, token0, token1, transaction] = await Promise.all([
    Bundle.get("1"),
    Token.get(pool.tokenAId),
    Token.get(pool.tokenBId),
    loadTransaction(event),
  ]);
  assert(event.args);
  assert(token0);
  assert(token1);

  const amount0 = convertTokenToDecimal(event.args.amountA, token0.decimals);
  const amount1 = convertTokenToDecimal(event.args.amountB, token1.decimals);
  assert(bundle);

  const amountUSD =
    amount0 * token0.derivedKLAY * bundle.klayPriceUSD +
    amount1 * token1.derivedKLAY * bundle.klayPriceUSD;

  // update token0 data
  token0.txCount = token0.txCount + ONE_BI;
  token0.totalValueLocked = token0.totalValueLocked - amount0;
  token0.totalValueLockedUSD =
    token0.totalValueLocked * token0.derivedKLAY * bundle.klayPriceUSD;

  // update token1 data
  token1.txCount = token1.txCount + ONE_BI;
  token1.totalValueLocked = token1.totalValueLocked - amount1;
  token1.totalValueLockedUSD =
    token1.totalValueLocked * token1.derivedKLAY * bundle.klayPriceUSD;

  // pool data
  pool.txCount = pool.txCount + ONE_BI;
  pool.liquidityA = pool.liquidityA - event.args.amountA.toBigInt();
  pool.liquidityB = pool.liquidityB - event.args.amountB.toBigInt();

  if (pool.liquidityA <= 0 || pool.liquidityB <= 0) {
    const v2PoolContract = V2pool__factory.connect(pool.id, api)
    const [updateLiqA, updateLiqB] = await v2PoolContract.getCurrentPool()
    pool.liquidityA = updateLiqA.toBigInt()
    pool.liquidityB = updateLiqB.toBigInt()
  }
  
  // burn entity
  // const transaction = await loadTransaction(event)
  const burn = Burn.create({
    id: transaction.id + "#" + pool.txCount.toString(),
    transactionId: transaction.id,
    timestamp: transaction.timestamp,
    poolId: pool.id,
    token0Id: pool.tokenAId,
    token1Id: pool.tokenBId,
    owner: event.args.user,
    origin: event.transaction.from,
    amount: ZERO_BI,
    amount0: amount0,
    amount1: amount1,
    amountUSD: amountUSD,
    tickLower: ZERO_BI,
    tickUpper: ZERO_BI,
    logIndex: BigInt(event.logIndex),
  });

  await Promise.all([
    // updatePoolDayData(event),
    // updatePoolHourData(event),
    // updatePoolMinData(event),
    updateTokenDayData(token0, event),
    updateTokenDayData(token1, event),
    updateTokenHourData(token0, event),
    updateTokenHourData(token1, event),
    updateTokenMinData(token0, event),
    updateTokenMinData(token1, event),
    token0.save(),
    token1.save(),
    pool.save(),
    burn.save(),
  ]);
}