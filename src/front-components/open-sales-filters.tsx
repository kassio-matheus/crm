import { defineFrontComponent } from 'twenty-sdk/define';
import {
  Command,
  openSidePanelPage,
  SidePanelPages,
} from 'twenty-sdk/front-component';
import { MetadataApiClient } from 'twenty-client-sdk/metadata';
import { NATIVE_SALES } from 'src/constants/native-sales';
import { MAIN_PAGE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

const OpenSalesFilters = () => (
  <Command
    execute={async () => {
      const result = await new MetadataApiClient().query({
        frontComponents: { id: true, universalIdentifier: true },
      });
      const component = result.frontComponents.find(
        (c) =>
          c.universalIdentifier ===
          MAIN_PAGE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
      );
      if (!component) throw new Error('Sales filters component is missing.');
      await openSidePanelPage({
        page: SidePanelPages.ViewFrontComponent,
        frontComponentId: component.id,
        objectNameSingular: 'opportunity',
        pageTitle: 'Filtros de negociações',
        pageIcon: 'IconFilter',
        resetNavigationStack: true,
      });
    }}
  />
);

export default defineFrontComponent({
  universalIdentifier: NATIVE_SALES.openFilters,
  name: 'open-sales-filters',
  description: 'Open quick filters beside the native Twenty opportunity board.',
  isHeadless: true,
  component: OpenSalesFilters,
});
