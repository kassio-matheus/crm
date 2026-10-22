import { defineField, FieldType, RelationType, OnDeleteAction } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: '2f8ee9bf-9b4f-4a61-8f98-aaff48b12890',
  name: 'salesPipeline',
  label: 'Funil',
  type: FieldType.RELATION,
  objectUniversalIdentifier: '20202020-9549-49dd-b2b2-883999db8938',
  relationTargetObjectMetadataUniversalIdentifier: '50444479-e034-4fa5-8c38-2492629477bd',
  relationTargetFieldMetadataUniversalIdentifier: 'e6433f79-7afb-4c43-9cac-d49ef9f8eb0d',
  universalSettings: { relationType: RelationType.MANY_TO_ONE, onDelete: OnDeleteAction.SET_NULL, joinColumnName: 'salesPipelineId' },
});
