// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { BigNumber } from "@ethersproject/bignumber";
import { Factory__factory } from "../../types/contracts/factories/Factory__factory";
import { V2factory__factory } from "../../types/contracts/factories/V2factory__factory";

export const ADDRESS_ZERO = "0x0000000000000000000000000000000000000000";

export const ZERO_BI = BigInt(0);
export const ONE_BI = BigInt(1);
// export let ZERO_BD = 0
// export let ONE_BD = 1
// export let BI_18 = 18

// export let ZERO_BI = BigNumber.from('0')
// export let ONE_BI = BigNumber.from('1')
export const ZERO_BD = BigNumber.from("0");
export const ONE_BD = BigNumber.from("1");
export const BI_18 = BigNumber.from(18);

// export let ZERO_BI = BigInt.fromI32(0)
// export let ONE_BI = BigInt.fromI32(1)
// export let ZERO_BD = BigDecimal.fromString('0')
// export let ONE_BD = BigDecimal.fromString('1')
// export let BI_18 = BigInt.fromI32(18)
export const Q192 = BigNumber.from(2).pow(192);
export const SCALE = BigNumber.from(10).pow(18);
// export const MINIMUM_KLAY_LOCKED = BigNumber.from(10000); // 예시 값, 실제 값에 맞게 조정 필요
export const MINIMUM_KLAY_LOCKED = 10000; // 예시 값, 실제 값에 맞게 조정 필요
export const SCALE_FACTOR = BigNumber.from(10).pow(18);
export const scale = Math.pow(10, 18);

// export let factoryContract = FactoryContract.bind(Address.fromString(FACTORY_ADDRESS))
export const FACTORY_ADDRESS = "0xA15Be7e90df29A4aeaD0C7Fc86f7a9fBe6502Ac9";
export const factoryContract = Factory__factory.connect(FACTORY_ADDRESS, api);

export const v2PoolStartBlockNum = 144895284
export const v3PoolStartBlockNum = 144895284

export const V2FACTORY_ADDRESS = "0xc6a2ad8cc6e4a7e08fc37cc5954be07d499e7654"
export const v2Factory = V2factory__factory.connect(V2FACTORY_ADDRESS, api);