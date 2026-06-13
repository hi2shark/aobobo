const lineColorMap = {};
const lineColors = [];
const defaultColors = [
  '#4e90ff', '#27c975', '#ffbe56', '#ff687e',
  '#70f3ff', '#a78bfa', '#fb923c', '#38bdf8',
  '#f472b6', '#34d399', '#fbbf24', '#f87171',
  '#22d3ee', '#c084fc', '#fb923c', '#2dd4bf',
];

export function getThreshold(data) {
  const filteredData = data.filter((value) => value !== 0 && value !== null);

  if (filteredData.length === 0) {
    return {
      median: 0,
      tolerancePercent: 0.2,
      min: 0,
      max: 0,
    };
  }

  const sortedData = [...filteredData].sort((a, b) => Math.ceil(a) - Math.ceil(b));
  const len = sortedData.length;
  const trimCount = Math.floor(len * 0.1);

  let dataForMedian;
  if (trimCount >= 1) {
    dataForMedian = sortedData.slice(trimCount, len - trimCount);
  } else {
    dataForMedian = sortedData;
  }

  const medianLen = dataForMedian.length;
  const median = medianLen % 2 === 0
    ? (dataForMedian[medianLen / 2 - 1] + dataForMedian[medianLen / 2]) / 2
    : dataForMedian[Math.floor(medianLen / 2)];

  let tolerancePercent;
  if (median <= 10) {
    tolerancePercent = 0.50;
  } else if (median <= 30) {
    tolerancePercent = 0.35;
  } else if (median <= 50) {
    tolerancePercent = 0.25;
  } else if (median <= 100) {
    tolerancePercent = 0.20;
  } else {
    tolerancePercent = 0.15;
  }

  return {
    median,
    tolerancePercent,
    min: sortedData[0],
    max: sortedData[len - 1],
  };
}

export function getLineColor(name) {
  if (lineColorMap[name]) {
    return lineColorMap[name];
  }
  const color = defaultColors[lineColors.length % defaultColors.length];
  lineColorMap[name] = color;
  lineColors.push(color);
  return color;
}
