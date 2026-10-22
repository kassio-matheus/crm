import {
  defineCommandMenuItem,
  pageType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS as objects,
} from 'twenty-sdk/define';
import { NATIVE_SALES } from 'src/constants/native-sales';
export default defineCommandMenuItem({
  universalIdentifier: NATIVE_SALES.filtersCommand,
  label: 'Filtrar negociações',
  shortLabel: 'Filtros',
  isPinned: true,
  availabilityType: 'GLOBAL_OBJECT_CONTEXT',
  availabilityObjectUniversalIdentifier:
    objects.opportunity.universalIdentifier,
  conditionalAvailabilityExpression: pageType === 'INDEX_PAGE',
  frontComponentUniversalIdentifier: NATIVE_SALES.openFilters,
});
