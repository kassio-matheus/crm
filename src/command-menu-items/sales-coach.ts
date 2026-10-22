import {
  defineCommandMenuItem,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS as objects,
} from 'twenty-sdk/define';
import { NATIVE_SALES } from 'src/constants/native-sales';
export default defineCommandMenuItem({
  universalIdentifier: NATIVE_SALES.coachCommand,
  label: 'Priorizar negociações com IA',
  shortLabel: 'Priorizar com IA',
  isPinned: false,
  availabilityType: 'RECORD_SELECTION',
  availabilityObjectUniversalIdentifier:
    objects.opportunity.universalIdentifier,
  frontComponentUniversalIdentifier: NATIVE_SALES.coach,
});
