import { defineField, FieldType } from 'twenty-sdk/define';

export const DEAL_ADDRESS_FIELD_ID = '2ccf8e7a-a23a-485c-ae48-94c67c8273ca';

export default defineField({
  universalIdentifier: DEAL_ADDRESS_FIELD_ID,
  name: 'dealAddress',
  label: 'Endereço',
  type: FieldType.ADDRESS,
  objectUniversalIdentifier: '20202020-9549-49dd-b2b2-883999db8938',
});
