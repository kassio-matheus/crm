import type { MetadataSchema } from 'twenty-client-sdk/metadata';
export type RdCustomProjection = {
  name: string;
  label: string;
  description: string;
  type: MetadataSchema.FieldMetadataType;
  options?: {
    id: string;
    label: string;
    value: string;
    position: number;
    color: string;
  }[];
  value: unknown;
};
