<template>
  <transition name="modal-fade">
    <div
      v-if="visible"
      class="stats-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="stats-modal-title"
      @click.self="handleClose"
    >
      <div class="stats-modal-card">
        <div class="stats-modal-header">
          <div class="stats-modal-title-group">
            <span class="stats-modal-icon" aria-hidden="true">
              <i class="ri-dashboard-3-line" />
            </span>
            <h3 id="stats-modal-title">服务器资源概览</h3>
          </div>
          <button
            type="button"
            class="stats-modal-close"
            aria-label="关闭"
            @click="handleClose"
          >
            <i class="ri-close-line" />
          </button>
        </div>

        <div class="stats-modal-body">
          <section class="overview-band">
            <div class="overview-main">
              <span class="overview-label">服务器总数</span>
              <div class="overview-value">
                <strong>{{ display.totalServers || 0 }}</strong>
                <span>台</span>
              </div>
            </div>
            <div class="overview-chips">
              <span class="stat-badge online">
                <i class="ri-checkbox-blank-circle-fill" />
                {{ display.onlineServers || 0 }} 在线
              </span>
              <span v-if="display.offlineServers > 0" class="stat-badge offline">
                <i class="ri-checkbox-blank-circle-fill" />
                {{ display.offlineServers }} 离线
              </span>
              <span
                v-for="group in display.groupCounts || []"
                :key="group.name"
                class="stat-badge"
              >
                {{ group.name }} {{ group.count }}
              </span>
            </div>
          </section>

          <section class="dashboard-section dashboard-section--resources">
            <div class="section-heading">
              <span class="section-icon" aria-hidden="true">
                <i class="ri-cpu-line" />
              </span>
              <div>
                <h4>资源池</h4>
                <span>CPU / 内存 / 硬盘 / 余量</span>
              </div>
            </div>

            <div class="resource-grid">
              <div class="metric-cell metric-cell--wide">
                <span class="metric-label">总核心数</span>
                <div class="metric-value-row">
                  <strong>{{ display.totalCores || 0 }}</strong>
                  <span>C</span>
                </div>
                <div v-if="display.cpuBrandCores?.length" class="metric-tags">
                  <span
                    v-for="item in display.cpuBrandCores || []"
                    :key="item.brand"
                    class="stat-badge"
                  >
                    {{ item.brand }} {{ item.cores }}C
                  </span>
                </div>
              </div>

              <div class="metric-cell">
                <span class="metric-label">总内存</span>
                <div class="metric-value-row">
                  <strong>{{ display.totalMemory?.value || 0 }}</strong>
                  <span>{{ display.totalMemory?.unit || 'B' }}</span>
                </div>
              </div>

              <div class="metric-cell">
                <span class="metric-label">总硬盘</span>
                <div class="metric-value-row">
                  <strong>{{ display.totalDisk?.value || 0 }}</strong>
                  <span>{{ display.totalDisk?.unit || 'B' }}</span>
                </div>
              </div>

              <div class="metric-cell">
                <span class="metric-label">剩余流量</span>
                <div class="metric-value-row">
                  <strong :class="{ muted: !display.remainingTraffic?.hasData }">
                    {{ display.remainingTraffic?.hasData ? display.remainingTraffic.value : '—' }}
                  </strong>
                  <span v-if="display.remainingTraffic?.hasData">
                    {{ display.remainingTraffic.unit }}
                  </span>
                </div>
              </div>
            </div>
          </section>

          <div class="detail-panels">
            <section class="dashboard-section">
              <div class="section-heading">
                <span class="section-icon" aria-hidden="true">
                  <i class="ri-arrow-up-down-line" />
                </span>
                <div>
                  <h4>流量</h4>
                  <span>累计传输</span>
                </div>
              </div>
              <div class="headline-metric">
                <span>总流量</span>
                <strong>
                  {{ display.totalTransfer?.value || 0 }}
                  <small>{{ display.totalTransfer?.unit || 'B' }}</small>
                </strong>
              </div>
              <div class="split-row">
                <div>
                  <span class="split-label in">
                    <i class="ri-arrow-down-line" />
                    入站
                  </span>
                  <strong>{{ display.netInTransfer?.value || 0 }}{{ display.netInTransfer?.unit || 'B' }}</strong>
                </div>
                <div>
                  <span class="split-label out">
                    <i class="ri-arrow-up-line" />
                    出站
                  </span>
                  <strong>{{ display.netOutTransfer?.value || 0 }}{{ display.netOutTransfer?.unit || 'B' }}</strong>
                </div>
              </div>
            </section>

            <section class="dashboard-section dashboard-section--cost">
              <div class="section-heading">
                <span class="section-icon" aria-hidden="true">
                  <i class="ri-money-cny-circle-line" />
                </span>
                <div>
                  <h4>成本</h4>
                  <span>{{ display.costSummary?.targetCurrency || 'CNY' }} 折算</span>
                </div>
              </div>
              <div class="cost-grid">
                <div>
                  <span>每月</span>
                  <strong :class="{ muted: !display.hasCostData }">
                    {{ display.hasCostData ? (display.monthlyCost?.display || '—') : '—' }}
                  </strong>
                </div>
                <div>
                  <span>每年</span>
                  <strong :class="{ muted: !display.hasCostData }">
                    {{ display.hasCostData ? (display.yearlyCost?.display || '—') : '—' }}
                  </strong>
                </div>
              </div>
              <div
                class="rate-status"
                :class="{
                  warning: display.costSummary?.unconvertedCount > 0
                    || display.costSummary?.exchangeRate?.error,
                  loading: display.costSummary?.exchangeRate?.loading,
                }"
              >
                <i
                  :class="display.costSummary?.exchangeRate?.loading
                    ? 'ri-refresh-line'
                    : 'ri-exchange-dollar-line'"
                />
                <span>{{ display.costSummary?.exchangeRate?.statusText || '无需汇率' }}</span>
                <small v-if="display.costSummary?.exchangeRate?.updatedAtText">
                  {{ display.costSummary.exchangeRate.updatedAtText }}
                </small>
              </div>
              <div
                v-if="display.costSummary?.sourceCurrencies?.length
                  || display.costSummary?.ignoredCount
                  || display.costSummary?.unconvertedCount"
                class="cost-tags"
              >
                <span
                  v-if="display.costSummary?.sourceCurrencies?.length"
                  class="stat-badge"
                >
                  {{ display.costSummary.sourceCurrencies.join(' / ') }}
                </span>
                <span v-if="display.costSummary?.unconvertedCount" class="stat-badge warning">
                  {{ display.costSummary.unconvertedCount }} 项未换算
                </span>
                <span v-if="display.costSummary?.ignoredCount" class="stat-badge">
                  {{ display.costSummary.ignoredCount }} 项未计入
                </span>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import {
  onMounted,
  onUnmounted,
  watch,
} from 'vue';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  display: {
    type: Object,
    default: () => ({}),
  },
});

const emit = defineEmits(['close']);

function handleClose() {
  emit('close');
}

function handleKeydown(e) {
  if (e.key === 'Escape' && props.visible) {
    handleClose();
  }
}

function updateBodyScroll() {
  if (typeof document === 'undefined') {
    return;
  }
  if (props.visible) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }
}

watch(() => props.visible, updateBodyScroll, { immediate: true });

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
  if (typeof document !== 'undefined') {
    document.body.style.overflow = '';
  }
});
</script>

<style lang="scss" scoped>
.stats-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  background: rgba(2, 7, 16, 0.55);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.stats-modal-card {
  position: relative;
  width: min(792px, calc(100vw - 36px));
  max-height: min(760px, calc(100vh - 36px));
  max-height: min(760px, calc(100dvh - 36px));
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px;
  border-radius: 24px;
  border: 1px solid var(--globe-popup-border);
  background: var(--globe-popup-bg);
  box-shadow: var(--shadow-lg);
  backdrop-filter: blur(24px) saturate(160%);
  color: var(--text-primary);
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.1) 0%, transparent 60%),
      radial-gradient(ellipse at 0% 0%, rgba(var(--accent-cyan-rgb), 0.12), transparent 55%);
    pointer-events: none;
  }
}

.stats-modal-header {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.stats-modal-title-group {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;

  h3 {
    font-size: 17px;
    font-weight: 700;
    line-height: 1.3;
    letter-spacing: 0;
  }
}

.stats-modal-icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  border-radius: 12px;
  border: 1px solid rgba(var(--accent-primary-rgb), 0.2);
  background: rgba(var(--accent-primary-rgb), 0.1);
  color: var(--accent-primary);

  i {
    font-size: 18px;
    line-height: 1;
  }
}

.stats-modal-close {
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--button-subtle-border);
  border-radius: 12px;
  background: var(--button-subtle-bg);
  color: var(--text-secondary);
  cursor: pointer;
  transition:
    color var(--transition-fast),
    background var(--transition-fast),
    border-color var(--transition-fast),
    box-shadow var(--transition-fast),
    transform var(--transition-fast);

  &:hover {
    color: var(--text-on-accent);
    background: var(--button-active-bg);
    border-color: var(--button-active-border);
    box-shadow: var(--button-active-shadow);
    transform: translateY(-1px);
  }

  i {
    font-size: 18px;
  }
}

.stats-modal-body {
  position: relative;
  z-index: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  padding: 2px 8px 8px 0;
  margin-right: -8px;
  scrollbar-gutter: stable;

  > * {
    flex-shrink: 0;
  }
}

.overview-band,
.dashboard-section {
  position: relative;
  border: 1px solid var(--panel-stat-border);
  background: var(--panel-stat-bg);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
  overflow: hidden;
}

.overview-band {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 14px;
  min-height: 78px;
  padding: 13px 15px;
  border-radius: 18px;
  border-color: rgba(var(--accent-primary-rgb), 0.22);
  background:
    linear-gradient(135deg, rgba(var(--accent-primary-rgb), 0.13), transparent 58%),
    var(--panel-stat-bg);
}

.overview-main {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  min-width: 0;
  white-space: nowrap;
  color: var(--text-secondary);

  strong {
    font-family: var(--font-mono);
    font-size: 36px;
    font-weight: 700;
    line-height: 1;
    color: var(--text-primary);
    font-variant-numeric: tabular-nums;
  }
}

.overview-label {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.2;
}

.overview-value {
  display: flex;
  align-items: baseline;
  gap: 6px;
  line-height: 1;

  span {
    font-size: 13px;
    font-weight: 700;
    line-height: 1;
  }
}

.overview-chips,
.metric-tags,
.cost-tags {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 7px;
  min-width: 0;
}

.dashboard-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  border-radius: 18px;
}

.section-heading {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;

  > div {
    min-width: 0;
  }

  h4 {
    margin: 0;
    font-size: 13px;
    font-weight: 700;
    line-height: 1.25;
    color: var(--text-primary);
  }

  > div > span {
    display: block;
    margin-top: 2px;
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 600;
    line-height: 1.2;
  }
}

.section-icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  border-radius: 12px;
  border: 1px solid rgba(var(--accent-primary-rgb), 0.16);
  background: rgba(var(--accent-primary-rgb), 0.08);
  color: var(--accent-primary);

  i {
    font-size: 18px;
    line-height: 1;
  }
}

.resource-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.metric-cell {
  grid-column: span 2;
  min-height: 86px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 8px;
  padding: 11px 12px;
  border-radius: 14px;
  border: 1px solid var(--panel-chip-border);
  background: rgba(var(--accent-primary-rgb), 0.035);
  min-width: 0;
}

.metric-label,
.headline-metric span,
.cost-grid span {
  display: block;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 600;
  line-height: 1.25;
}

.metric-value-row,
.headline-metric strong,
.cost-grid strong {
  min-width: 0;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
}

.metric-value-row {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 5px;
  line-height: 1;

  strong {
    min-width: 0;
    overflow-wrap: anywhere;
    font-size: 24px;
    font-weight: 700;
    line-height: 1;
  }

  span {
    color: var(--text-secondary);
    font-size: 12px;
    font-weight: 700;
  }

  .muted {
    color: var(--text-muted);
  }
}

.detail-panels {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.headline-metric {
  min-height: 58px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid var(--panel-chip-border);
  background: rgba(var(--accent-primary-rgb), 0.04);

  strong {
    display: block;
    overflow-wrap: anywhere;
    font-size: 28px;
    font-weight: 700;
    line-height: 1;
  }

  small {
    margin-left: 4px;
    color: var(--text-secondary);
    font-size: 13px;
    font-weight: 700;
  }
}

.split-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;

  > div {
    min-width: 0;
    display: grid;
    gap: 5px;
    padding: 9px 10px;
    border-radius: 12px;
    border: 1px solid var(--panel-chip-border);
    background: var(--panel-chip-bg);
  }

  strong {
    min-width: 0;
    overflow-wrap: anywhere;
    color: var(--text-primary);
    font-family: var(--font-mono);
    font-size: 13px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    line-height: 1.2;
  }
}

.split-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 700;
  line-height: 1.2;

  &.in i {
    color: var(--net-speed-in-color);
  }

  &.out i {
    color: var(--net-speed-out-color);
  }
}

.cost-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;

  > div {
    min-width: 0;
    display: grid;
    gap: 7px;
    padding: 10px 11px;
    border-radius: 14px;
    border: 1px solid var(--panel-chip-border);
    background: rgba(var(--accent-primary-rgb), 0.04);
  }

  strong {
    overflow-wrap: anywhere;
    font-size: 21px;
    font-weight: 700;
    line-height: 1.1;
  }

  .muted {
    color: var(--text-muted);
  }
}

.rate-status {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  padding: 0 10px;
  border-radius: 12px;
  border: 1px solid var(--panel-chip-border);
  background: var(--panel-chip-bg);
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 700;
  line-height: 1.2;

  i {
    color: var(--accent-primary);
    font-size: 14px;
  }

  small {
    margin-left: auto;
    color: var(--text-muted);
    font-family: var(--font-mono);
    font-size: 10px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  &.warning {
    border-color: rgba(var(--accent-danger-rgb), 0.22);
    background: rgba(var(--accent-danger-rgb), 0.08);

    i {
      color: var(--accent-danger);
    }
  }

  &.loading i {
    animation: spin 0.9s linear infinite;
  }
}

.stat-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 23px;
  max-width: 100%;
  padding: 0 9px;
  border-radius: 999px;
  border: 1px solid var(--panel-chip-border);
  background: var(--panel-chip-bg);
  color: var(--panel-chip-text);
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  letter-spacing: 0;

  i {
    font-size: 8px;
    line-height: 1;
  }

  &.online i {
    color: var(--accent-success);
  }

  &.offline i {
    color: var(--accent-danger);
  }

  &.warning {
    color: var(--accent-danger);
    border-color: rgba(var(--accent-danger-rgb), 0.2);
    background: rgba(var(--accent-danger-rgb), 0.08);
  }
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition:
    opacity var(--transition-normal),
    backdrop-filter var(--transition-normal);
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-active .stats-modal-card,
.modal-fade-leave-active .stats-modal-card {
  transition:
    opacity var(--transition-normal),
    transform var(--transition-normal);
}

.modal-fade-enter-from .stats-modal-card,
.modal-fade-leave-to .stats-modal-card {
  opacity: 0;
  transform: translateY(18px) scale(0.97);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media screen and (max-width: 640px) {
  .stats-modal-overlay {
    padding: 12px;
    align-items: flex-end;
  }

  .stats-modal-card {
    width: 100%;
    max-height: min(760px, calc(100vh - 24px));
    max-height: min(760px, calc(100dvh - 24px));
    border-radius: 24px 24px 20px 20px;
    padding: 14px;
    gap: 10px;
  }

  .stats-modal-body {
    gap: 10px;
    padding: 2px 8px 8px 0;
    margin-right: -8px;
  }

  .stats-modal-header h3 {
    font-size: 16px;
  }

  .overview-band,
  .detail-panels,
  .resource-grid,
  .cost-grid {
    grid-template-columns: 1fr;
  }

  .overview-band {
    align-items: flex-start;
    gap: 10px;
    min-height: 68px;
    padding: 12px;
  }

  .overview-main {
    min-width: 0;

    strong {
      word-break: break-all;
    }
  }

  .dashboard-section {
    gap: 10px;
    padding: 12px;
  }

  .metric-cell {
    grid-column: 1 / -1;
    min-height: 68px;
    padding: 10px;
  }

  .metric-value-row {
    flex-wrap: wrap;

    strong {
      word-break: break-all;
    }
  }

  .headline-metric {
    min-height: 52px;
    padding: 9px 11px;

    strong {
      font-size: 23px;
    }
  }

  .split-row {
    grid-template-columns: 1fr;
  }

  .cost-grid {
    > div {
      padding: 9px;
    }

    strong {
      font-size: 19px;
    }
  }

  .rate-status {
    align-items: flex-start;
    min-height: 0;
    padding: 6px 10px;
    flex-wrap: wrap;

    small {
      margin-left: 0;
    }
  }
}
</style>
