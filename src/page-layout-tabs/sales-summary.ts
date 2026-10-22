import {
  definePageLayoutTab,
  STANDARD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIERS as layouts,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS as objects,
} from 'twenty-sdk/define';
import { NATIVE_SALES } from 'src/constants/native-sales';
export default definePageLayoutTab({
  universalIdentifier: NATIVE_SALES.summaryTab,
  pageLayoutUniversalIdentifier:
    layouts.opportunityRecordPage.universalIdentifier,
  title: 'Negociação',
  icon: 'IconBriefcase',
  position: -10,
  layoutMode: 'VERTICAL_LIST',
  widgets: [
    {
      universalIdentifier: '68c2ff1f-5e48-4284-ad2e-a04bba10f1bf',
      title: 'Negociação',
      type: 'FIELDS',
      configuration: {
        configurationType: 'FIELDS',
        viewUniversalIdentifier: NATIVE_SALES.fields,
        newFieldDefaultVisibility: false,
        shouldAllowUserToSeeHiddenFields: false,
      },
    },
    {
      universalIdentifier: '65d64af8-dbfd-464b-9f69-3cc66862cd36',
      title: 'Contato',
      type: 'FIELD',
      configuration: {
        configurationType: 'FIELD',
        fieldMetadataId:
          objects.opportunity.fields.pointOfContact.universalIdentifier,
        fieldDisplayMode: 'CARD',
      },
    },
    {
      universalIdentifier: 'e204deed-889c-4884-9701-ed9ffa050b36',
      title: 'Empresa',
      type: 'FIELD',
      configuration: {
        configurationType: 'FIELD',
        fieldMetadataId: objects.opportunity.fields.company.universalIdentifier,
        fieldDisplayMode: 'CARD',
      },
    },
    {
      universalIdentifier: '95a2d1d2-d6cb-4d17-8dd0-5872285f68f9',
      title: 'Responsável',
      type: 'FIELD',
      configuration: {
        configurationType: 'FIELD',
        fieldMetadataId: objects.opportunity.fields.owner.universalIdentifier,
        fieldDisplayMode: 'CARD',
      },
    },
  ],
});
