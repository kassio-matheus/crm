import { defineFrontComponent } from 'twenty-sdk/define';
import {
  Command,
  openSidePanelPage,
  SidePanelPages,
  useSelectedRecordIds,
} from 'twenty-sdk/front-component';
import { NATIVE_SALES } from 'src/constants/native-sales';

const SalesCoach = () => {
  const ids = useSelectedRecordIds();
  return (
    <Command
      execute={() =>
        openSidePanelPage({
          page: SidePanelPages.AskAI,
          pageTitle: 'Priorizar negociações',
          preprompt: {
            mode: 'PREFILL',
            text: `Analise as negociações selecionadas (${ids.join(', ')}), suas tarefas pendentes e o histórico disponível. Sugira os próximos passos por prioridade, sem alterar dados. Use o agente sales-coach quando disponível.`,
          },
        })
      }
    />
  );
};
export default defineFrontComponent({
  universalIdentifier: NATIVE_SALES.coach,
  name: 'sales-coach',
  description: 'Prepare sales prioritization in the native Twenty AI panel.',
  isHeadless: true,
  component: SalesCoach,
});
