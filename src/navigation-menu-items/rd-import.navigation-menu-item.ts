import {
  defineNavigationMenuItem,
  NavigationMenuItemType,
} from 'twenty-sdk/define';
import { IMPORT_NAV, IMPORT_LAYOUT } from 'src/constants/rd-identifiers';
export default defineNavigationMenuItem({
  universalIdentifier: IMPORT_NAV,
  name: 'Importar do RD Station',
  icon: 'IconDownload',
  position: 5,
  type: NavigationMenuItemType.PAGE_LAYOUT,
  pageLayoutUniversalIdentifier: IMPORT_LAYOUT,
});
