import { defineObject, FieldType } from 'twenty-sdk/define';
import { SOURCE_KEY, SOURCE_KIND, SOURCE_ID, SOURCE_PAYLOAD, SOURCE_TARGET, SOURCE_RUN, SOURCE_PARENT } from 'src/constants/rd-identifiers';

export const NAME_FIELD_UNIVERSAL_IDENTIFIER =
  '1dc89ebd-038c-4e30-b159-1490d5179ec2';

export default defineObject({
  universalIdentifier: '775d48f3-8678-43d2-9796-465b0f007d98',
  nameSingular: 'rdSourceRecord',
  namePlural: 'rdSourceRecords',
  labelSingular: 'Registro RD Station',
  labelPlural: 'Registros RD Station',
  icon: 'IconBox',
  labelIdentifierFieldMetadataUniversalIdentifier: NAME_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: NAME_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'name',
      label: 'Name',
      description: 'Name of the rdSourceRecord',
      icon: 'IconAbc',
    },
    { universalIdentifier: SOURCE_KEY, type: FieldType.TEXT, name: 'sourceKey', label: 'Chave de origem', isNullable: true, isUnique: true },
    { universalIdentifier: SOURCE_KIND, type: FieldType.TEXT, name: 'recordKind', label: 'Tipo de registro', isNullable: true },
    { universalIdentifier: SOURCE_ID, type: FieldType.TEXT, name: 'sourceId', label: 'ID no RD Station', isNullable: true },
    { universalIdentifier: SOURCE_PAYLOAD, type: FieldType.RAW_JSON, name: 'sourcePayload', label: 'Dados originais', isNullable: true },
    { universalIdentifier: SOURCE_TARGET, type: FieldType.TEXT, name: 'targetId', label: 'ID no Twenty', isNullable: true },
    { universalIdentifier: SOURCE_RUN, type: FieldType.TEXT, name: 'importRunId', label: 'Importação', isNullable: true },
    { universalIdentifier: SOURCE_PARENT, type: FieldType.TEXT, name: 'parentSourceId', label: 'Registro relacionado', isNullable: true },
  ],
});
