import { CoreApiClient, type CoreSchema } from 'twenty-client-sdk/core';
import { AttachmentImporter } from 'src/services/attachment-importer';
import { sourceId } from 'src/utils/source-id.util';
import { mapRdRecord } from 'src/utils/map-rd-record.util';
import { sanitizeSource } from 'src/utils/sanitize-source.util';

/** Create-only import: never updates, merges by name/email, deletes or overwrites a user's edits. */
export class RecordImporter {
  constructor(private client = new CoreApiClient()) {}

  async import(kind: string, record: Record<string, unknown>, account: string, runId: string, dryRun: boolean, parentId = ''): Promise<'created' | 'skipped'> {
    const externalId = typeof record.id === 'string' ? record.id : typeof record._id === 'string' ? record._id : '';
    if (!externalId) throw new Error(`Missing source ID for ${kind}.`);
    const key = `${account}:${kind}:${kind.startsWith('deal-') ? `${parentId}:` : ''}${externalId}`;
    // Validate projected values even during simulation.
    const data = mapRdRecord(kind, record, key);
    if (dryRun) return 'skipped';
    const id = sourceId(key);
    const archiveId = sourceId(`archive:${key}`);
    const archive = await this.client.query({ rdSourceRecords: { __args: { filter: { id: { eq: archiveId } }, first: 1 }, edges: { node: { id: true, targetId: true } } } });
    if (archive.rdSourceRecords!.edges[0]?.node.targetId) return 'skipped';
    if (!archive.rdSourceRecords!.edges.length) {
      await this.client.mutation({ createRdSourceRecord: { __args: { data: { id: archiveId, sourceKey: key, sourceId: externalId, recordKind: kind, name: String(record.name ?? record.subject ?? kind), sourcePayload: sanitizeSource(record) as Record<string, unknown>, importRunId: runId, parentSourceId: parentId } }, id: true } });
    }
    let created = false;
    const org = record.organization as { id?: string; _id?: string } | undefined;
    const organizationId = typeof record.organization_id === 'string' ? record.organization_id : org?.id ?? org?._id;
    const companyId = ['contacts', 'deals'].includes(kind) && organizationId ? await this.resolve(account, 'organizations', organizationId) : null;
    if (kind === 'organizations') {
      const existing = await this.client.query({ companies: { __args: { first: 1, filter: { id: { eq: id } } }, edges: { node: { id: true } } } });
      if (!existing.companies!.edges.length) { await this.client.mutation({ createCompany: { __args: { data: { ...data, id } as CoreSchema.CompanyCreateInput }, id: true } }); created = true; }
    } else if (kind === 'contacts') {
      const existing = await this.client.query({ people: { __args: { first: 1, filter: { id: { eq: id } } }, edges: { node: { id: true } } } });
      if (!existing.people!.edges.length) { await this.client.mutation({ createPerson: { __args: { data: { ...data, id, companyId } as CoreSchema.PersonCreateInput }, id: true } }); created = true; }
    } else if (kind === 'deals') {
      const existing = await this.client.query({ opportunities: { __args: { first: 1, filter: { id: { eq: id } } }, edges: { node: { id: true } } } });
      if (!existing.opportunities!.edges.length) {
        const contacts = record.contact_ids as string[] | undefined;
        const embedded = record.contacts as { id?: string; _id?: string }[] | undefined;
        const contactId = contacts?.[0] ?? embedded?.[0]?.id ?? embedded?.[0]?._id;
        const pointOfContactId = contactId ? await this.resolve(account, 'contacts', contactId) : null;
        const rdOwnerId = String(data.rdOwnerId ?? '');
        const user = rdOwnerId ? await this.snapshot(account, 'users', rdOwnerId) : null;
        const ownerId = user?.email ? await this.findMember(String(user.email)) : null;
        const rdOwnerName = String(user?.name ?? data.rdOwnerName ?? '');
        if (!data.salesPipelineKey && data.salesStageKey) {
          const stage = await this.snapshot(account, 'stages', String(data.salesStageKey));
          const embeddedPipeline = stage?.deal_pipeline as { id?: string } | undefined;
          data.salesPipelineKey = stage?.pipeline_id ?? stage?.deal_pipeline_id ?? embeddedPipeline?.id ?? '';
        }
        await this.client.mutation({ createOpportunity: { __args: { data: { ...data, id, companyId, pointOfContactId, ownerId, rdOwnerName } as CoreSchema.OpportunityCreateInput }, id: true } }); created = true;
      }
    } else if (kind === 'deal-files') {
      const targetOpportunityId = await this.resolve(account, 'deals', parentId);
      created = await new AttachmentImporter(this.client).import(record, id, targetOpportunityId);
    } else if (kind === 'tasks' || kind === 'activities') {
      const deal = record.deal as { id?: string; _id?: string } | undefined;
      const dealId = typeof record.deal_id === 'string' ? record.deal_id : deal?.id ?? deal?._id ?? parentId;
      const targetOpportunityId = dealId ? await this.resolve(account, 'deals', dealId) : null;
      if (kind === 'tasks') {
        const existing = await this.client.query({ tasks: { __args: { first: 1, filter: { id: { eq: id } } }, edges: { node: { id: true } } } });
        if (!existing.tasks!.edges.length) { await this.client.mutation({ createTask: { __args: { data: { ...data, id } as CoreSchema.TaskCreateInput }, id: true } }); created = true; }
        if (targetOpportunityId) {
          const linkId = sourceId(`task-target:${key}`);
          const link = await this.client.query({ taskTargets: { __args: { first: 1, filter: { id: { eq: linkId } } }, edges: { node: { id: true } } } });
          if (!link.taskTargets!.edges.length) await this.client.mutation({ createTaskTarget: { __args: { data: { id: linkId, taskId: id, targetOpportunityId } }, id: true } });
        }
      } else {
        const existing = await this.client.query({ notes: { __args: { first: 1, filter: { id: { eq: id } } }, edges: { node: { id: true } } } });
        if (!existing.notes!.edges.length) { await this.client.mutation({ createNote: { __args: { data: { ...data, id } as CoreSchema.NoteCreateInput }, id: true } }); created = true; }
        if (targetOpportunityId) {
          const linkId = sourceId(`note-target:${key}`);
          const link = await this.client.query({ noteTargets: { __args: { first: 1, filter: { id: { eq: linkId } } }, edges: { node: { id: true } } } });
          if (!link.noteTargets!.edges.length) await this.client.mutation({ createNoteTarget: { __args: { data: { id: linkId, noteId: id, targetOpportunityId } }, id: true } });
        }
      }
    }
    await this.client.mutation({ updateRdSourceRecord: { __args: { id: archiveId, data: { targetId: Object.keys(data).length || kind === 'deal-files' ? id : archiveId } }, id: true } });
    return created || !Object.keys(data).length ? 'created' : 'skipped';
  }

  private async resolve(account: string, kind: string, externalId: string): Promise<string> {
    const archiveId = sourceId(`archive:${account}:${kind}:${externalId}`);
    const response = await this.client.query({ rdSourceRecords: { __args: { first: 1, filter: { id: { eq: archiveId } } }, edges: { node: { targetId: true } } } });
    const targetId = response.rdSourceRecords!.edges[0]?.node.targetId;
    if (!targetId) throw new Error(`Missing imported ${kind} reference. Import stopped without discarding the relationship.`);
    return targetId;
  }

  private async snapshot(account: string, kind: string, id: string): Promise<Record<string, unknown> | null> {
    const result = await this.client.query({ rdSourceRecords: { __args: { first: 1, filter: { sourceKey: { eq: `${account}:${kind}:${id}` } } }, edges: { node: { sourcePayload: true } } } });
    return result.rdSourceRecords!.edges[0]?.node.sourcePayload as Record<string, unknown> | null ?? null;
  }

  private async findMember(email: string): Promise<string | null> {
    const result = await this.client.query({ workspaceMembers: { __args: { filter: { userEmail: { eq: email.toLowerCase() } }, first: 2 }, edges: { node: { id: true } } } });
    return result.workspaceMembers!.edges.length === 1 ? result.workspaceMembers!.edges[0].node.id : null;
  }
}
