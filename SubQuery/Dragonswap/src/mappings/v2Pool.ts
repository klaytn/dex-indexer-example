// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import {
    WHITELIST_TOKENS,
    ZERO_BI,
    ZERO_BD,
    createToken,
    v2PoolStartBlockNum,
  } from "./utils";
import {
    WhiteListPools,
    V2Pool,
    createV2poolDatasource,
} from "../types";
import { EthereumLog } from "@subql/types-ethereum";
import { CreatePoolEvent } from "../types/contracts/V2factory"
import { V2pool__factory } from "../types/contracts/factories/V2pool__factory";
import assert from "assert";
  
export async function createV2Pool(v2PoolAddr:string, init:boolean) : Promise<V2Pool|undefined> {
  const v2PoolContract = V2pool__factory.connect(v2PoolAddr, api);
  const [symbol, addrTokenA, addrTokenB] = await Promise.all([
    v2PoolContract.name(),
    v2PoolContract.tokenA(),
    v2PoolContract.tokenB(),
  ])
  const [liquidityA, liquidityB] = await v2PoolContract.getCurrentPool()
  // To skip before the v2/v3StartBlockNum
  if (init == true && liquidityA <= ZERO_BD) {
    return undefined
  }

  await createV2poolDatasource({
    address:v2PoolAddr
  })

  const [tokenA, tokenB] = await Promise.all([
    createToken(addrTokenA),
    createToken(addrTokenB)
  ])
  let pool = await V2Pool.get(v2PoolAddr);
  if(pool === undefined) {
    pool = V2Pool.create({
      id:v2PoolAddr,
      symbol,
      tokenAId:tokenA.id,
      tokenBId:tokenB.id,
      liquidityA:liquidityA.toBigInt(),
      liquidityB:liquidityB.toBigInt(),
      tokenAPrice:0,
      tokenBPrice:0,
      volumeTokenA:0,
      volumeTokenB:0,
      volumeUSD:0,
      txCount:ZERO_BI
    })
  }
  await pool.save()

  // update white listed pools
  if (WHITELIST_TOKENS.includes(tokenA.id)) {
    const newPool = WhiteListPools.create({
      id: `${pool.id + tokenB.id}`,
      tokenId: tokenB.id,
      poolId: pool.id,
    });
    await newPool.save();
  }
  if (WHITELIST_TOKENS.includes(tokenB.id)) {
    const newPool = WhiteListPools.create({
      id: `${pool.id + tokenA.id}`,
      tokenId: tokenA.id,
      poolId: pool.id,
    });
    await newPool.save();
  }

  return pool
}

export async function handleV2PoolCreated(
  event: EthereumLog<CreatePoolEvent["args"]>
): Promise<void> {
  if (event.blockNumber < v2PoolStartBlockNum) {
    return;
  }
  assert(event.args)
  const v2pool = await createV2Pool(event.args.exchange, false)
  if (v2pool === undefined) {
    return;
  }
}