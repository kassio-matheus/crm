import {NATIVE_SALES} from 'src/constants/native-sales';
import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';

export default defineNavigationMenuItem({
  universalIdentifier: '4f15b91a-73ef-4384-abfb-e57eafc08f3f',
  name: 'Funis de vendas',
  icon: 'IconCompass',
  position: 0,
 folderUniversalIdentifier:NATIVE_SALES.adminFolder,
  type: NavigationMenuItemType.OBJECT,
  targetObjectUniversalIdentifier: '50444479-e034-4fa5-8c38-2492629477bd',
});
