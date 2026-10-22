import { defineNavigationMenuItem } from 'twenty-sdk/define';
import { NATIVE_SALES } from 'src/constants/native-sales';
import {
  MAIN_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
  MAIN_PAGE_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';
export default defineNavigationMenuItem({
  universalIdentifier: MAIN_PAGE_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  name: 'Filtros de negociações',
  icon: 'IconFilter',
  type: 'PAGE_LAYOUT',
  position: 3,
  folderUniversalIdentifier: NATIVE_SALES.adminFolder,
  pageLayoutUniversalIdentifier: MAIN_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
});
