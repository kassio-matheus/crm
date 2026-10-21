import {
  defineNavigationMenuItem,
  NavigationMenuItemType,
} from 'twenty-sdk/define';
import { IMPORT_NAV, IMPORT_LAYOUT } from 'src/constants/rd-identifiers';
export default defineNavigationMenuItem({
  universalIdentifier: IMPORT_NAV,
  name: 'Importar RD Station',
  icon: 'IconDownload',
  position: 1,
  type: NavigationMenuItemType.PAGE_LAYOUT,
  pageLayoutUniversalIdentifier: IMPORT_LAYOUT,
});
