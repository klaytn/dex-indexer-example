import { createToken } from "./utils";
import {
    WHITELIST_TOKENS,
    FACTORY_ADDRESS,
    ONE_BI,
    ZERO_BI,
  } from "./utils";
  import {
    Pool,
    Factory,
    createPoolDatasource,
    WhiteListPools,
  } from "../types";
  import { EthereumLog } from "@subql/types-ethereum";
  import { PoolCreatedEvent } from "../types/contracts/Factory";
  import assert from "assert";
  import { v3PoolStartBlockNum } from "./utils/constants";
import { Pool__factory } from "../types/contracts";

export async function createV3Pool(
    poolAddr: string,
    factory: Factory,
    init: boolean
  ): Promise<Pool|undefined> {
    const poolContract = Pool__factory.connect(poolAddr, api)
    const liquidity = await poolContract.liquidity()
    // To skip before the v2/v3StartBlockNum
    if (init == true && liquidity.lte(ZERO_BI)) {
        return undefined
    }
  
    await createPoolDatasource({
      address: poolAddr,
    });
  
    const token0 = await createToken(await poolContract.token0());
    const token1 = await createToken(await poolContract.token1());
    if (token0 === undefined || token1 === undefined) {
      return;
    }

    let pool = await Pool.get(poolAddr);
    if(pool === undefined) {
        factory.poolCount = factory.poolCount + ONE_BI;
        pool = Pool.create({
            id: poolAddr,
            token0Id: token0.id,
            token1Id: token1.id,
            feeTier: BigInt(await poolContract.fee()),
            createdAtTimestamp: ZERO_BI,
            createdAtBlockNumber: ZERO_BI,
            liquidityProviderCount: ZERO_BI,
            txCount: ZERO_BI,
            liquidity: liquidity.toBigInt(),
            sqrtPrice: ZERO_BI,
            feeGrowthGlobal0X128: ZERO_BI,
            feeGrowthGlobal1X128: ZERO_BI,
            token0Price: 0,
            token1Price: 0,
            observationIndex: ZERO_BI,
            totalValueLockedToken0: 0,
            totalValueLockedToken1: 0,
            totalValueLockedUSD: 0,
            totalValueLockedKLAY: 0,
            totalValueLockedUSDUntracked: 0,
            volumeToken0: 0,
            volumeToken1: 0,
            volumeUSD: 0,
            feesUSD: 0,
            untrackedVolumeUSD: 0,
            collectedFeesToken0: 0,
            collectedFeesToken1: 0,
            collectedFeesUSD: 0,
        });
    }
  
    // update white listed pools
    if (WHITELIST_TOKENS.includes(token0.id)) {
      const newPool = WhiteListPools.create({
        id: `${pool.id + token1.id}`,
        tokenId: token1.id,
        poolId: pool.id,
      });
      await newPool.save();
    }
    if (WHITELIST_TOKENS.includes(token1.id)) {
      const newPool = WhiteListPools.create({
        id: `${pool.id + token0.id}`,
        tokenId: token0.id,
        poolId: pool.id,
      });
      await newPool.save();
    }
  
    await Promise.all([
      factory.save(),
      pool.save()
    ]);
  
    return pool;
  }


  export async function handlePoolCreated(
    event: EthereumLog<PoolCreatedEvent["args"]>
  ): Promise<void> {
    if (event.blockNumber < v3PoolStartBlockNum) {
      return;
    }
    assert(event.args)
    const factory = await Factory.get(FACTORY_ADDRESS);
    if (factory === undefined) {
      return;
    }
    const v2pool = await createV3Pool(event.args.pool, factory, false)
    if (v2pool === undefined) {
      return;
    }
  }