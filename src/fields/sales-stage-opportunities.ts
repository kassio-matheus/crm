import { defineField, FieldType, RelationType } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: '056c083d-9be2-45ac-a69a-aa04217994c3',
  name: 'opportunities',
  label: 'Opportunities',
  type: FieldType.RELATION,
  objectUniversalIdentifier: '01f28af1-c4e7-4b83-8084-1640c8d25981',
  relationTargetObjectMetadataUniversalIdentifier: '20202020-9549-49dd-b2b2-883999db8938',
  relationTargetFieldMetadataUniversalIdentifier: 'c82c6820-3f44-4a52-946f-dd923cc03f74',
  universalSettings: { relationType: RelationType.ONE_TO_MANY },
});
