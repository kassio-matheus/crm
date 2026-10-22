import { defineObject, FieldType } from 'twenty-sdk/define';

export const NAME_FIELD_UNIVERSAL_IDENTIFIER =
  '6d0beed8-4d95-47b2-96f5-9a7fbc8b4684';

export default defineObject({
  universalIdentifier: '50444479-e034-4fa5-8c38-2492629477bd',
  nameSingular: 'salesPipeline',
  namePlural: 'salesPipelines',
  labelSingular: 'Funil de vendas',
  labelPlural: 'Funis de vendas',
  icon: 'IconBox',
  labelIdentifierFieldMetadataUniversalIdentifier:
    NAME_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: NAME_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'name',
      label: 'Name',
      description: 'Name of the salesPipeline',
      icon: 'IconAbc',
    },
  ],
});
