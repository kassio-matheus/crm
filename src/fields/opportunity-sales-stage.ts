import { defineField, FieldType, RelationType, OnDeleteAction } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: 'c82c6820-3f44-4a52-946f-dd923cc03f74',
  name: 'salesStage',
  label: 'Etapa do funil',
  type: FieldType.RELATION,
  objectUniversalIdentifier: '20202020-9549-49dd-b2b2-883999db8938',
  relationTargetObjectMetadataUniversalIdentifier: '01f28af1-c4e7-4b83-8084-1640c8d25981',
  relationTargetFieldMetadataUniversalIdentifier: '056c083d-9be2-45ac-a69a-aa04217994c3',
  universalSettings: { relationType: RelationType.MANY_TO_ONE, onDelete: OnDeleteAction.SET_NULL, joinColumnName: 'salesStageId' },
});
