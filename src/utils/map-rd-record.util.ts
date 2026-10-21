import { dealStatus } from 'src/utils/deal-status.util';
import { sanitizeSource } from 'src/utils/sanitize-source.util';

/** Keeps every original field; only documented, validated values become native CRM fields. */
export const mapRdRecord = (kind: string, record: Record<string, unknown>, key: string): Record<string, unknown> => {
  const text = (value: unknown): string => typeof value === 'string' ? value : '';
  const date = (value: unknown): string | null => {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error('Invalid source date.');
    return new Date(value).toISOString();
  };
  const common = { rdSourceKey: key, rdOriginalData: sanitizeSource(record) };
  if (kind === 'organizations') return { ...common, name: text(record.name), ...(record.url ? { domainName: { primaryLinkUrl: text(record.url), primaryLinkLabel: text(record.url) } } : {}) };
  if (kind === 'contacts') {
    const parts = text(record.name).trim().split(/\s+/);
    const emails = (Array.isArray(record.emails) ? record.emails : []).map(e => typeof e === 'string' ? e : text((e as { email?: unknown }).email)).filter(Boolean);
    const phones = (Array.isArray(record.phones) ? record.phones : []).map(p => typeof p === 'string' ? p : text((p as { phone?: unknown; number?: unknown }).phone ?? (p as { number?: unknown }).number)).filter(Boolean);
    return { ...common, name: { firstName: parts.shift() ?? '', lastName: parts.join(' ') }, jobTitle: text(record.title ?? record.job_title), emails: { primaryEmail: emails[0] ?? '', additionalEmails: emails.slice(1) }, phones: { primaryPhoneNumber: phones[0] ?? '', additionalPhones: phones.slice(1).map(number => ({ number })) } };
  }
  if (kind === 'deals') {
    const stage = (record.deal_stage ?? {}) as Record<string, unknown>;
    const pipeline = (record.deal_pipeline ?? {}) as Record<string, unknown>;
    const owner = (record.user ?? {}) as Record<string, unknown>;
    const amount = record.total_price ?? record.amount_total ?? 0;
    if (typeof amount !== 'number' || !Number.isFinite(amount) || !Number.isSafeInteger(Math.round(amount * 1_000_000))) throw new Error('Invalid source deal amount.');
    const pipelineId = text(record.pipeline_id ?? stage.deal_pipeline_id ?? pipeline.id ?? pipeline._id);
    const stageId = text(record.stage_id ?? stage.id ?? stage._id);
    return { ...common, name: text(record.name), amount: { amountMicros: String(Math.round(amount * 1_000_000)), currencyCode: 'BRL' }, closeDate: date(record.expected_close_date ?? record.prediction_date), rdCreatedAt: date(record.created_at), dealStatus: dealStatus(record), qualification: typeof record.rating === 'number' ? record.rating : 0, salesPipelineKey: pipelineId, salesStageKey: stageId, rdOwnerId: text(record.owner_id ?? owner.id ?? owner._id), rdOwnerName: text(owner.name) };
  }
  if (kind === 'tasks') return { ...common, title: text(record.subject ?? record.title ?? record.name), bodyV2: { markdown: text(record.notes ?? record.description) }, dueAt: date(record.due_date ?? record.due_at ?? record.date), status: record.done === true || record.status === 'completed' || record.status === 'done' ? 'DONE' : 'TODO' };
  if (kind === 'activities') return { ...common, title: 'RD Station activity', bodyV2: { markdown: text(record.text) } };
  return {};
};
