import { defineField, FieldType } from 'twenty-sdk/define';

export const DEAL_FULL_NAME_FIELD_ID = '546b5969-35d0-4d1d-a2f3-e75bb8d96ed0';

export default defineField({
  universalIdentifier: DEAL_FULL_NAME_FIELD_ID,
  name: 'dealFullName',
  label: 'Nome completo',
  type: FieldType.FULL_NAME,
  objectUniversalIdentifier: '20202020-9549-49dd-b2b2-883999db8938',
});
