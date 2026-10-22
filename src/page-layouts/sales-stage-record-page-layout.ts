import { definePageLayout, PageLayoutTabLayoutMode, PageLayoutType } from 'twenty-sdk/define';

export default definePageLayout({
  universalIdentifier: '665f7bc2-aea5-47a9-b0d4-b13820b958b4',
  name: 'Default Etapa do funil Layout',
  type: PageLayoutType.RECORD_PAGE,
  objectUniversalIdentifier: '01f28af1-c4e7-4b83-8084-1640c8d25981',
  tabs: [
    {
      universalIdentifier: '86feb854-6136-40a4-8c7a-ad2eea7ed655',
      title: 'Home',
      position: 10,
      icon: 'IconHome',
      layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
      widgets: [
        {
          universalIdentifier: '49051f7e-a9ca-4f46-ac56-56f432a38238',
          title: 'Fields',
          type: 'FIELDS',
          configuration: {
            configurationType: 'FIELDS',
            viewUniversalIdentifier: '3e9d7c6a-e8f5-442e-8a6c-7c91df5c8532',
          },
        },
      ],
    },
    {
      universalIdentifier: 'f2191190-ee95-4b28-b029-c14601be131c',
      title: 'Timeline',
      position: 20,
      icon: 'IconTimelineEvent',
      layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
      widgets: [
        {
          universalIdentifier: 'd09a83ba-b75f-42dd-934d-2f9528861a0d',
          title: 'Timeline',
          type: 'TIMELINE',
          configuration: {
            configurationType: 'TIMELINE',
          },
        },
      ],
    },
  ],
});
