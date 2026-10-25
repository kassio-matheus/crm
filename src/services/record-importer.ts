import type { RdCustomField } from 'src/types/rd-custom-field';
import type { ImportOwnerMatch } from 'src/types/import-owner-match';
import { CoreApiClient, type CoreSchema } from 'twenty-client-sdk/core';
import { ImportCustomFields } from 'src/services/import-custom-fields';
import { ImportDealEnrichment } from 'src/services/import-deal-enrichment';
import { ImportOwners } from 'src/services/import-owners';
import { AttachmentImporter } from 'src/services/attachment-importer';
import { NativePipelineViews } from 'src/services/native-pipeline-views';
import { sourceId } from 'src/utils/source-id.util';
import { mapRdRecord } from 'src/utils/map-rd-record.util';
import { sanitizeSource } from 'src/utils/sanitize-source.util';

/** Create-only data import; replay may fill an empty native owner with an exact member match. */
export class RecordImporter {
  private owners: ImportOwners;
  private customFields: ImportCustomFields;
  constructor(
    private client = new CoreApiClient(),
    private views = new NativePipelineViews(),
  ) {
    this.owners = new ImportOwners(this.client);
    this.customFields = new ImportCustomFields(this.client);
  }

  withOwnerCatalog(catalog: Record<string, ImportOwnerMatch>): this {
    this.owners = new ImportOwners(this.client, catalog);
    return this;
  }

  withCustomCatalog(catalog: RdCustomField[]): this {
    this.customFields.withCatalog(catalog);
    return this;
  }

  async import(
    kind: string,
    record: Record<string, unknown>,
    account: string,
    runId: string,
    dryRun: boolean,
    parentId = '',
  ): Promise<'created' | 'skipped'> {
    const externalId =
      typeof record.id === 'string'
        ? record.id
        : typeof record._id === 'string'
          ? record._id
          : kind === 'users/meeting_availability' &&
              typeof record.user_id === 'string'
            ? [
                record.user_id,
                record.weekday_start,
                record.weekday_end,
                record.daily_start_time,
                record.daily_end_time,
              ].join(':')
            : '';
    if (!externalId) throw new Error(`Missing source ID for ${kind}.`);
    const key = `${account}:${kind}:${kind.startsWith('deal-') ? `${parentId}:` : ''}${externalId}`;
    // Validate projected values even during simulation.
    const custom =
      kind === 'deals'
        ? await this.customFields.project(record, account, dryRun)
        : {};
    const data = { ...mapRdRecord(kind, record, key), ...custom };
    if (kind === 'contacts') {
      const email = (data.emails as { primaryEmail?: string } | undefined)
        ?.primaryEmail;
      if (email) {
        const match = await this.client.query({
          people: {
            __args: {
              first: 2,
              filter: { emails: { primaryEmail: { eq: email } } },
            },
            edges: { node: { id: true } },
          },
        });
        if (match.people!.edges.some((edge) => edge.node.id !== sourceId(key)))
          throw new Error(
            'RD_CONTACT_EMAIL_CONFLICT: a different contact already uses this primary email in Twenty. Review the contact before resuming; no records were merged or overwritten.',
          );
      }
    }
    if (dryRun) return 'skipped';
    const id = sourceId(key);
    const archiveId = sourceId(`archive:${key}`);
    const archive = await this.client.query({
      rdSourceRecords: {
        __args: { filter: { id: { eq: archiveId } }, first: 1 },
        edges: { node: { id: true, targetId: true } },
      },
    });
    const owner = await this.owners.forRecord(kind, record, account);
    // Older releases archived catalogs only. Replaying them can safely create native catalogs.
    if (
      archive.rdSourceRecords!.edges[0]?.node.targetId &&
      !['pipelines', 'stages'].includes(kind)
    ) {
      if (kind === 'custom_fields')
        await this.client.mutation({
          updateRdSourceRecord: {
            __args: {
              id: archiveId,
              data: {
                sourcePayload: sanitizeSource(record) as Record<
                  string,
                  unknown
                >,
              },
            },
            id: true,
          },
        });
      if (
        kind === 'deals' &&
        archive.rdSourceRecords!.edges[0]?.node.targetId === id
      ) {
        await this.customFields.fillMissing(key, custom);
        await new ImportDealEnrichment(this.client).fillMissing(key, data);
      }
      if (
        archive.rdSourceRecords!.edges[0]?.node.targetId === id &&
        owner?.memberId
      )
        await this.owners.fillMissing(kind, key, owner.memberId);
      return 'skipped';
    }
    if (!archive.rdSourceRecords!.edges.length) {
      await this.client.mutation({
        createRdSourceRecord: {
          __args: {
            data: {
              id: archiveId,
              sourceKey: key,
              sourceId: externalId,
              recordKind: kind,
              name: String(record.name ?? record.subject ?? kind),
              sourcePayload: sanitizeSource(record) as Record<string, unknown>,
              importRunId: runId,
              parentSourceId: parentId,
            },
          },
          id: true,
        },
      });
    }
    let created = false;
    const org = record.organization as
      { id?: string; _id?: string } | undefined;
    const organizationId =
      typeof record.organization_id === 'string'
        ? record.organization_id
        : (org?.id ?? org?._id);
    const companyId =
      ['contacts', 'deals'].includes(kind) && organizationId
        ? await this.resolve(account, 'organizations', organizationId)
        : null;
    if (kind === 'pipelines') {
      const existing = await this.client.query({
        salesPipelines: {
          __args: { first: 1, filter: { id: { eq: id } } },
          edges: { node: { id: true } },
        },
      });
      if (!existing.salesPipelines!.edges.length) {
        await this.client.mutation({
          createSalesPipeline: {
            __args: {
              data: { ...data, id } as CoreSchema.SalesPipelineCreateInput,
            },
            id: true,
          },
        });
        created = true;
      }
      await this.views.ensure(id, String(record.name ?? 'Funil de vendas'));
    } else if (kind === 'stages') {
      const existing = await this.client.query({
        salesStages: {
          __args: { first: 1, filter: { id: { eq: id } } },
          edges: { node: { id: true } },
        },
      });
      if (!existing.salesStages!.edges.length) {
        const pipeline = record.deal_pipeline as
          { id?: string; _id?: string } | undefined;
        const pipelineId = String(
          record.pipeline_id ??
            record.deal_pipeline_id ??
            pipeline?.id ??
            pipeline?._id ??
            parentId,
        );
        if (!pipelineId) throw new Error('Missing source pipeline for stage.');
        const salesPipelineId = await this.resolve(
          account,
          'pipelines',
          pipelineId,
        );
        await this.client.mutation({
          createSalesStage: {
            __args: {
              data: {
                ...data,
                id,
                salesPipelineId,
              } as CoreSchema.SalesStageCreateInput,
            },
            id: true,
          },
        });
        created = true;
      }
      const pipeline = record.deal_pipeline as
        { id?: string; _id?: string } | undefined;
      const pipelineId = String(
        record.pipeline_id ??
          record.deal_pipeline_id ??
          pipeline?.id ??
          pipeline?._id ??
          parentId,
      );
      if (!pipelineId) throw new Error('Missing source pipeline for stage.');
      await this.views.addStage(
        sourceId(`${account}:pipelines:${pipelineId}`),
        id,
        Number(data.sourceOrder ?? 0),
      );
    } else if (kind === 'organizations') {
      const existing = await this.client.query({
        companies: {
          __args: { first: 1, filter: { id: { eq: id } } },
          edges: { node: { id: true } },
        },
      });
      if (!existing.companies!.edges.length) {
        await this.client.mutation({
          createCompany: {
            __args: {
              data: {
                ...data,
                id,
                accountOwnerId: owner?.memberId ?? null,
              } as CoreSchema.CompanyCreateInput,
            },
            id: true,
          },
        });
        created = true;
      }
    } else if (kind === 'contacts') {
      const existing = await this.client.query({
        people: {
          __args: { first: 1, filter: { id: { eq: id } } },
          edges: { node: { id: true } },
        },
      });
      if (!existing.people!.edges.length) {
        await this.client.mutation({
          createPerson: {
            __args: {
              data: { ...data, id, companyId } as CoreSchema.PersonCreateInput,
            },
            id: true,
          },
        });
        created = true;
      }
    } else if (kind === 'deals') {
      const existing = await this.client.query({
        opportunities: {
          __args: { first: 1, filter: { id: { eq: id } } },
          edges: { node: { id: true } },
        },
      });
      if (!existing.opportunities!.edges.length) {
        const contacts = record.contact_ids as string[] | undefined;
        const embedded = record.contacts as
          { id?: string; _id?: string }[] | undefined;
        const contactId =
          contacts?.[0] ?? embedded?.[0]?.id ?? embedded?.[0]?._id;
        const pointOfContactId = contactId
          ? await this.resolve(account, 'contacts', contactId)
          : null;
        const ownerId = owner?.memberId ?? null;
        const rdOwnerName = String(owner?.name || data.rdOwnerName || '');
        if (!data.salesPipelineKey && data.salesStageKey) {
          const stage = await this.snapshot(
            account,
            'stages',
            String(data.salesStageKey),
          );
          const embeddedPipeline = stage?.deal_pipeline as
            { id?: string } | undefined;
          data.salesPipelineKey =
            stage?.pipeline_id ??
            stage?.deal_pipeline_id ??
            embeddedPipeline?.id ??
            '';
        }
        const salesPipelineId = data.salesPipelineKey
          ? await this.resolve(
              account,
              'pipelines',
              String(data.salesPipelineKey),
            )
          : null;
        const salesStageId = data.salesStageKey
          ? await this.resolve(account, 'stages', String(data.salesStageKey))
          : null;
        await this.client.mutation({
          createOpportunity: {
            __args: {
              data: {
                ...data,
                id,
                companyId,
                pointOfContactId,
                ownerId,
                rdOwnerName,
                salesPipelineId,
                salesStageId,
              } as CoreSchema.OpportunityCreateInput,
            },
            id: true,
          },
        });
        created = true;
      }
    } else if (kind === 'deal-files') {
      const targetOpportunityId = await this.resolve(
        account,
        'deals',
        parentId,
      );
      created = await new AttachmentImporter(this.client).import(
        record,
        id,
        targetOpportunityId,
      );
    } else if (kind === 'tasks' || kind === 'activities') {
      const deal = record.deal as { id?: string; _id?: string } | undefined;
      const dealId =
        typeof record.deal_id === 'string'
          ? record.deal_id
          : (deal?.id ?? deal?._id ?? parentId);
      const targetOpportunityId = dealId
        ? await this.resolve(account, 'deals', dealId)
        : null;
      if (kind === 'tasks') {
        data.assigneeId = owner?.memberId ?? null;
        const existing = await this.client.query({
          tasks: {
            __args: { first: 1, filter: { id: { eq: id } } },
            edges: { node: { id: true } },
          },
        });
        if (!existing.tasks!.edges.length) {
          await this.client.mutation({
            createTask: {
              __args: { data: { ...data, id } as CoreSchema.TaskCreateInput },
              id: true,
            },
          });
          created = true;
        }
        if (targetOpportunityId) {
          const linkId = sourceId(`task-target:${key}`);
          const link = await this.client.query({
            taskTargets: {
              __args: { first: 1, filter: { id: { eq: linkId } } },
              edges: { node: { id: true } },
            },
          });
          if (!link.taskTargets!.edges.length)
            await this.client.mutation({
              createTaskTarget: {
                __args: {
                  data: { id: linkId, taskId: id, targetOpportunityId },
                },
                id: true,
              },
            });
        }
      } else {
        const existing = await this.client.query({
          notes: {
            __args: { first: 1, filter: { id: { eq: id } } },
            edges: { node: { id: true } },
          },
        });
        if (!existing.notes!.edges.length) {
          await this.client.mutation({
            createNote: {
              __args: { data: { ...data, id } as CoreSchema.NoteCreateInput },
              id: true,
            },
          });
          created = true;
        }
        if (targetOpportunityId) {
          const linkId = sourceId(`note-target:${key}`);
          const link = await this.client.query({
            noteTargets: {
              __args: { first: 1, filter: { id: { eq: linkId } } },
              edges: { node: { id: true } },
            },
          });
          if (!link.noteTargets!.edges.length)
            await this.client.mutation({
              createNoteTarget: {
                __args: {
                  data: { id: linkId, noteId: id, targetOpportunityId },
                },
                id: true,
              },
            });
        }
      }
    }
    if (!created && kind === 'deals') {
      await this.customFields.fillMissing(key, custom);
      await new ImportDealEnrichment(this.client).fillMissing(key, data);
    }
    if (!created && owner?.memberId)
      await this.owners.fillMissing(kind, key, owner.memberId);
    await this.client.mutation({
      updateRdSourceRecord: {
        __args: {
          id: archiveId,
          data: {
            targetId:
              Object.keys(data).length || kind === 'deal-files'
                ? id
                : archiveId,
          },
        },
        id: true,
      },
    });
    return created || (!Object.keys(data).length && kind !== 'deal-files')
      ? 'created'
      : 'skipped';
  }

  private async resolve(
    account: string,
    kind: string,
    externalId: string,
  ): Promise<string> {
    const archiveId = sourceId(`archive:${account}:${kind}:${externalId}`);
    const response = await this.client.query({
      rdSourceRecords: {
        __args: { first: 1, filter: { id: { eq: archiveId } } },
        edges: { node: { targetId: true } },
      },
    });
    const targetId = response.rdSourceRecords!.edges[0]?.node.targetId;
    if (!targetId)
      throw new Error(
        `Missing imported ${kind} reference. Import stopped without discarding the relationship.`,
      );
    return targetId;
  }

  private async snapshot(
    account: string,
    kind: string,
    id: string,
  ): Promise<Record<string, unknown> | null> {
    const result = await this.client.query({
      rdSourceRecords: {
        __args: {
          first: 1,
          filter: { sourceKey: { eq: `${account}:${kind}:${id}` } },
        },
        edges: { node: { sourcePayload: true } },
      },
    });
    return (
      (result.rdSourceRecords!.edges[0]?.node.sourcePayload as Record<
        string,
        unknown
      > | null) ?? null
    );
  }
}
