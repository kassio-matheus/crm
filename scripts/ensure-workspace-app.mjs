import { execFileSync } from 'node:child_process';
import { accessSync, constants } from 'node:fs';
import { join } from 'node:path';

export function ensureWorkspaceApplication(identity, request) {
  const variables = { universalIdentifier: identity.universalIdentifier };
  const registration = request(
    'query($universalIdentifier:String!){findApplicationRegistrationByUniversalIdentifier(universalIdentifier:$universalIdentifier){id}}',
    variables,
  ).findApplicationRegistrationByUniversalIdentifier;
  if (!registration)
    request(
      'mutation($input:CreateApplicationRegistrationInput!){createApplicationRegistration(input:$input){applicationRegistration{id}}}',
      { input: { name: identity.name, ...variables } },
    );
  // Ensure the workspace installation exists before uploading assets.
  // This API is idempotent and never deletes data.
  return request(
    'mutation($universalIdentifier:String!,$name:String!){createDevelopmentApplication(universalIdentifier:$universalIdentifier,name:$name){id universalIdentifier}}',
    { ...variables, name: identity.name },
  ).createDevelopmentApplication;
}

export function ensureAppUsingStandaloneCli(identity) {
  const cli =
    process.env.TWENTY_CLI_PATH ??
    process.env.PATH.split(':')
      .filter(
        (part) =>
          !part.includes('node_modules') &&
          !part.includes('.yarn') &&
          !part.includes('/xfs-'),
      )
      .map((part) => join(part, 'twenty'))
      .find((path) => {
        try {
          accessSync(path, constants.X_OK);
          return true;
        } catch {
          return false;
        }
      });
  if (!cli)
    throw new Error(
      'Install the standalone Twenty CLI or set TWENTY_CLI_PATH.',
    );
  return ensureWorkspaceApplication(identity, (query, variables) => {
    const result = JSON.parse(
      execFileSync(
        cli,
        [
          'api',
          'graphql',
          '--metadata',
          '--query',
          query,
          '--variables',
          JSON.stringify(variables),
          '--json',
          ...(process.env.TWENTY_REMOTE
            ? ['--remote', process.env.TWENTY_REMOTE]
            : []),
        ],
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
      ),
    );
    if (!result.ok)
      throw new Error(
        'Could not prepare the app registration in the selected workspace.',
      );
    return result.data;
  });
}
