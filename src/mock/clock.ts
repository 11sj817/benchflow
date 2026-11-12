import dayjs from 'dayjs'

/** 演示数据时间基准：以当前时间为锚点，保证“最近活动”始终贴近现在。 */
export function makeClock(base = dayjs()) {
  const at = (daysAgo: number, hour = 10, minute = 0): string =>
    base.subtract(daysAgo, 'day').hour(hour).minute(minute).second(0).millisecond(0).format('YYYY-MM-DDTHH:mm:ss')
  const day = (offsetDays: number): string => base.add(offsetDays, 'day').format('YYYY-MM-DD')
  return { at, day, base }
}

export type Clock = ReturnType<typeof makeClock>
