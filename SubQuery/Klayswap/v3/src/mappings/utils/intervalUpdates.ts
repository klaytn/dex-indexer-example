// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { ZERO_BD, ZERO_BI, ONE_BI, FACTORY_ADDRESS } from "./constants";
import {
  UniswapDayData,
  Factory,
  Pool,
  PoolDayData,
  Token,
  TokenDayData,
  TokenHourData,
  Bundle,
  PoolHourData,
  TickDayData,
  Tick,
} from "../../types";
import { EthereumLog } from "@subql/types-ethereum";
import { BigNumber } from "@ethersproject/bignumber";
import assert from "assert";
import { PoolMinData } from "../../types/models/PoolMinData";
import { TokenMinData } from "../../types/models/TokenMinData";

/**
 * Tracks global aggregate data over daily windows
 * @param event
 */
// TODO : event type ?
export async function updateUniswapDayData(
  event: EthereumLog
): Promise<UniswapDayData> {
  const timestamp = parseInt(event.block.timestamp.toString());
  const dayID = timestamp / 86400; // rounded
  const dayStartTimestamp = Number(event.block.timestamp);

  let [uniswap, uniswapDayData] = await Promise.all([
    Factory.get(FACTORY_ADDRESS),
    UniswapDayData.get(dayID.toString()),
  ]);
  assert(uniswap);
  if (uniswapDayData === undefined) {
    uniswapDayData = UniswapDayData.create({
      id: dayID.toString(),
      date: dayStartTimestamp,
      volumeKLAY: 0,
      volumeUSD: 0,
      volumeUSDUntracked: 0,
      feesUSD: 0,
      tvlUSD: uniswap.totalValueLockedUSD,
      txCount: uniswap.txCount,
    });
  }
  await uniswapDayData.save();
  return uniswapDayData;
}

export async function updatePoolDayData(
  event: EthereumLog
): Promise<PoolDayData> {
  const timestamp = BigNumber.from(event.block.timestamp);
  const dayID = timestamp.div(86400);
  const dayStartTimestamp = dayID.mul(86400);
  const dayPoolID = `${event.address}-${dayID.toString()}`;
  let [pool, poolDayData] = await Promise.all([
    Pool.get(event.address),
    PoolDayData.get(dayPoolID),
  ]);
  assert(pool);
  if (poolDayData === undefined) {
    poolDayData = PoolDayData.create({
      id: dayPoolID,
      date: dayStartTimestamp.toNumber(),
      poolId: pool.id,
      // things that dont get initialized always
      volumeToken0: 0,
      volumeToken1: 0,
      volumeUSD: 0,
      feesUSD: 0,
      txCount: ZERO_BI,
      feeGrowthGlobal0X128: ZERO_BI,
      feeGrowthGlobal1X128: ZERO_BI,
      open: pool.token0Price,
      high: pool.token0Price,
      low: pool.token0Price,
      close: pool.token0Price,
      liquidity: pool.liquidity,
      sqrtPrice: pool.sqrtPrice,
      token0Price: pool.token0Price,
      token1Price: pool.token1Price,
      tick: pool.tick,
      tvlUSD: pool.totalValueLockedUSD,
    });
  }

  if (pool.token0Price > poolDayData.high) {
    poolDayData.high = pool.token0Price;
  }
  if (pool.token0Price < poolDayData.low) {
    poolDayData.low = pool.token0Price;
  }

  poolDayData.liquidity = pool.liquidity;
  poolDayData.sqrtPrice = pool.sqrtPrice;
  poolDayData.token0Price = pool.token0Price;
  poolDayData.token1Price = pool.token1Price;
  poolDayData.feeGrowthGlobal0X128 = pool.feeGrowthGlobal0X128;
  poolDayData.feeGrowthGlobal1X128 = pool.feeGrowthGlobal1X128;
  poolDayData.close = pool.token0Price;
  poolDayData.tick = pool.tick;
  poolDayData.tvlUSD = pool.totalValueLockedUSD;
  poolDayData.txCount = poolDayData.txCount + ONE_BI;

  await poolDayData.save();

  return poolDayData;
}

export async function updatePoolHourData(
  event: EthereumLog
): Promise<PoolHourData> {
  const timestamp = BigNumber.from(event.block.timestamp);
  const hourIndex = timestamp.div(3600); // get unique hour within unix history
  const hourStartUnix = hourIndex.mul(3600); // want the rounded effect
  const hourPoolID = event.address
    // .toHexString()
    .concat("-")
    .concat(hourIndex.toString());
  let [pool, poolHourData] = await Promise.all([
    await Pool.get(event.address),
    await PoolHourData.get(hourPoolID),
  ]);
  assert(pool);
  if (poolHourData === undefined) {
    poolHourData = PoolHourData.create({
      id: hourPoolID,
      periodStartUnix: hourStartUnix.toNumber(),
      poolId: pool.id,
      // things that dont get initialized always
      volumeToken0: 0,
      volumeToken1: 0,
      volumeUSD: 0,
      feesUSD: 0,
      txCount: ZERO_BI,
      feeGrowthGlobal0X128: ZERO_BI,
      feeGrowthGlobal1X128: ZERO_BI,
      open: pool.token0Price,
      high: pool.token0Price,
      low: pool.token0Price,
      close: pool.token0Price,
      liquidity: pool.liquidity,
      sqrtPrice: pool.sqrtPrice,
      token0Price: pool.token0Price,
      token1Price: pool.token1Price,
      tick: pool.tick,
      tvlUSD: pool.totalValueLockedUSD,
    });
  }

  if (pool.token0Price > poolHourData.high) {
    poolHourData.high = pool.token0Price;
  }
  if (pool.token0Price < poolHourData.low) {
    poolHourData.low = pool.token0Price;
  }
  poolHourData.liquidity = pool.liquidity;
  poolHourData.sqrtPrice = pool.sqrtPrice;
  poolHourData.token0Price = pool.token0Price;
  poolHourData.token1Price = pool.token1Price;
  poolHourData.feeGrowthGlobal0X128 = pool.feeGrowthGlobal0X128;
  poolHourData.feeGrowthGlobal1X128 = pool.feeGrowthGlobal1X128;
  poolHourData.close = pool.token0Price;
  poolHourData.tick = pool.tick;
  poolHourData.tvlUSD = pool.totalValueLockedUSD;
  poolHourData.txCount = poolHourData.txCount + ONE_BI;

  await poolHourData.save();

  // test
  return poolHourData;
}

export async function updatePoolMinData(
  event: EthereumLog
): Promise<PoolMinData> {
  const timestamp = BigNumber.from(event.block.timestamp);
  const minIndex = timestamp.div(60); // get unique Min within unix history
  const minStartUnix = minIndex.mul(60); // want the rounded effect
  const minPoolID = event.address
    // .toHexString()
    .concat("-")
    .concat(minIndex.toString());
  let [pool, poolMinData] = await Promise.all([
    await Pool.get(event.address),
    await PoolMinData.get(minPoolID),
  ]);
  assert(pool);
  if (poolMinData === undefined) {
    poolMinData = PoolMinData.create({
      id: minPoolID,
      periodStartUnix: minStartUnix.toNumber(),
      poolId: pool.id,
      // things that dont get initialized always
      volumeToken0: 0,
      volumeToken1: 0,
      volumeUSD: 0,
      feesUSD: 0,
      txCount: ZERO_BI,
      feeGrowthGlobal0X128: ZERO_BI,
      feeGrowthGlobal1X128: ZERO_BI,
      open: pool.token0Price,
      high: pool.token0Price,
      low: pool.token0Price,
      close: pool.token0Price,
      liquidity: pool.liquidity,
      sqrtPrice: pool.sqrtPrice,
      token0Price: pool.token0Price,
      token1Price: pool.token1Price,
      tick: pool.tick,
      tvlUSD: pool.totalValueLockedUSD,
    });
  }

  if (pool.token0Price > poolMinData.high) {
    poolMinData.high = pool.token0Price;
  }
  if (pool.token0Price < poolMinData.low) {
    poolMinData.low = pool.token0Price;
  }
  poolMinData.liquidity = pool.liquidity;
  poolMinData.sqrtPrice = pool.sqrtPrice;
  poolMinData.token0Price = pool.token0Price;
  poolMinData.token1Price = pool.token1Price;
  poolMinData.feeGrowthGlobal0X128 = pool.feeGrowthGlobal0X128;
  poolMinData.feeGrowthGlobal1X128 = pool.feeGrowthGlobal1X128;
  poolMinData.close = pool.token0Price;
  poolMinData.tick = pool.tick;
  poolMinData.tvlUSD = pool.totalValueLockedUSD;
  poolMinData.txCount = poolMinData.txCount + ONE_BI;

  await poolMinData.save();

  // test
  return poolMinData;
}


export async function updateTokenDayData(
  token: Token,
  event: EthereumLog
): Promise<TokenDayData> {
  const timestamp = BigNumber.from(event.block.timestamp);
  const dayID = timestamp.div(86400);
  const dayStartTimestamp = dayID.mul(86400);
  const tokenDayID = token.id.toString().concat("-").concat(dayID.toString());

  let [tokenDayData, bundle] = await Promise.all([
    TokenDayData.get(tokenDayID),
    Bundle.get("1"),
  ]);
  assert(bundle);
  const tokenPrice = token.derivedKLAY * bundle.klayPriceUSD;

  if (tokenDayData === undefined) {
    tokenDayData = TokenDayData.create({
      id: tokenDayID,
      date: dayStartTimestamp.toNumber(),
      tokenId: token.id,
      volume: 0,
      volumeUSD: 0,
      feesUSD: 0,
      untrackedVolumeUSD: 0,
      open: tokenPrice,
      high: tokenPrice,
      low: tokenPrice,
      close: tokenPrice,
      priceUSD: token.derivedKLAY * bundle.klayPriceUSD,
      totalValueLocked: token.totalValueLocked,
      totalValueLockedUSD: token.totalValueLockedUSD,
    });
  }

  if (tokenPrice > tokenDayData.high) {
    tokenDayData.high = tokenPrice;
  }

  if (tokenPrice < tokenDayData.low) {
    tokenDayData.low = tokenPrice;
  }

  tokenDayData.close = tokenPrice;
  tokenDayData.priceUSD = tokenPrice;
  tokenDayData.totalValueLocked = token.totalValueLocked;
  tokenDayData.totalValueLockedUSD = token.totalValueLockedUSD;

  await tokenDayData.save();

  return tokenDayData;
}

export async function updateTokenHourData(
  token: Token,
  event: EthereumLog
): Promise<TokenHourData> {
  const timestamp = BigNumber.from(event.block.timestamp);
  const hourIndex = timestamp.div(3600); // get unique hour within unix history
  const hourStartUnix = hourIndex.mul(3600); // want the rounded effect
  const tokenHourID = token.id
    .toString()
    .concat("-")
    .concat(hourIndex.toString());
  let [tokenHourData, bundle] = await Promise.all([
    TokenHourData.get(tokenHourID),
    Bundle.get("1"),
  ]);
  assert(bundle);
  const tokenPrice = token.derivedKLAY*bundle.klayPriceUSD;
  if (tokenHourData === undefined) {
    tokenHourData = TokenHourData.create({
      id: tokenHourID,
      periodStartUnix: hourStartUnix.toNumber(),
      tokenId: token.id,
      volume: 0,
      volumeUSD: 0,
      untrackedVolumeUSD: 0,
      feesUSD: 0,
      open: tokenPrice,
      high: tokenPrice,
      low: tokenPrice,
      close: tokenPrice,
      totalValueLocked: token.totalValueLocked,
      totalValueLockedUSD: token.totalValueLockedUSD,
      priceUSD: tokenPrice,
    });
  }

  if (tokenPrice > tokenHourData.high) {
    tokenHourData.high = tokenPrice;
  }

  if (tokenPrice < tokenHourData.low) {
    tokenHourData.low = tokenPrice;
  }

  tokenHourData.close = tokenPrice;
  tokenHourData.priceUSD = tokenPrice;
  tokenHourData.totalValueLocked = token.totalValueLocked;
  tokenHourData.totalValueLockedUSD = token.totalValueLockedUSD;

  await tokenHourData.save();

  return tokenHourData;
}


export async function updateTokenMinData(
  token: Token,
  event: EthereumLog
): Promise<TokenMinData> {
  const timestamp = BigNumber.from(event.block.timestamp);
  const minIndex = timestamp.div(60); // get unique min within unix history
  const minStartUnix = minIndex.mul(60); // want the rounded effect
  const tokenMinID = token.id
    .toString()
    .concat("-")
    .concat(minIndex.toString());
  let [tokenMinData, bundle] = await Promise.all([
    TokenMinData.get(tokenMinID),
    Bundle.get("1"),
  ]);
  assert(bundle);
  const tokenPrice = token.derivedKLAY*bundle.klayPriceUSD;
  if (tokenMinData === undefined) {
    tokenMinData = TokenMinData.create({
      id: tokenMinID,
      periodStartUnix: minStartUnix.toNumber(),
      tokenId: token.id,
      volume: 0,
      volumeUSD: 0,
      untrackedVolumeUSD: 0,
      feesUSD: 0,
      open: tokenPrice,
      high: tokenPrice,
      low: tokenPrice,
      close: tokenPrice,
      totalValueLocked: token.totalValueLocked,
      totalValueLockedUSD: token.totalValueLockedUSD,
      priceUSD: tokenPrice,
    });
  }

  if (tokenPrice > tokenMinData.high) {
    tokenMinData.high = tokenPrice;
  }

  if (tokenPrice < tokenMinData.low) {
    tokenMinData.low = tokenPrice;
  }

  tokenMinData.close = tokenPrice;
  tokenMinData.priceUSD = tokenPrice;
  tokenMinData.totalValueLocked = token.totalValueLocked;
  tokenMinData.totalValueLockedUSD = token.totalValueLockedUSD;

  await tokenMinData.save();

  return tokenMinData;
}


export async function updateTickDayData(
  tick: Tick,
  event: EthereumLog
): Promise<TickDayData> {
  const timestamp = BigNumber.from(event.block.timestamp);
  const dayID = timestamp.div(86400);
  const dayStartTimestamp = dayID.mul(86400);
  const tickDayDataID = tick.id.concat("-").concat(dayID.toString());
  let tickDayData = await TickDayData.get(tickDayDataID);
  if (tickDayData === undefined) {
    tickDayData = TickDayData.create({
      id: tickDayDataID,
      date: dayStartTimestamp.toNumber(),
      poolId: tick.poolId,
      tickId: tick.id,
      liquidityGross: tick.liquidityGross,
      liquidityNet: tick.liquidityNet,
      volumeToken0: tick.volumeToken0,
      volumeToken1: tick.volumeToken0,
      volumeUSD: tick.volumeUSD,
      feesUSD: tick.feesUSD,
      feeGrowthOutside0X128: tick.feeGrowthOutside0X128,
      feeGrowthOutside1X128: tick.feeGrowthOutside1X128,
    });
  }
  tickDayData.liquidityGross = tick.liquidityGross;
  tickDayData.liquidityNet = tick.liquidityNet;
  tickDayData.volumeToken0 = tick.volumeToken0;
  tickDayData.volumeToken1 = tick.volumeToken0;
  tickDayData.volumeUSD = tick.volumeUSD;
  tickDayData.feesUSD = tick.feesUSD;
  tickDayData.feeGrowthOutside0X128 = tick.feeGrowthOutside0X128;
  tickDayData.feeGrowthOutside1X128 = tick.feeGrowthOutside1X128;

  await tickDayData.save();

  return tickDayData;
}
