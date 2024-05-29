// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Transaction } from "../../types";
import { scale, SCALE_FACTOR, ZERO_BD, ZERO_BI } from "./constants";
import { BigNumber } from "@ethersproject/bignumber";
import { EthereumLog } from "@subql/types-ethereum";
import assert from "assert";
import { formatUnits } from "ethers/lib/utils";

export function safeDivNumToNum(amount0: number, amount1: number): number {
  return amount1 === 0 ? 0 : amount0 / amount1;
}

export function safeDiv(amount0: BigNumber, amount1: BigNumber): BigNumber {
  // I assume eq means equal
  if (amount1.eq(ZERO_BD)) {
    // return BigNumber.from(ZERO_BD)
    return ZERO_BD;
  } else {
    return amount0.div(amount1);
  }
}

export function safeDivNum(amount0: number, amount1: number): number {
  // I assume eq means equal
  if (amount1 == 0) {
    return 0;
  } else {
    return amount0 / amount1;
  }
}

export function isNullEthValue(value: string): boolean {
  return (
    value ==
    "0x0000000000000000000000000000000000000000000000000000000000000001"
  );
}

export function convertTokenToDecimal(
  tokenAmount: BigNumber,
  exchangeDecimals: bigint
): number {
  if (Number(exchangeDecimals) == 0) {
    return tokenAmount.toNumber();
  }
  return Number(formatUnits(tokenAmount, exchangeDecimals));
}

export function convertTokenToBigIntDecimal(
  tokenAmount: BigNumber,
  exchangeDecimals: bigint
): bigint {
  if (exchangeDecimals == ZERO_BI) {
    return tokenAmount.toBigInt();
  }
  return BigInt(formatUnits(tokenAmount, exchangeDecimals));
}

export async function loadTransaction(
  log: EthereumLog
): Promise<Transaction> {
  let transaction = await Transaction.get(log.transactionHash);
  if (transaction === undefined) {
    transaction = Transaction.create({
      id: log.transactionHash,
      blockNumber: BigInt(log.blockNumber),
      timestamp: log.block.timestamp,
      gasPrice: BigInt(0),
      gasUsed: BigInt(0),
    });
  }
  transaction.gasUsed = (await log.transaction.receipt()).gasUsed;
  transaction.gasPrice = log.transaction.gasPrice;
  await transaction.save();
  return transaction;
}

export function floatToIntString(value: number): string {
  // 소수점 이하를 제거하고 정수로 변환
  const intValue = BigInt(Math.floor(value));
  return intValue.toString();
}