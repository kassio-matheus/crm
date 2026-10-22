import { defineField, FieldType, RelationType } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: 'e6433f79-7afb-4c43-9cac-d49ef9f8eb0d',
  name: 'opportunities',
  label: 'Opportunities',
  type: FieldType.RELATION,
  objectUniversalIdentifier: '50444479-e034-4fa5-8c38-2492629477bd',
  relationTargetObjectMetadataUniversalIdentifier: '20202020-9549-49dd-b2b2-883999db8938',
  relationTargetFieldMetadataUniversalIdentifier: '2f8ee9bf-9b4f-4a61-8f98-aaff48b12890',
  universalSettings: { relationType: RelationType.ONE_TO_MANY },
});
