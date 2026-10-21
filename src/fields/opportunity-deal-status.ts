import { defineField, FieldType } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: '66319b43-c953-44c5-a21d-591b36b76dfb',
  name: 'dealStatus',
  label: 'Deal status',
  type: FieldType.SELECT,
  isNullable: true,
  options: [
    { id: '9c84f974-da82-4b6e-ad82-26eaff922d80', value: 'ONGOING', label: 'Em andamento', position: 0 },
    { id: '971c1b71-d799-4f12-8f8c-e8f962fb635a', value: 'WON', label: 'Vendido', position: 1 },
    { id: '4c98daca-a6f1-444d-ab59-4bd87b221c3b', value: 'LOST', label: 'Perdido', position: 2 },
    { id: 'db2d31bb-ba61-4475-8791-d70e811d8f01', value: 'PAUSED', label: 'Pausado', position: 3 },
  ],
  objectUniversalIdentifier: '20202020-9549-49dd-b2b2-883999db8938',
});
