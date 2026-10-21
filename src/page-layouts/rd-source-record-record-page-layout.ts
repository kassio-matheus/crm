import { definePageLayout, PageLayoutTabLayoutMode, PageLayoutType } from 'twenty-sdk/define';

export default definePageLayout({
  universalIdentifier: '8415a1c8-7152-4386-a1de-4216c0522eec',
  name: 'Default Registro RD Station Layout',
  type: PageLayoutType.RECORD_PAGE,
  objectUniversalIdentifier: '775d48f3-8678-43d2-9796-465b0f007d98',
  tabs: [
    {
      universalIdentifier: '1f867d13-c6b1-41b4-8918-ebce7095af52',
      title: 'Home',
      position: 10,
      icon: 'IconHome',
      layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
      widgets: [
        {
          universalIdentifier: 'c81ac82c-babf-4dcb-8636-1aa5bbb1621f',
          title: 'Fields',
          type: 'FIELDS',
          configuration: {
            configurationType: 'FIELDS',
            viewUniversalIdentifier: 'f50366d4-fe82-4f01-b0aa-9bf505b8a914',
          },
        },
      ],
    },
    {
      universalIdentifier: '266effe0-d2bd-4c2d-80a8-7d23e5461151',
      title: 'Timeline',
      position: 20,
      icon: 'IconTimelineEvent',
      layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
      widgets: [
        {
          universalIdentifier: '4686b311-01f1-4273-bf29-c55a8f8d77ef',
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
