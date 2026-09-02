import { readConfigFile } from './runtime-file-utils.mjs'
import { sleep } from "@geekgeekrun/utils/sleep.mjs"
let {
  isSageTimeEnabled,
  sageTimeOpTimes,
  sageTimePauseMinute,
} = readConfigFile('boss.json')
isSageTimeEnabled = isSageTimeEnabled ?? true
sageTimeOpTimes =
  isNaN(parseInt(sageTimeOpTimes)) ||
  parseInt(sageTimeOpTimes) < 1
    ? 100
    : parseInt(sageTimeOpTimes)
sageTimePauseMinute =
  isNaN(parseFloat(sageTimePauseMinute)) ||
  parseFloat(sageTimePauseMinute) < 0
    ? 15
    : parseFloat(sageTimePauseMinute)
if (parseFloat(sageTimePauseMinute) === 0) {
  isSageTimeEnabled = false
}

let totalEnabledTimes = 0
let recordedOpCount = 0

// 每次 sage 周期（暂停结束）置位一次，由调用方消费来决定业务动作（如关键词轮换）
let sageCycleEndedSignal = 0
export const consumeSageCycleEndedSignal = () => {
  if (sageCycleEndedSignal > 0) {
    sageCycleEndedSignal = 0
    return true
  }
  return false
}
export const waitForSageTimeOrJustContinue = async ({
  tag,
  hooks,
} = {}) => {
  if (!isSageTimeEnabled) {
    return
  }
  const tagText = tag ? ` ${tag}` : ''
  if (recordedOpCount >= sageTimeOpTimes) {
    totalEnabledTimes++
    console.log(`[SageTime${tagText}] 请求已达限制，开启；当前记录次数 ${recordedOpCount}；第 ${totalEnabledTimes} 次开启`)
    await hooks?.sageTimeEnter?.promise({
      tag,
      totalEnabledTimes,
      recordedOpCount,
    })
    await sleep(sageTimePauseMinute * 60 * 1000)
    console.log(`[SageTime${tagText}] 请求限制已解除，关闭；当前记录次数 ${recordedOpCount}；第 ${totalEnabledTimes} 次关闭`)
    await hooks?.sageTimeExit?.promise({
      tag,
      totalEnabledTimes,
      recordedOpCount,
    })
    sageCycleEndedSignal++
    recordedOpCount = 0
  }
  else {
    console.log(`[SageTime${tagText}] 请求未达限制；当前记录次数 ${recordedOpCount}；已开启过 ${totalEnabledTimes} 次`)
    recordedOpCount++
  }
}
