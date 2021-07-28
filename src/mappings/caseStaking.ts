import {
  CreateStake as CreateStakeEvent,
  WithdrawReward as WithdrawRewardEvent,
  WithdrawStake as WithdrawStakeEvent,
  ReceiveStakeReward as ReceiveStakeRewardEvent,
  CaseStaking
} from '../../generated/CaseStaking/CaseStaking'
import {
  CaseStakingPool,
  CaseUser,
  CaseStakeEntry,
  CaseActivity
} from '../../generated/schema'
import * as Utils from '../utils'
import { Address, BigInt, BigDecimal, log } from '@graphprotocol/graph-ts'

function getStakingPool(caseStakingAddr: Address): CaseStakingPool {
  let pool = CaseStakingPool.load('CaseStakingPool')
  if (pool == null) {
    pool = new CaseStakingPool('CaseStakingPool')
    pool.mintedCaseTokens = Utils.ZERO_DEC
    pool.stakeAmount = Utils.ZERO_DEC
    pool.totalWithdrawnStakeReward = Utils.ZERO_DEC

    let caseStakingContract = CaseStaking.bind(caseStakingAddr)
    pool.caseTokenAddress = caseStakingContract.caseToken().toHex()

    pool.save()
  }
  return pool as CaseStakingPool
}

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

function calcUserAvgAPY(user: CaseUser): BigDecimal {
  let totalStake = Utils.ZERO_DEC
  let totalNormalizedReward = Utils.ZERO_DEC
  for (let i = 0; i < user.stakeList.length; i++) {
    let stakeEntry = CaseStakeEntry.load(Utils.getArrItem<string>(user.stakeList, i))
    if (stakeEntry.active) {
      totalStake = totalStake.plus(stakeEntry.stakeAmount)
      totalNormalizedReward = totalNormalizedReward.plus(stakeEntry.interestAmount.times(BigDecimal.fromString('365')).div(stakeEntry.stakeTimeInDays.toBigDecimal()))
    }
  }
  return totalNormalizedReward.div(totalStake)
}

export function handleCreateStake(event: CreateStakeEvent): void {
  let caseStakingPool = getStakingPool(event.address)
  let user = getUser(event.params.user)

  // create stake entry
  let entity = new CaseStakeEntry('CaseStakeEntry' + '-' + event.params.idx.toString())
  entity.idx = event.params.idx
  entity.staker = user.id
  entity.stakeAmount = Utils.normalize(event.params.stakeAmount, Utils.CASE_DECIMALS)
  entity.interestAmount = Utils.normalize(event.params.interestAmount, Utils.CASE_DECIMALS)
  entity.withdrawnInterestAmount = Utils.ZERO_DEC
  entity.stakeTimestamp = event.block.timestamp
  entity.stakeTimeInDays = event.params.stakeTimeInDays
  entity.active = true
  entity.apy = entity.interestAmount.times(BigDecimal.fromString('365')).div(entity.stakeTimeInDays.toBigDecimal()).div(entity.stakeAmount)
  entity.save()

  // update user

  user.stakeAmount = user.stakeAmount.plus(entity.stakeAmount)
  user.totalStakeReward = user.totalStakeReward.plus(entity.interestAmount)
  let stakeList = user.stakeList
  stakeList.push(entity.id)
  user.stakeList = stakeList
  user.avgAPY = calcUserAvgAPY(user)
  user.save()

  // update pool
  caseStakingPool.stakeAmount = caseStakingPool.stakeAmount.plus(entity.stakeAmount)
  caseStakingPool.mintedCaseTokens = caseStakingPool.mintedCaseTokens.plus(entity.interestAmount)
  caseStakingPool.save()

  // add activity entry
  let activity = new CaseActivity('CaseActivity' + '-' + user.id + '-' + event.transaction.hash.toHex() + '-' + event.transactionLogIndex.toString())
  activity.user = user.id
  activity.type = 'CreateStake'
  activity.timestamp = event.block.timestamp
  activity.txAmount = entity.stakeAmount
  activity.txHash = event.transaction.hash.toHex()
  activity.save()
}

export function handleWithdrawReward(event: WithdrawRewardEvent): void {
  let caseStakingPool = getStakingPool(event.address)
  let user = getUser(event.params.user)
  let entry = CaseStakeEntry.load('CaseStakeEntry' + '-' + event.params.idx.toString())

  let rewardAmount = Utils.normalize(event.params.rewardAmount, Utils.CASE_DECIMALS)

  // update stake entry
  entry.withdrawnInterestAmount = entry.withdrawnInterestAmount.plus(rewardAmount)
  entry.save()

  // update user
  user.totalWithdrawnStakeReward = user.totalWithdrawnStakeReward.plus(rewardAmount)
  user.save()

  // update pool
  caseStakingPool.totalWithdrawnStakeReward = caseStakingPool.totalWithdrawnStakeReward.plus(rewardAmount)
  caseStakingPool.save()

  // add activity entry
  let activity = new CaseActivity('CaseActivity' + '-' + user.id + '-' + event.transaction.hash.toHex() + '-' + event.transactionLogIndex.toString())
  activity.user = user.id
  activity.type = 'WithdrawReward'
  activity.timestamp = event.block.timestamp
  activity.txAmount = rewardAmount
  activity.txHash = event.transaction.hash.toHex()
  activity.save()
}

export function handleReceiveStakeReward(event: ReceiveStakeRewardEvent): void {
  let caseStakingPool = getStakingPool(event.address)
  let user = getUser(event.params.user)

  let rewardAmount = Utils.normalize(event.params.rewardAmount, Utils.CASE_DECIMALS)

  // update user
  user.totalWithdrawnStakeReward = user.totalWithdrawnStakeReward.plus(rewardAmount)
  user.save()

  // update pool
  caseStakingPool.totalWithdrawnStakeReward = caseStakingPool.totalWithdrawnStakeReward.plus(rewardAmount)
  caseStakingPool.save()

  // add activity entry
  let activity = new CaseActivity('CaseActivity' + '-' + user.id + '-' + event.transaction.hash.toHex() + '-' + event.transactionLogIndex.toString())
  activity.user = user.id
  activity.type = 'WithdrawReward'
  activity.timestamp = event.block.timestamp
  activity.txAmount = rewardAmount
  activity.txHash = event.transaction.hash.toHex()
  activity.save()
}

export function handleWithdrawStake(event: WithdrawStakeEvent): void {
  let caseStakingPool = getStakingPool(event.address)
  let user = getUser(event.params.user)
  let entry = CaseStakeEntry.load('CaseStakeEntry' + '-' + event.params.idx.toString())

  // update stake entry
  entry.active = false
  entry.save()

  // update user
  user.stakeAmount = user.stakeAmount.minus(entry.stakeAmount)
  user.avgAPY = calcUserAvgAPY(user)
  user.save()

  // update pool
  caseStakingPool.stakeAmount = caseStakingPool.stakeAmount.minus(entry.stakeAmount)
  caseStakingPool.save()

  // add activity entry
  let activity = new CaseActivity('CaseActivity' + '-' + user.id + '-' + event.transaction.hash.toHex() + '-' + event.transactionLogIndex.toString())
  activity.user = user.id
  activity.type = 'WithdrawStake'
  activity.timestamp = event.block.timestamp
  activity.txAmount = entry.stakeAmount
  activity.txHash = event.transaction.hash.toHex()
  activity.save()
}