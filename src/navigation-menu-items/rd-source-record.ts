import {NATIVE_SALES} from 'src/constants/native-sales';
import {
  defineNavigationMenuItem,
  NavigationMenuItemType,
} from 'twenty-sdk/define';

export default defineNavigationMenuItem({
  universalIdentifier: '58d254b3-122c-4fcf-a8d4-2af6b729b06f',
  name: 'Registros da importação',
  icon: 'IconCompass',
  position: 2,
 folderUniversalIdentifier:NATIVE_SALES.adminFolder,
  type: NavigationMenuItemType.OBJECT,
  targetObjectUniversalIdentifier: '775d48f3-8678-43d2-9796-465b0f007d98',
});
