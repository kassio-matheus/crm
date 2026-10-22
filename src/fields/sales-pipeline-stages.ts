import { defineField, FieldType, RelationType } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: 'cf00d1fc-0172-45bd-9e6f-3b4d6c8930d7',
  name: 'stages',
  label: 'Stages',
  type: FieldType.RELATION,
  objectUniversalIdentifier: '50444479-e034-4fa5-8c38-2492629477bd',
  relationTargetObjectMetadataUniversalIdentifier: '01f28af1-c4e7-4b83-8084-1640c8d25981',
  relationTargetFieldMetadataUniversalIdentifier: '3c534548-a6b3-4bec-8717-7c399d286787',
  universalSettings: { relationType: RelationType.ONE_TO_MANY },
});
