import {
  definePageLayout,
  PageLayoutTabLayoutMode,
  PageLayoutWidgetVerticalListHeightBehavior,
} from 'twenty-sdk/define';
import {
  IMPORT_LAYOUT,
  IMPORT_TAB,
  IMPORT_WIDGET,
  IMPORT_COMPONENT,
} from 'src/constants/rd-identifiers';
export default definePageLayout({
  universalIdentifier: IMPORT_LAYOUT,
  name: 'Importar RD Station',
  type: 'STANDALONE_PAGE',
  tabs: [
    {
      universalIdentifier: IMPORT_TAB,
      title: 'Importação',
      position: 0,
      layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
      widgets: [
        {
          universalIdentifier: IMPORT_WIDGET,
          title: ' ',
          type: 'FRONT_COMPONENT',
          heightBehavior:
            PageLayoutWidgetVerticalListHeightBehavior.TAB_VIEWPORT,
          configuration: {
            configurationType: 'FRONT_COMPONENT',
            frontComponentUniversalIdentifier: IMPORT_COMPONENT,
          },
        },
      ],
    },
  ],
});
