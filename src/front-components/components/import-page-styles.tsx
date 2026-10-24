import type { CSSProperties, ReactNode } from 'react';
import { useTheme } from 'twenty-ui/theme';

export const ImportPageStyles = ({ children }: { children: ReactNode }) => {
  const t = useTheme();
  return (
    <main
      className="rd-import-dashboard"
      style={
        {
          '--ri-bg': t.background.primary,
          '--ri-soft': t.background.secondary,
          '--ri-text': t.font.color.primary,
          '--ri-muted': t.font.color.secondary,
          '--ri-line': t.border.color.light,
          '--ri-accent': t.accent.accent9,
          '--ri-accent-text': t.accent.accent11,
          '--ri-green': t.color.green11,
          '--ri-amber': t.color.orange11,
          '--ri-red': t.color.red11,
        } as CSSProperties
      }
    >
      <style>{`
.rd-import-dashboard {
  box-sizing: border-box;
  width: 100%;
  max-width: 1420px;
  margin: 0 auto;
  padding: 30px 34px 48px;
  color: var(--ri-text);
  font-size: 13px;
  line-height: 1.5;
  container-type: inline-size;
  container-name: rd-import;
}
.rd-import-dashboard * {
  box-sizing: border-box;
}
.rd-import-dashboard h1,
.rd-import-dashboard h2,
.rd-import-dashboard h3,
.rd-import-dashboard p {
  margin: 0;
}
.rd-import-dashboard h1 {
  font-size: 28px;
  line-height: 1.25;
  letter-spacing: -0.8px;
  font-weight: 650;
}
.rd-import-dashboard h2 {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.25px;
}
.rd-import-dashboard h3 {
  font-size: 13px;
  font-weight: 600;
}
.rd-import-dashboard .ri-muted {
  color: var(--ri-muted);
}
.rd-import-dashboard .ri-tiny {
  font-size: 11px;
}
.rd-import-dashboard .ri-eyebrow {
  font-size: 10px;
  letter-spacing: 1.5px;
  font-weight: 650;
  text-transform: uppercase;
  color: var(--ri-muted);
}
.rd-import-dashboard .ri-number {
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.5px;
}
.rd-import-dashboard .ri-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.rd-import-dashboard .ri-between {
  justify-content: space-between;
}
.rd-import-dashboard .ri-stack {
  display: grid;
  gap: 18px;
  min-width: 0;
}
.rd-import-dashboard .ri-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
  margin-bottom: 24px;
}
.rd-import-dashboard .ri-title {
  display: grid;
  gap: 8px;
}
.rd-import-dashboard .ri-connector {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.rd-import-dashboard .ri-app {
  width: 40px;
  height: 40px;
  border-radius: 11px;
  display: grid;
  place-items: center;
  font-weight: 700;
  border: 1px solid var(--ri-line);
  background: var(--ri-soft);
}
.rd-import-dashboard .ri-app-rd {
  color: var(--ri-amber);
}
.rd-import-dashboard .ri-card {
  border: 1px solid var(--ri-line);
  border-radius: 12px;
  background: var(--ri-bg);
  padding: 22px;
  min-width: 0;
}
.rd-import-dashboard .ri-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}
.rd-import-dashboard .ri-card-header p {
  margin-top: 4px;
}
.rd-import-dashboard .ri-overview {
  display: grid;
  grid-template-columns: minmax(0, 1.8fr) minmax(270px, 1fr);
  gap: 20px;
  align-items: start;
}
.rd-import-dashboard .ri-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin: 20px 0;
}
.rd-import-dashboard .ri-metric {
  padding: 18px;
  border: 1px solid var(--ri-line);
  border-radius: 10px;
  background: var(--ri-bg);
}
.rd-import-dashboard .ri-metric-value {
  font-size: 27px;
  font-weight: 600;
  line-height: 1.3;
  margin: 9px 0 4px;
}
.rd-import-dashboard .ri-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 7px;
  background: var(--ri-soft);
  color: var(--ri-muted);
}
.rd-import-dashboard .ri-button {
  display: inline-flex;
  gap: 7px;
  align-items: center;
  justify-content: center;
  min-height: 34px;
  padding: 7px 12px;
  border: 1px solid var(--ri-line);
  border-radius: 7px;
  background: var(--ri-bg);
  color: var(--ri-text);
  font-size: 12px;
  font-weight: 550;
  line-height: 1.3;
  cursor: pointer;
  white-space: nowrap;
  transition:
    background 0.15s,
    box-shadow 0.15s,
    opacity 0.15s;
  text-decoration: none;
}
.rd-import-dashboard .ri-button > span,
.rd-import-dashboard .ri-tab > span,
.rd-import-dashboard .ri-tag > span > span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
}
.rd-import-dashboard .ri-button:hover:not(:disabled) {
  background: var(--ri-soft);
}
.rd-import-dashboard .ri-button-primary {
  background: var(--ri-accent);
  border-color: var(--ri-accent);
  color: #fff;
}
.rd-import-dashboard .ri-button-primary:hover:not(:disabled) {
  background: var(--ri-accent);
  filter: brightness(1.08);
}
.rd-import-dashboard .ri-button:disabled,
.rd-import-dashboard .ri-button[data-disabled] {
  opacity: 0.45;
  cursor: not-allowed;
}
.rd-import-dashboard button:focus-visible,
.rd-import-dashboard input:focus-visible,
.rd-import-dashboard summary:focus-visible {
  outline: 2px solid var(--ri-accent);
  outline-offset: 3px;
}
.rd-import-dashboard .ri-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 550;
  background: var(--ri-soft);
  color: var(--ri-muted);
  border: 1px solid var(--ri-line);
  white-space: nowrap;
}
.rd-import-dashboard .ri-tag-success {
  color: var(--ri-green);
  border-color: color-mix(in srgb, var(--ri-green) 25%, transparent);
  background: color-mix(in srgb, var(--ri-green) 8%, var(--ri-bg));
}
.rd-import-dashboard .ri-tag-warning {
  color: var(--ri-amber);
  background: color-mix(in srgb, var(--ri-amber) 8%, var(--ri-bg));
  border-color: color-mix(in srgb, var(--ri-amber) 25%, transparent);
}
.rd-import-dashboard .ri-tag-danger {
  color: var(--ri-red);
  background: color-mix(in srgb, var(--ri-red) 8%, var(--ri-bg));
  border-color: color-mix(in srgb, var(--ri-red) 25%, transparent);
}
.rd-import-dashboard .ri-tag-accent {
  color: var(--ri-accent-text);
  background: color-mix(in srgb, var(--ri-accent) 8%, var(--ri-bg));
  border-color: color-mix(in srgb, var(--ri-accent) 25%, transparent);
}
.rd-import-dashboard .ri-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  display: inline-block;
  flex-shrink: 0;
}
.rd-import-dashboard .ri-pulse {
  animation: ri-pulse 1.8s ease-in-out infinite;
}
.rd-import-dashboard .ri-spin {
  animation: ri-spin 1.4s linear infinite;
}
@keyframes ri-pulse {
  50% {
    opacity: 0.35;
  }
}
@keyframes ri-spin {
  to {
    transform: rotate(360deg);
  }
}
.rd-import-dashboard .ri-tabs {
  display: flex;
  gap: 20px;
  border-bottom: 1px solid var(--ri-line);
  margin: 24px 0 0;
  position: relative;
}
.rd-import-dashboard .ri-tab {
  display: inline-flex;
  gap: 7px;
  align-items: center;
  background: transparent;
  border: 0;
  border-bottom: 2px solid transparent;
  padding: 12px 2px;
  color: var(--ri-muted);
  cursor: pointer;
  font-size: 13px;
  font-weight: 550;
}
.rd-import-dashboard .ri-tab[data-active] {
  color: var(--ri-text);
  border-bottom-color: var(--ri-accent);
}
.rd-import-dashboard .ri-panel {
  padding-top: 22px;
  min-width: 0;
}
.rd-import-dashboard .ri-panel[hidden] {
  display: none !important;
}
.rd-import-dashboard .ri-progress {
  margin: 18px 0 12px;
  height: 8px;
  background: var(--ri-soft);
  border-radius: 8px;
  overflow: hidden;
}
.rd-import-dashboard .ri-progress [role="progressbar"] {
  height: 8px;
}
.rd-import-dashboard .ri-progress-track {
  height: 8px;
  width: 100%;
  background: var(--ri-soft);
  border-radius: 8px;
  overflow: hidden;
}
.rd-import-dashboard .ri-progress-fill {
  display: block;
  height: 100%;
  background: var(--ri-accent);
  border-radius: 8px;
  transition: width 0.6s ease;
}
.rd-import-dashboard .ri-current {
  border-radius: 9px;
  background: var(--ri-soft);
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 20px;
}
.rd-import-dashboard .ri-current-title {
  font-size: 18px;
  font-weight: 600;
  margin-top: 3px;
}
.rd-import-dashboard .ri-page {
  font-size: 24px;
  font-weight: 600;
  text-align: right;
}
.rd-import-dashboard .ri-facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-top: 20px;
}
.rd-import-dashboard .ri-fact {
  display: grid;
  gap: 4px;
}
.rd-import-dashboard .ri-callout {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 13px 15px;
  border-radius: 8px;
  background: var(--ri-soft);
  border: 1px solid var(--ri-line);
  font-size: 12px;
  line-height: 1.6;
}
.rd-import-dashboard .ri-callout svg {
  flex-shrink: 0;
  margin-top: 2px;
}
.rd-import-dashboard .ri-callout-error {
  border-color: color-mix(in srgb, var(--ri-red) 35%, var(--ri-line));
  color: var(--ri-red);
}
.rd-import-dashboard .ri-resources {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}
.rd-import-dashboard .ri-resources th {
  font-size: 10px;
  font-weight: 550;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: var(--ri-muted);
  padding: 10px 12px;
  text-align: left;
  background: var(--ri-soft);
}
.rd-import-dashboard .ri-resources th:first-child {
  border-radius: 6px 0 0 6px;
}
.rd-import-dashboard .ri-resources th:last-child {
  border-radius: 0 6px 6px 0;
}
.rd-import-dashboard .ri-resources td {
  padding: 11px 12px;
  border-bottom: 1px solid var(--ri-line);
  vertical-align: middle;
}
.rd-import-dashboard .ri-resources tr:last-child td {
  border-bottom: 0;
}
.rd-import-dashboard .ri-resources .ri-resource-current td {
  background: color-mix(in srgb, var(--ri-accent) 5%, var(--ri-bg));
}
.rd-import-dashboard .ri-resources .ri-count {
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-weight: 550;
}
.rd-import-dashboard .ri-resource-name {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}
.rd-import-dashboard .ri-resource-name span {
  overflow-wrap: anywhere;
}
.rd-import-dashboard .ri-search {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}
.rd-import-dashboard .ri-input {
  display: block;
  width: 100%;
  min-width: 0;
  height: 36px;
  padding: 8px 10px;
  border: 1px solid var(--ri-line);
  border-radius: 7px;
  background: var(--ri-bg);
  color: var(--ri-text);
  font-size: 12px;
}
.rd-import-dashboard .ri-input:disabled {
  background: var(--ri-soft);
  color: var(--ri-muted);
}
.rd-import-dashboard .ri-form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 230px), 1fr));
  gap: 18px;
}
.rd-import-dashboard .ri-field {
  display: grid;
  gap: 7px;
  min-width: 0;
}
.rd-import-dashboard .ri-field label {
  font-size: 12px;
  font-weight: 550;
}
.rd-import-dashboard .ri-field small {
  font-size: 11px;
  color: var(--ri-muted);
}
.rd-import-dashboard .ri-activity {
  display: grid;
  gap: 0;
}
.rd-import-dashboard .ri-event {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr) auto;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid var(--ri-line);
}
.rd-import-dashboard .ri-event:last-child {
  border-bottom: 0;
}
.rd-import-dashboard .ri-event-icon {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--ri-soft);
  color: var(--ri-muted);
}
.rd-import-dashboard .ri-event-title {
  font-size: 12px;
  font-weight: 550;
}
.rd-import-dashboard .ri-event-meta {
  font-size: 11px;
  color: var(--ri-muted);
  margin-top: 3px;
}
.rd-import-dashboard .ri-empty {
  text-align: center;
  padding: 36px 20px;
  display: grid;
  justify-items: center;
  gap: 12px;
  color: var(--ri-muted);
}
.rd-import-dashboard .ri-empty h2 {
  color: var(--ri-text);
}
.rd-import-dashboard .ri-empty-mark {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  border-radius: 15px;
  background: var(--ri-soft);
  color: var(--ri-accent);
}
.rd-import-dashboard .ri-skeleton {
  height: 20px;
  border-radius: 5px;
  background: var(--ri-soft);
  animation: ri-pulse 1.8s infinite;
}
.rd-import-dashboard .ri-safe {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  color: var(--ri-muted);
  font-size: 12px;
  padding-top: 16px;
  margin-top: 18px;
  border-top: 1px solid var(--ri-line);
}
.rd-import-dashboard .ri-safe svg {
  flex-shrink: 0;
  color: var(--ri-green);
}
.rd-import-dashboard .ri-confirm {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 12px;
  line-height: 1.7;
  cursor: pointer;
  margin: 16px 0;
}
.rd-import-dashboard .ri-confirm button {
  margin-top: 2px;
  flex-shrink: 0;
}
.rd-import-dashboard .ri-checkbox {
  width: 16px;
  height: 16px;
  border: 1px solid var(--ri-line);
  border-radius: 4px;
  background: var(--ri-bg);
  display: grid;
  place-items: center;
}
.rd-import-dashboard .ri-checkbox[data-checked] {
  background: var(--ri-accent);
  color: #fff;
  border-color: var(--ri-accent);
}
.rd-import-dashboard details > summary {
  cursor: pointer;
  color: var(--ri-muted);
  font-size: 12px;
}
.rd-import-dashboard .ri-details {
  font-size: 11px;
  color: var(--ri-muted);
  overflow-wrap: anywhere;
  margin-top: 12px;
}
.rd-import-dashboard .ri-details dl {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 8px 16px;
}
.rd-import-dashboard .ri-details dd {
  margin: 0;
}
.rd-import-dashboard .ri-fine-print {
  font-size: 11px;
  color: var(--ri-muted);
  line-height: 1.7;
}
.rd-import-dashboard .ri-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--ri-line);
  font-size: 11px;
  color: var(--ri-muted);
}
@container rd-import (max-width:900px) {
  .rd-import-dashboard .ri-overview {
    grid-template-columns: minmax(0, 1fr);
  }
  .rd-import-dashboard .ri-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .rd-import-dashboard .ri-header {
    gap: 16px;
  }
}
@container rd-import (max-width:520px) {
  .rd-import-dashboard .ri-facts {
    grid-template-columns: 1fr;
  }
  .rd-import-dashboard .ri-card {
    padding: 16px;
  }
  .rd-import-dashboard .ri-metric {
    padding: 14px;
  }
  .rd-import-dashboard .ri-metric-value {
    font-size: 24px;
  }
  .rd-import-dashboard .ri-tabs {
    gap: 12px;
  }
  .rd-import-dashboard .ri-tab {
    font-size: 12px;
  }
  .rd-import-dashboard .ri-tag {
    font-size: 10px;
  }
  .rd-import-dashboard .ri-resources th,
  .rd-import-dashboard .ri-resources td {
    padding: 10px 6px;
  }
  .rd-import-dashboard .ri-event {
    grid-template-columns: 26px minmax(0, 1fr);
  }
  .rd-import-dashboard .ri-event > time {
    grid-column: 2;
  }
  .rd-import-dashboard .ri-connector {
    display: none;
  }
  .rd-import-dashboard h1 {
    font-size: 24px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .rd-import-dashboard .ri-pulse,
  .rd-import-dashboard .ri-spin,
  .rd-import-dashboard .ri-skeleton {
    animation: none;
  }
  .rd-import-dashboard * {
    transition: none !important;
  }
}
`}</style>
      {children}
    </main>
  );
};
