// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import {
  ADDRESS_ZERO,
  FACTORY_ADDRESS,
  V2FACTORY_ADDRESS,
  ZERO_BI,
} from "./utils";
import {
  Bundle,
  Factory,
  V2Factory,
} from "../types";
import { v3PoolStartBlockNum, v2PoolStartBlockNum, v2Factory, factoryContract } from "./utils/constants";
import { createV2Pool } from "./v2Pool";
import { createV3Pool } from "./v3Pool";

let v2PoolInit = true
let v3PoolInit = true

export async function initializeFactory(blockNumber: number) {
  if (v3PoolInit && blockNumber >= v3PoolStartBlockNum) {
    await initializeV3Factory()
    v3PoolInit = false
  }

  if (v2PoolInit && blockNumber >= v2PoolStartBlockNum) {
    await initializeV2Factory()
    v2PoolInit = false
  }
}

async function initializeV3Factory() {
  const poolCount = (await factoryContract.getPoolCount()).toNumber();
    let factory = await Factory.get(FACTORY_ADDRESS);
    if (factory === undefined || factory === undefined) {
      factory = Factory.create({
        id: FACTORY_ADDRESS,
        poolCount: ZERO_BI,
        totalVolumeKLAY: 0,
        totalVolumeUSD: 0,
        untrackedVolumeUSD: 0,
        totalFeesUSD: 0,
        totalFeesKLAY: 0,
        totalValueLockedKLAY: 0,
        totalValueLockedUSD: 0,
        totalValueLockedUSDUntracked: 0,
        totalValueLockedKLAYUntracked: 0,
        txCount: ZERO_BI,
        owner: ADDRESS_ZERO,
      });
      // create new bundle for tracking eth price
      const bundle = Bundle.create({
        id: "1",
        klayPriceUSD: 0,
      });
  
      await bundle.save();
    }
  await factory.save()

  for (let i = 0; i < poolCount; ++i) {
    const poolAddr = await factoryContract.getPoolAddress(i);
    const pool = await createV3Pool(poolAddr, factory, true)
    if (pool === undefined) {
      return;
    }
  }
}

async function initializeV2Factory() {
  const poolCount = (await v2Factory.getPoolCount()).toNumber();
  const factory = V2Factory.create({
    id:V2FACTORY_ADDRESS,
    poolCount:BigInt(poolCount),
    totalVolumeKLAY:0,
    totalVolumeUSD:0
  })
  await factory.save()

  for (let i = 0; i < poolCount; ++i) {
    const v2PoolAddr = await v2Factory.pools(i);
    const v2Pool = await createV2Pool(v2PoolAddr, true)
    if (v2Pool === undefined) {
      return;
    }
  }
}
