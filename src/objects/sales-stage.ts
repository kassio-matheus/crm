import { defineObject, FieldType } from 'twenty-sdk/define';

export const NAME_FIELD_UNIVERSAL_IDENTIFIER =
  '7533f947-cbd3-456d-9bb9-c4484a5f8f7b';

export default defineObject({
  universalIdentifier: '01f28af1-c4e7-4b83-8084-1640c8d25981',
  nameSingular: 'salesStage',
  namePlural: 'salesStages',
  labelSingular: 'Etapa do funil',
  labelPlural: 'Etapas dos funis',
  icon: 'IconBox',
  labelIdentifierFieldMetadataUniversalIdentifier:
    NAME_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: NAME_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'name',
      label: 'Name',
      description: 'Name of the salesStage',
      icon: 'IconAbc',
    },
  ],
});
