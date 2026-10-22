import { NATIVE_SALES } from 'src/constants/native-sales';
import {
  defineNavigationMenuItem,
  NavigationMenuItemType,
} from 'twenty-sdk/define';

export default defineNavigationMenuItem({
  universalIdentifier: '542887ef-f83b-4536-8cda-f1e93ef5fe38',
  name: 'Etapas dos funis',
  icon: 'IconCompass',
  position: 1,
  folderUniversalIdentifier: NATIVE_SALES.adminFolder,
  type: NavigationMenuItemType.OBJECT,
  targetObjectUniversalIdentifier: '01f28af1-c4e7-4b83-8084-1640c8d25981',
});
