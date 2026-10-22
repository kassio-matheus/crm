import { defineField, FieldType, RelationType, OnDeleteAction } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: '3c534548-a6b3-4bec-8717-7c399d286787',
  name: 'salesPipeline',
  label: 'Funil',
  type: FieldType.RELATION,
  objectUniversalIdentifier: '01f28af1-c4e7-4b83-8084-1640c8d25981',
  relationTargetObjectMetadataUniversalIdentifier: '50444479-e034-4fa5-8c38-2492629477bd',
  relationTargetFieldMetadataUniversalIdentifier: 'cf00d1fc-0172-45bd-9e6f-3b4d6c8930d7',
  universalSettings: { relationType: RelationType.MANY_TO_ONE, onDelete: OnDeleteAction.SET_NULL, joinColumnName: 'salesPipelineId' },
});
