import {
  Register as RegisterEvent,
  RankChange as RankChangeEvent,
  PayCommission as PayCommissionEvent,
  ChangedCareerValue as ChangedCareerValueEvent
} from '../../generated/CaseReward/CaseReward'
import {
  CaseUser,
  CaseCommission
} from '../../generated/schema'
import * as Utils from '../utils'
import { Address, BigInt, BigDecimal, log } from '@graphprotocol/graph-ts'

function getUser(address: Address): CaseUser {
  let entity = CaseUser.load(address.toHex())
  if (entity == null) {
    entity = new CaseUser(address.toHex())
    entity.address = address.toHex()
    entity.referrer = ''
    entity.rank = Utils.ZERO_INT
    entity.careerValue = Utils.ZERO_DEC
    entity.totalCaseCommissionReceived = Utils.ZERO_DEC
    let newArray = new Array<BigInt>(8)
    for (let i = 0; i < 8; i++) {
      newArray[i] = Utils.ZERO_INT
    }
    entity.referLevelUserCounts = newArray
    let newDecArray = new Array<BigDecimal>(8)
    for (let i = 0; i < 8; i++) {
      newDecArray[i] = Utils.ZERO_DEC
    }
    entity.referLevelCaseCommissions = newDecArray
    entity.stakeAmount = Utils.ZERO_DEC
    entity.totalStakeReward = Utils.ZERO_DEC
    entity.totalWithdrawnStakeReward = Utils.ZERO_DEC
    entity.avgAPY = Utils.ZERO_DEC
    entity.stakeList = new Array<string>()
    entity.save()
  }
  return entity as CaseUser
}

export function handleRegister(event: RegisterEvent): void {
  let user = getUser(event.params.user)
  if (event.params.referrer.toHex() === Utils.ZERO_ADDR) {
    return
  }
  let referrer = getUser(event.params.referrer)

  // update user
  user.referrer = referrer.id
  user.save()

  // update referrer
  let ptr = referrer.id
  let level = 0
  while (ptr.length > 0 && level < 8) {
    let ptrEntity = getUser(Address.fromString(ptr))
    let userCounts = ptrEntity.referLevelUserCounts
    userCounts[level] = userCounts[level].plus(Utils.ONE_INT)
    ptrEntity.referLevelUserCounts = userCounts
    ptrEntity.save()

    level += 1
    ptr = ptrEntity.referrer
  }
}

export function handleRankChange(event: RankChangeEvent): void {
  let user = getUser(event.params.user)

  // update user rank
  user.rank = event.params.newRank
  user.save()
}

export function handlePayCommission(event: PayCommissionEvent): void {
  let user = getUser(event.params.referrer)
  let recipient = getUser(event.params.recipient)

  // add activity entry
  let activity = new CaseCommission('CaseCommission' + '-' + user.id + '-' + event.transaction.hash.toHex() + '-' + event.transactionLogIndex.toString())
  activity.user = user.id
  activity.timestamp = event.block.timestamp
  let decimals = Utils.CASE_DECIMALS
  activity.txAmount = Utils.normalize(event.params.amount, decimals)
  activity.token = event.params.token.toHex()
  activity.recipient = event.params.recipient.toHex()
  activity.level = BigInt.fromI32(event.params.level).plus(Utils.ONE_INT)
  activity.save()

  // update recipient
  recipient.totalCaseCommissionReceived = recipient.totalCaseCommissionReceived.plus(activity.txAmount)
  let referLevelCaseCommissions = recipient.referLevelCaseCommissions
  referLevelCaseCommissions[event.params.level] = referLevelCaseCommissions[event.params.level].plus(activity.txAmount)
  recipient.referLevelCaseCommissions = referLevelCaseCommissions
  
  recipient.save()
}

export function handleChangedCareerValue(event: ChangedCareerValueEvent): void {
  let user = getUser(event.params.user)

  // update user CV
  let changeAmount = Utils.normalize(event.params.changeAmount).times(event.params.positive ? Utils.ONE_DEC : Utils.NEGONE_DEC)
  user.careerValue = user.careerValue.plus(changeAmount)
  user.save()
}