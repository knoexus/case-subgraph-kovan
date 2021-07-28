import { BigInt, Address, BigDecimal, ethereum, DataSourceContext } from '@graphprotocol/graph-ts'

// Constants

export let ZERO_INT = BigInt.fromI32(0)
export let ZERO_DEC = BigDecimal.fromString('0')
export let ONE_INT = BigInt.fromI32(1)
export let ONE_DEC = BigDecimal.fromString('1')
export let NEGONE_DEC = BigDecimal.fromString('-1')
export let PRECISION = new BigDecimal(tenPow(18))
export let USDC_ADDR = Address.fromString("0x5592ec0cfb4dbc12d3ab100b257153436a1f0fea")
export let ETH_ADDR = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
export let ZERO_ADDR = '0x0000000000000000000000000000000000000000'
export let RECORD_INTERVAL = BigInt.fromI32(24 * 60 * 60 / 15) // 24 hours if avg block time is 15 seconds
export let PRICE_INTERVAL = BigInt.fromI32(5 * 60 / 15) // 5 minutes if avg block time is 15 seconds
export let LATEST_BLOCK = BigInt.fromI32(7009000 + 100)

export let CASE_DECIMALS = 8

// Helpers

export function tenPow(exponent: number): BigInt {
  let result = BigInt.fromI32(1)
  for (let i = 0; i < exponent; i++) {
    result = result.times(BigInt.fromI32(10))
  }
  return result
}

export function getArrItem<T>(arr: Array<T>, idx: i32): T {
  let a = new Array<T>()
  a = a.concat(arr)
  return a[idx]
}

export function normalize(i: BigInt, decimals: number = 18): BigDecimal {
  return i.toBigDecimal().div(tenPow(decimals).toBigDecimal())
}