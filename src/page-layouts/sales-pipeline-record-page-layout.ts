import { definePageLayout, PageLayoutTabLayoutMode, PageLayoutType } from 'twenty-sdk/define';

export default definePageLayout({
  universalIdentifier: '6d898c7d-99c1-4c20-b1eb-12d36755852a',
  name: 'Default Funil de vendas Layout',
  type: PageLayoutType.RECORD_PAGE,
  objectUniversalIdentifier: '50444479-e034-4fa5-8c38-2492629477bd',
  tabs: [
    {
      universalIdentifier: '831732b7-a27a-420f-ad24-d80bb5be6177',
      title: 'Home',
      position: 10,
      icon: 'IconHome',
      layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
      widgets: [
        {
          universalIdentifier: 'fbda3d3d-1b91-46e9-baa9-3650a6528a08',
          title: 'Fields',
          type: 'FIELDS',
          configuration: {
            configurationType: 'FIELDS',
            viewUniversalIdentifier: '6295530b-3184-4b5f-9eb7-c0a5132ced70',
          },
        },
      ],
    },
    {
      universalIdentifier: '0fe9c859-1c63-46d1-bc96-7882c5ce6e01',
      title: 'Timeline',
      position: 20,
      icon: 'IconTimelineEvent',
      layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
      widgets: [
        {
          universalIdentifier: '05440c10-6f8d-4b62-ba81-d4c6092f72fb',
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
