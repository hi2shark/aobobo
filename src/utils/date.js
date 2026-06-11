import dayjs from 'dayjs';

export const duration = (startDate, endDate, noSub = false) => {
  const startTime = dayjs(startDate).valueOf();
  const endTime = dayjs(endDate).valueOf();
  const diff = endTime - startTime;

  if (diff < 0) return '刚刚启动';

  const second = 1000;
  const minute = second * 60;
  const hour = minute * 60;
  const day = hour * 24;

  if (diff < minute) return `${Math.floor(diff / second)}秒`;
  if (diff < hour) {
    if (noSub) return `${Math.floor(diff / minute)}分钟`;
    return `${Math.floor(diff / minute)}分钟${Math.floor((diff % minute) / second)}秒`;
  }
  if (diff < day) {
    if (noSub) return `${Math.floor(diff / hour)}小时`;
    return `${Math.floor(diff / hour)}小时${Math.floor((diff % hour) / minute)}分钟`;
  }
  return `${Math.floor(diff / day)}天`;
};

export const duration2 = (startDate, endDate) => {
  const startTime = dayjs(startDate).valueOf();
  const endTime = dayjs(endDate).valueOf();
  const diff = endTime - startTime;

  const second = 1000;
  const minute = second * 60;
  const hour = minute * 60;
  const day = hour * 24;

  return {
    days: Math.floor(diff / day),
    hours: Math.floor(diff / hour) % 24,
    minutes: Math.floor(diff / minute) % 60,
    seconds: Math.floor(diff / second) % 60,
    $unit: { day: '天', hour: '小时', minute: '分钟', second: '秒' },
  };
};
