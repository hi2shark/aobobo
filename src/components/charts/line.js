import { use } from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';
import { LineChart } from 'echarts/charts';
import {
  TooltipComponent,
  GridComponent,
  DataZoomComponent,
} from 'echarts/components';
import dayjs from 'dayjs';

use([
  SVGRenderer,
  LineChart,
  TooltipComponent,
  GridComponent,
  DataZoomComponent,
]);

export default (options) => {
  const {
    dateList,
    valueList,
    mode = 'dark',
    connectNulls = true,
    themeColors = {},
  } = options || {};

  const isDark = mode === 'dark';
  const {
    textPrimary = isDark ? '#f4f8ff' : '#1c2840',
    textSecondary = isDark ? '#a2b0c5' : '#5a6b84',
    textMuted = isDark ? '#6f7c92' : '#8290a5',
    borderColor = isDark ? 'rgba(146,169,204,0.18)' : 'rgba(154,169,191,0.28)',
    accentPrimary = isDark ? '#4e90ff' : '#4383ff',
  } = themeColors;

  const tooltipBg = isDark
    ? 'rgba(11, 19, 31, 0.92)'
    : 'rgba(255, 255, 255, 0.96)';
  const tooltipBorder = isDark
    ? 'rgba(146, 169, 204, 0.2)'
    : 'rgba(161, 177, 202, 0.35)';
  const tooltipText = textPrimary;
  const tooltipTime = accentPrimary;
  const gridLine = isDark
    ? 'rgba(255, 255, 255, 0.08)'
    : 'rgba(0, 0, 0, 0.06)';
  const dataZoomBg = isDark
    ? 'rgba(255, 255, 255, 0.05)'
    : 'rgba(142, 161, 190, 0.12)';
  const dataZoomFiller = isDark
    ? 'rgba(255, 255, 255, 0.12)'
    : 'rgba(67, 131, 255, 0.18)';
  const dataZoomHandle = isDark
    ? 'rgba(255, 255, 255, 0.35)'
    : 'rgba(67, 131, 255, 0.6)';

  const option = {
    darkMode: isDark,
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'line',
        lineStyle: {
          color: accentPrimary,
          type: 'dashed',
          width: 1,
        },
      },
      formatter: (params) => {
        const time = dayjs(parseInt(params[0].axisValue, 10)).format('YYYY.MM.DD HH:mm');
        const itemStyle = 'display:flex;align-items:center;gap:6px;margin:3px 0;';
        const labelStyle = `color:${textSecondary};`;
        const valueStyle = `font-weight:600;color:${textPrimary};`;
        let res = `<p style='margin:0 0 6px;font-weight:700;color:${tooltipTime};'>${time}</p>`;
        if (params.length < 10) {
          params.forEach((i) => {
            res += i.value[1]
              ? `<div style='${itemStyle}'>${i.marker}`
                + `<span style='${labelStyle}'>${i.seriesName}:</span>`
                + `<span style='${valueStyle}'>${i.value[1]}ms</span></div>`
              : '';
          });
        } else {
          res += "<table style='border-collapse:collapse;'>";
          let trEnd = false;
          params.forEach((i, index) => {
            if (index % 2 === 0) {
              res += '<tr>';
            }
            res += i.value[1]
              ? `<td style='padding:2px 8px 2px 0;'>${i.marker} `
                + `<span style='${labelStyle}'>${i.seriesName}:</span> `
                + `<span style='${valueStyle}'>${i.value[1]}ms</span></td>`
              : "<td style='padding:2px 8px 2px 0;'></td>";
            if (index % 2 === 1) {
              res += '</tr>';
              trEnd = true;
            }
          });
          if (!trEnd) {
            res += '</tr>';
          }
          res += '</table>';
        }
        return res;
      },
      backgroundColor: tooltipBg,
      borderColor: tooltipBorder,
      borderWidth: 1,
      padding: [10, 14],
      borderRadius: 10,
      textStyle: {
        color: tooltipText,
        fontSize: 13,
      },
      extraCssText: `
        backdrop-filter: blur(12px) saturate(160%);
        -webkit-backdrop-filter: blur(12px) saturate(160%);
        box-shadow: 0 18px 38px rgba(2, 6, 23, 0.28);
      `,
    },
    grid: {
      top: 10,
      left: 5,
      right: 5,
      bottom: 50,
      containLabel: true,
    },
    dataZoom: [{
      id: 'dataZoomX',
      type: 'slider',
      xAxisIndex: [0],
      filterMode: 'filter',
      height: 18,
      bottom: 10,
      borderColor: 'transparent',
      backgroundColor: dataZoomBg,
      fillerColor: dataZoomFiller,
      handleStyle: {
        color: dataZoomHandle,
        borderColor: dataZoomHandle,
        borderWidth: 1,
        shadowBlur: 4,
        shadowColor: 'rgba(0, 0, 0, 0.2)',
      },
      moveHandleStyle: {
        color: dataZoomHandle,
      },
      selectedDataBackground: {
        lineStyle: {
          color: accentPrimary,
        },
        areaStyle: {
          color: accentPrimary,
          opacity: 0.2,
        },
      },
      dataBackground: {
        lineStyle: {
          color: textMuted,
          opacity: 0.5,
        },
        areaStyle: {
          color: textMuted,
          opacity: 0.1,
        },
      },
      emphasis: {
        handleStyle: {
          color: accentPrimary,
        },
      },
    }],
    yAxis: {
      type: 'value',
      splitLine: {
        lineStyle: {
          color: gridLine,
        },
      },
      axisLine: {
        show: false,
      },
      axisTick: {
        show: false,
      },
      axisLabel: {
        color: textSecondary,
        fontSize: 11,
      },
    },
    xAxis: {
      type: 'time',
      data: dateList,
      axisLine: {
        lineStyle: {
          color: borderColor,
        },
      },
      axisTick: {
        show: false,
      },
      axisLabel: {
        hideOverlap: true,
        nameTextStyle: {
          fontSize: 11,
        },
        color: textSecondary,
      },
      splitLine: {
        show: false,
      },
    },
    series: valueList.map((i) => ({
      ...i,
      type: 'line',
      smooth: true,
      connectNulls,
      legendHoverLink: false,
      symbol: 'none',
      lineStyle: {
        width: 2,
        ...(i.lineStyle || {}),
      },
      areaStyle: {
        opacity: 0.12,
        color: i.itemStyle?.color || i.lineStyle?.color || accentPrimary,
      },
    })),
  };
  return option;
};
