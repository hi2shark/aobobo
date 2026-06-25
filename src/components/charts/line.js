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

function alphaColor(color, alpha, fallback) {
  if (!color) return fallback;
  const normalizedAlpha = Math.max(0, Math.min(alpha, 1));
  const hexMatch = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);

  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) {
      hex = hex.split('').map((s) => s + s).join('');
    }
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${normalizedAlpha})`;
  }

  const rgbMatch = color.match(/^rgba?\(([^)]+)\)$/i);
  if (rgbMatch) {
    const channels = rgbMatch[1].split(',').slice(0, 3).map((s) => s.trim());
    if (channels.length === 3) {
      return `rgba(${channels.join(', ')}, ${normalizedAlpha})`;
    }
  }

  return fallback;
}

export default (options) => {
  const {
    dateList,
    valueList,
    mode = 'dark',
    connectNulls = true,
    chartConfig = {},
    themeColors = {},
  } = options || {};
  const {
    showDataZoom = true,
    grid: gridConfig = {},
    xAxis: xAxisConfig = {},
    yAxis: yAxisConfig = {},
    tooltip: tooltipConfig = {},
    series: seriesConfig = {},
  } = chartConfig;

  const isDark = mode === 'dark';
  const {
    textPrimary = isDark ? '#f4f8ff' : '#1c2840',
    textSecondary = isDark ? '#a2b0c5' : '#5a6b84',
    textMuted = isDark ? '#6f7c92' : '#8290a5',
    borderColor = isDark ? 'rgba(146,169,204,0.18)' : 'rgba(154,169,191,0.28)',
    accentPrimary = isDark ? '#4e90ff' : '#4383ff',
    panelBg = isDark ? 'rgba(255,255,255,0.028)' : 'rgba(245,249,255,0.92)',
    surfaceSubtle = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(154,169,191,0.08)',
    progressTrack = isDark ? 'rgba(154,170,190,0.16)' : 'rgba(161,177,202,0.18)',
  } = themeColors;

  const tooltipBg = isDark
    ? 'rgba(8, 15, 24, 0.92)'
    : 'rgba(255, 255, 255, 0.94)';
  const tooltipBorder = isDark
    ? 'rgba(128, 148, 168, 0.2)'
    : 'rgba(161, 177, 202, 0.26)';
  const tooltipText = textPrimary;
  const tooltipTime = accentPrimary;
  const gridLine = isDark
    ? 'rgba(255, 255, 255, 0.055)'
    : 'rgba(67, 88, 120, 0.085)';
  const axisLine = isDark
    ? 'rgba(146, 169, 204, 0.12)'
    : 'rgba(154, 169, 191, 0.2)';
  const dataZoomBg = progressTrack;
  const dataZoomFiller = alphaColor(accentPrimary, isDark ? 0.16 : 0.13, surfaceSubtle);
  const dataZoomHandle = alphaColor(accentPrimary, isDark ? 0.78 : 0.64, accentPrimary);
  const dataShadow = alphaColor(accentPrimary, isDark ? 0.18 : 0.14, surfaceSubtle);
  const tooltipShadow = isDark
    ? '0 22px 48px rgba(2, 7, 19, 0.42), inset 0 1px 0 rgba(255, 255, 255, 0.04)'
    : '0 24px 48px rgba(160, 177, 203, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.78)';
  const tooltipValueFormatter = tooltipConfig.valueFormatter;
  const tooltipTimeFormatter = tooltipConfig.timeFormatter;
  const yAxisLabelFormatter = yAxisConfig.formatter;
  const xAxisLabelFormatter = xAxisConfig.formatter;
  const baseGrid = {
    top: 12,
    left: 6,
    right: 10,
    bottom: showDataZoom ? 52 : 24,
    containLabel: true,
  };

  const option = {
    darkMode: isDark,
    backgroundColor: 'transparent',
    animationDuration: 360,
    animationEasing: 'cubicOut',
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'line',
        lineStyle: {
          color: alphaColor(accentPrimary, isDark ? 0.82 : 0.74, accentPrimary),
          type: 'dashed',
          width: 1,
        },
      },
      formatter: (params) => {
        const axisValue = parseInt(params?.[0]?.axisValue, 10);
        const time = tooltipTimeFormatter
          ? tooltipTimeFormatter(axisValue, params)
          : dayjs(axisValue).format('YYYY.MM.DD HH:mm');
        const itemStyle = 'display:flex;align-items:center;gap:7px;margin:4px 0;line-height:1.35;';
        const labelStyle = `color:${textSecondary};max-width:180px;`
          + 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
        const valueStyle = `font-weight:600;color:${textPrimary};`;
        const timeStyle = 'margin:0 0 8px;font-family:var(--font-mono);'
          + `font-size:12px;font-weight:700;color:${tooltipTime};`;
        let res = `<p style='${timeStyle}'>${time}</p>`;
        if (params.length < 10) {
          params.forEach((i) => {
            const pointValue = Array.isArray(i.value) ? i.value[1] : undefined;
            const hasValue = pointValue !== null && pointValue !== undefined && !Number.isNaN(pointValue);
            const content = tooltipValueFormatter
              ? tooltipValueFormatter(pointValue, i)
              : `${pointValue}ms`;
            res += hasValue
              ? `<div style='${itemStyle}'>${i.marker}`
                + `<span style='${labelStyle}'>${i.seriesName}:</span>`
                + `<span style='${valueStyle}'>${content}</span></div>`
              : '';
          });
        } else {
          res += "<table style='border-collapse:collapse;'>";
          let trEnd = false;
          params.forEach((i, index) => {
            if (index % 2 === 0) {
              res += '<tr>';
            }
            const pointValue = Array.isArray(i.value) ? i.value[1] : undefined;
            const hasValue = pointValue !== null && pointValue !== undefined && !Number.isNaN(pointValue);
            const content = tooltipValueFormatter
              ? tooltipValueFormatter(pointValue, i)
              : `${pointValue}ms`;
            res += hasValue
              ? `<td style='padding:2px 8px 2px 0;'>${i.marker} `
                + `<span style='${labelStyle}'>${i.seriesName}:</span> `
                + `<span style='${valueStyle}'>${content}</span></td>`
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
      padding: [11, 13],
      borderRadius: 12,
      textStyle: {
        color: tooltipText,
        fontSize: 13,
      },
      extraCssText: `
        backdrop-filter: blur(12px) saturate(160%);
        -webkit-backdrop-filter: blur(12px) saturate(160%);
        box-shadow: ${tooltipShadow};
      `,
    },
    grid: {
      ...baseGrid,
      ...gridConfig,
    },
    dataZoom: showDataZoom ? [{
      id: 'dataZoomX',
      type: 'slider',
      xAxisIndex: [0],
      filterMode: 'filter',
      height: 16,
      bottom: 12,
      borderColor,
      borderRadius: 8,
      backgroundColor: dataZoomBg,
      fillerColor: dataZoomFiller,
      showDetail: false,
      brushSelect: false,
      showDataShadow: true,
      handleSize: '70%',
      handleStyle: {
        color: dataZoomHandle,
        borderColor: dataZoomHandle,
        borderWidth: 1,
        shadowBlur: 8,
        shadowColor: alphaColor(accentPrimary, isDark ? 0.24 : 0.16, 'rgba(0, 0, 0, 0.16)'),
      },
      moveHandleStyle: {
        color: dataZoomHandle,
      },
      selectedDataBackground: {
        lineStyle: {
          color: dataShadow,
          width: 1,
        },
        areaStyle: {
          color: dataShadow,
          opacity: 0.16,
        },
      },
      dataBackground: {
        lineStyle: {
          color: textMuted,
          opacity: 0.28,
        },
        areaStyle: {
          color: surfaceSubtle,
          opacity: 0.22,
        },
      },
      emphasis: {
        handleStyle: {
          color: accentPrimary,
        },
      },
    }] : [],
    yAxis: {
      type: 'value',
      min: yAxisConfig.min,
      max: yAxisConfig.max,
      interval: yAxisConfig.interval,
      splitLine: {
        lineStyle: {
          color: gridLine,
          type: 'dashed',
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
        fontFamily: 'var(--font-mono)',
        formatter: yAxisLabelFormatter,
      },
    },
    xAxis: {
      type: 'time',
      data: dateList,
      min: xAxisConfig.min,
      max: xAxisConfig.max,
      axisLine: {
        lineStyle: {
          color: axisLine,
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
        fontFamily: 'var(--font-mono)',
        formatter: xAxisLabelFormatter,
      },
      splitLine: {
        show: false,
      },
    },
    series: valueList.map((i) => ({
      ...i,
      type: 'line',
      smooth: seriesConfig.smooth ?? true,
      connectNulls,
      legendHoverLink: false,
      symbol: 'none',
      sampling: 'lttb',
      lineStyle: {
        width: seriesConfig.lineWidth ?? 1.8,
        shadowBlur: 4,
        shadowColor: alphaColor(i.itemStyle?.color || i.lineStyle?.color, 0.12, 'transparent'),
        ...(i.lineStyle || {}),
      },
      areaStyle: {
        opacity: seriesConfig.areaOpacity ?? 1,
        color: alphaColor(
          i.itemStyle?.color || i.lineStyle?.color || accentPrimary,
          seriesConfig.areaAlpha ?? (isDark ? 0.1 : 0.08),
          panelBg,
        ),
      },
      emphasis: {
        focus: 'series',
        lineStyle: {
          width: 2.4,
        },
      },
    })),
  };
  return option;
};
