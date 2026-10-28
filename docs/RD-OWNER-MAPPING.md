# Proprietários e membros do Twenty

O ID de um usuário do RD é diferente do ID de um membro do Twenty. O importador faz a correspondência por e-mail, desconsiderando maiúsculas e espaços nas pontas. Nomes iguais não bastam: uma pessoa pode ter duas contas no RD, e pessoas diferentes podem usar o mesmo nome.

Quando a mesma pessoa usa e-mails diferentes, o administrador pode confirmar uma correspondência explícita entre **ID do usuário do RD** e **ID do membro do Twenty**. Essa correspondência tem prioridade sobre o e-mail, vale somente para a companhia configurada e exige que o membro ainda exista no workspace. Não altera login, senha, e-mail, equipe ou permissões. Um membro pode representar duas contas históricas do RD se ambas forem confirmadas.

Os vínculos confirmados são registros técnicos com `recordKind: ownerMapping`, chave `${accountKey}:owner-mapping:${rdUserId}`, ID determinístico derivado dessa chave e `targetId` apontando para o membro. Não pertencem à amostra e não são removidos com ela. Identidades ou chaves inconsistentes interrompem a leitura; um membro removido é mostrado como não encontrado e não é substituído silenciosamente por outra pessoa com o mesmo e-mail.

## Simulação e importação

- A simulação verifica a correspondência e mostra **E-mail correspondente** ou **Vínculo confirmado**. Não atribui proprietários a registros operacionais.
- A importação usa os mesmos vínculos para `ownerId` das negociações, `accountOwnerId` das empresas e `assigneeId` das tarefas com um único responsável.
- Uma repetição pode preencher proprietários vazios em destinos canônicos da mesma origem. Uma condição na própria atualização preserva uma atribuição manual que ocorra ao mesmo tempo. Proprietários já preenchidos são preservados.
- Tarefas com vários responsáveis no RD mantêm a lista no JSON original; o importador não escolhe uma pessoa arbitrariamente.

O painel consulta os membros e os vínculos atuais ao atualizar o status, inclusive após a conclusão da amostra. Essa conferência não faz requisições extras ao RD e não grava o checkpoint que está sendo usado pelo worker. O total mostrado é de **contas do RD associadas**, podendo ser maior que o número de membros quando duas contas representam a mesma pessoa.

Não há sincronização recorrente que substitui proprietários definidos localmente. Para corrigir registros anteriores sem importar novos clientes, revise os responsáveis atuais no RD e preencha somente os vínculos vazios, usando os mesmos identificadores de origem e a atualização condicional.

## Validação

Os testes cobrem e-mails normalizados, ambiguidades, paginação, vínculos entre e-mails diferentes, isolamento por companhia, dados inconsistentes, membro removido e proteção de atribuições existentes. O teste com banco isolado no Twenty 2.50.1 verifica a simulação sem atribuições, a repetição de negociações/empresas/tarefas com um vínculo confirmado, a preservação de nomes editados manualmente e a manutenção dos registros de propriedade da amostra.
