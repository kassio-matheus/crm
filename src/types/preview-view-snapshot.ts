import type { MetadataSchema } from 'twenty-client-sdk/metadata';
export type PreviewViewSnapshot = {
  view: MetadataSchema.CreateViewInput;
  fields: MetadataSchema.CreateViewFieldInput[];
  fieldGroups: MetadataSchema.CreateViewFieldGroupInput[];
  filters: MetadataSchema.CreateViewFilterInput[];
  filterGroups: MetadataSchema.CreateViewFilterGroupInput[];
  groups: MetadataSchema.CreateViewGroupInput[];
  sorts: MetadataSchema.CreateViewSortInput[];
};
