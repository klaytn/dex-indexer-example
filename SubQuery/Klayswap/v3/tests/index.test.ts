import { BigNumber } from "@ethersproject/bignumber";
import { formatUnits } from "@ethersproject/units";

export const ZERO_BI = BigInt(0);
export const ONE_BI = BigInt(1);
export const ZERO_BD = BigNumber.from("0");
export const ONE_BD = BigNumber.from("1");
export const BI_18 = BigNumber.from(18);
export const Q192 = BigNumber.from(2).pow(192);
export const SCALE = BigNumber.from(10).pow(18);
export const MINIMUM_KLAY_LOCKED = BigNumber.from(60); // 예시 값, 실제 값에 맞게 조정 필요
export const SCALE_FACTOR = BigNumber.from(10).pow(18);
export const scale = Math.pow(10, 18);

export function safeDivNumToNum(amount0: number, amount1: number): number {
    return amount1 === 0 ? 0 : amount0 / amount1;
}

function sqrtPriceX96ToTokenPricesOriginal(
    sqrtPriceX96: bigint,
    decimal0: number,
    decimal1: number
): number[] {
    const num = BigNumber.from(sqrtPriceX96).mul(sqrtPriceX96);
    const numScale = num.mul(SCALE_FACTOR)
    const denom = Q192;
    
    const decimalsDiff = decimal0- decimal1;
    var divide
    
    if ( decimalsDiff > 0) {
      const numScaleWithDecimal = numScale.mul(BigNumber.from(10).pow(decimalsDiff))
      divide = Number(formatUnits(numScaleWithDecimal.div(Q192),18))
    }
    
    else {
      divide = Number(formatUnits(numScale.div(Q192), 18-Number(decimalsDiff)))
    }
    
    const price0 = divide;
    const price1 = safeDivNumToNum(1, price0);
    return [price0, price1];
}

function sqrtPriceX96ToTokenPrices(
    sqrtPriceX96: bigint,
    decimal0: number,
    decimal1: number
  ): number[] {

    const price0 = (Number(sqrtPriceX96) / 2**96)**2 / (10**decimal1 / 10**decimal0);
	const price1 = (1 / price0);

    return [price0, price1];
  }


describe('testing index file', () => {
  test('test1', () => {
    const decimal0 = 6
    const decimal1 = 18
    const sqrtPriceX86 = BigInt(2018382873588440326581633304624437)
    const prices = sqrtPriceX96ToTokenPrices(sqrtPriceX86, decimal0, decimal1)
    console.log(prices)
    expect(prices[1]).toBeGreaterThanOrEqual(1539.296000)
  });
  test('test2', () => {
    const decimal0 = 18
    const decimal1 = 6
    const sqrtPriceX86 = BigInt(39136252928812004705448)
    const prices = sqrtPriceX96ToTokenPrices(sqrtPriceX86, decimal0, decimal1)
    console.log(prices)
    expect(prices[1]).toBeGreaterThanOrEqual(1)
  });
  test('test3', () => {
    const decimal0 = 6 
    const decimal1 = 6
    const sqrtPriceX86 = BigInt(79067369644737471999018165015)
    const prices = sqrtPriceX96ToTokenPrices(sqrtPriceX86, decimal0, decimal1)
    console.log(prices)
    expect(prices[1]).toBeGreaterThanOrEqual(1)
  });
//   test('test3', () => {
//     const decimal0 = 6
//     const decimal1 = 18
//     const sqrtPriceX86 = BigInt(790462214100016400391391234324212)
//     const prices = sqrtPriceX96ToTokenPricesOriginal(sqrtPriceX86, decimal0, decimal1)
//     console.log(prices)
//     expect(prices[1]).toThrow('overflow')
//   });
});