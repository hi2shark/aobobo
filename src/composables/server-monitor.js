const lineColorMap = {};
const lineColors = [];
const defaultColors = [
  '#5470C6', '#91CC75', '#FAC858', '#EE6666',
  '#73C0DE', '#3BA272', '#FC8452', '#9A60B4',
  '#EA7CCC', '#C23531', '#2F4554', '#61A0A8',
  '#D48265', '#91C7AE', '#749F83', '#CA8622',
  '#BDA29A', '#6E7074', '#546570', '#C4CCD3',
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
