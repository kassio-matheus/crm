import { CoreApiClient, type CoreSchema } from 'twenty-client-sdk/core';
import { MetadataApiClient } from 'twenty-client-sdk/metadata';
import { rdCustomProjection } from 'src/utils/rd-custom-projection.util';
import { rdCustomFieldError } from 'src/utils/rd-custom-field-error.util';
import { sanitizeSource } from 'src/utils/sanitize-source.util';
import { sourceId } from 'src/utils/source-id.util';
import type { RdCustomField } from 'src/types/rd-custom-field';
import type { RdCustomProjection } from 'src/types/rd-custom-projection';

/** Runtime field discovery is restricted to imported deal fields on the native opportunity object. */
export class ImportCustomFields {
  private catalog?: Promise<RdCustomField[]>;
  private metadataFields?: Awaited<
    ReturnType<ImportCustomFields['loadMetadata']>
  >;
  constructor(
    private core = new CoreApiClient(),
    private metadata = new MetadataApiClient(),
  ) {}

  withCatalog(catalog: RdCustomField[]): this {
    this.catalog = Promise.resolve(catalog);
    return this;
  }

  async project(
    record: Record<string, unknown>,
    account: string,
    dryRun: boolean,
  ) {
    const custom = sanitizeSource(record.custom_fields ?? {}) as unknown;
    if (!custom || Array.isArray(custom) || typeof custom !== 'object')
      throw new Error('RD_INVALID_CUSTOM_FIELDS: expected a key-value object.');
    const entries = Object.entries(custom);
    if (!entries.length) return {};
    const definitions = await (this.catalog ??= this.loadCatalog(account));
    const projections = entries
      .map(([slug, value]) =>
        rdCustomProjection(
          account,
          slug,
          value,
          definitions.find(
            (field) => field.slug === slug && field.entity === 'deal',
          ),
        ),
      )
      .filter((projection) => projection.options?.length !== 0);
    // Twenty requires at least one enum option. Defer empty catalogs until a choice
    // is supplied by RD; the original empty value remains in the source snapshot.
    if (!dryRun)
      for (const projection of projections) {
        try {
          await this.ensure(projection);
        } catch (error) {
          if (
            error instanceof Error &&
            /^(RD_MISSING_OPPORTUNITY_METADATA|RD_MISSING_DEAL_FIELDS_VIEW|RD_CUSTOM_FIELD_SCHEMA_CONFLICT)(:|$)/.test(
              error.message,
            )
          )
            throw error;
          throw rdCustomFieldError(error, projection.name);
        }
      }
    return Object.fromEntries(
      projections.map((field) => [field.name, field.value]),
    );
  }

  async fillMissing(key: string, values: Record<string, unknown>) {
    const names = Object.keys(values).filter((name) =>
      /^rdCustom[0-9a-f]{32}$/.test(name),
    );
    if (!names.length) return;
    // Scalar custom selections work without regenerating the SDK for each company's catalog.
    const response = await this.core.query({
      opportunities: {
        __args: {
          first: 1,
          filter: { id: { eq: sourceId(key) }, rdSourceKey: { eq: key } },
        },
        edges: {
          node: Object.fromEntries(
            ['id', ...names].map((name) => [name, true]),
          ),
        },
      },
    } as Parameters<CoreApiClient['query']>[0]);
    const current = (
      response as unknown as {
        opportunities?: { edges: { node: Record<string, unknown> }[] };
      }
    ).opportunities?.edges[0]?.node as Record<string, unknown> | undefined;
    if (!current) return;
    for (const name of names)
      if (current[name] === null && values[name] !== null) {
        await this.core.mutation({
          updateOpportunities: {
            __args: {
              filter: {
                id: { eq: sourceId(key) },
                rdSourceKey: { eq: key },
                [name]: { is: 'NULL' },
              } as CoreSchema.OpportunityFilterInput,
              data: {
                [name]: values[name],
              } as CoreSchema.OpportunityUpdateInput,
            },
            id: true,
          },
        });
      }
  }

  private async loadCatalog(account: string) {
    const definitions: RdCustomField[] = [];
    let after: string | undefined;
    for (;;) {
      const result = await this.core.query({
        rdSourceRecords: {
          __args: {
            first: 100,
            after,
            filter: {
              sourceKey: { startsWith: `${account}:custom_fields:` },
              recordKind: { eq: 'custom_fields' },
            },
            orderBy: [{ id: 'AscNullsLast' }],
          },
          edges: { cursor: true, node: { sourcePayload: true } },
        },
      });
      const edges = result.rdSourceRecords!.edges;
      for (const { node } of edges) {
        const field = node.sourcePayload as RdCustomField;
        if (field && typeof field.slug === 'string') definitions.push(field);
      }
      if (edges.length < 100) return definitions;
      const next = edges[edges.length - 1].cursor;
      if (!next || next === after)
        throw new Error('RD_CUSTOM_CATALOG_PAGE_CHANGED');
      after = next;
    }
  }
  private async loadMetadata() {
    const result = await this.metadata.query({
      objects: {
        __args: {
          filter: {
            universalIdentifier: { eq: '20202020-9549-49dd-b2b2-883999db8938' },
          },
          paging: { first: 1 },
        },
        edges: {
          node: {
            id: true,
            fieldsList: {
              id: true,
              name: true,
              type: true,
              description: true,
              options: true,
            },
          },
        },
      },
    });
    const object = result.objects.edges[0]?.node;
    if (!object) throw new Error('RD_MISSING_OPPORTUNITY_METADATA');
    return object;
  }
  private async ensure(projection: RdCustomProjection) {
    this.metadataFields ??= await this.loadMetadata();
    let field = this.metadataFields.fieldsList?.find(
      (item) => item.name === projection.name,
    );
    if (!field) {
      try {
        const result = await this.metadata.mutation({
          createOneField: {
            __args: {
              input: {
                field: {
                  objectMetadataId: this.metadataFields.id,
                  name: projection.name,
                  label: projection.label,
                  type: projection.type,
                  description: projection.description,
                  isNullable: true,
                  isUIEditable: true,
                  isLabelSyncedWithName: false,
                  ...(projection.options
                    ? {
                        options: projection.options as unknown as Record<
                          string,
                          unknown
                        >,
                      }
                    : {}),
                },
              },
            },
            id: true,
            name: true,
            type: true,
            description: true,
            options: true,
          },
        });
        field = result.createOneField;
        this.metadataFields.fieldsList?.push(field);
      } catch (error) {
        this.metadataFields = await this.loadMetadata();
        field = this.metadataFields.fieldsList?.find(
          (item) => item.name === projection.name,
        );
        if (!field) throw error;
      }
    }
    if (
      field.type !== projection.type ||
      field.description !== projection.description
    )
      throw new Error(
        'RD_CUSTOM_FIELD_SCHEMA_CONFLICT: review the existing native field before importing.',
      );
    if (projection.options) {
      const options = (field.options ?? []) as { value: string }[];
      const missing = projection.options.filter(
        (item) => !options.some((option) => option.value === item.value),
      );
      if (missing.length) {
        const merged = [
          ...options,
          ...missing.map((item, index) => ({
            ...item,
            position: options.length + index,
          })),
        ];
        await this.metadata.mutation({
          updateOneField: {
            __args: {
              input: {
                id: field.id,
                update: {
                  options: merged as unknown as Record<string, unknown>,
                },
              },
            },
            id: true,
          },
        });
        field.options = merged as unknown as typeof field.options;
      }
    }
    await this.expose(field.id);
  }
  private exposed = new Set<string>();
  private async expose(fieldId: string) {
    if (this.exposed.has(fieldId)) return;
    const result = await this.metadata.query({
      getViews: {
        __args: { objectMetadataId: this.metadataFields!.id },
        id: true,
        universalIdentifier: true,
        type: true,
      },
    });
    const view = result.getViews.find(
      (item) =>
        item.universalIdentifier === '5cf614b6-530f-4947-b6b9-c434df5741f6',
    );
    if (!view) throw new Error('RD_MISSING_DEAL_FIELDS_VIEW');
    const current = await this.metadata.query({
      getViewFields: {
        __args: { viewId: view.id },
        id: true,
        fieldMetadataId: true,
      },
      getViewFieldGroups: { __args: { viewId: view.id }, id: true },
    });
    const groupId = sourceId(`rd-custom-group:${view.id}`);
    if (!current.getViewFieldGroups.some((item) => item.id === groupId))
      await this.metadata.mutation({
        createViewFieldGroup: {
          __args: {
            input: {
              id: groupId,
              viewId: view.id,
              name: 'Campos personalizados do RD',
              position: 3,
              isVisible: true,
            },
          },
          id: true,
        },
      });
    if (!current.getViewFields.some((item) => item.fieldMetadataId === fieldId))
      await this.metadata.mutation({
        createViewField: {
          __args: {
            input: {
              id: sourceId(`rd-custom-view-field:${view.id}:${fieldId}`),
              viewId: view.id,
              fieldMetadataId: fieldId,
              viewFieldGroupId: groupId,
              position: current.getViewFields.length,
              isVisible: true,
              size: 220,
            },
          },
          id: true,
        },
      });
    this.exposed.add(fieldId);
  }
}
