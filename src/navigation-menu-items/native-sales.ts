import { defineNavigationMenuItem } from 'twenty-sdk/define';
import { NATIVE_SALES } from 'src/constants/native-sales';
export default defineNavigationMenuItem({
  universalIdentifier: NATIVE_SALES.nativeNavigation,
  name: 'Negociações',
  icon: 'IconLayoutKanban',
  type: 'VIEW',
  position: 4,
  folderUniversalIdentifier: NATIVE_SALES.adminFolder,
  viewUniversalIdentifier: NATIVE_SALES.board,
});
