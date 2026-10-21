import { execFileSync } from 'node:child_process';
import { STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS as objects } from 'twenty-sdk/define';
const fields = {
  opportunity: {
    rdSourceKey: 'TEXT',
    rdOriginalData: 'RAW_JSON',
    salesPipelineKey: 'TEXT',
    salesStageKey: 'TEXT',
    dealStatus: 'SELECT',
    qualification: 'NUMBER',
    nextActivityAt: 'DATE_TIME',
    lastContactAt: 'DATE_TIME',
    rdCreatedAt: 'DATE_TIME',
    rdOwnerId: 'TEXT',
    rdOwnerName: 'TEXT',
  },
  company: { rdSourceKey: 'TEXT', rdOriginalData: 'RAW_JSON' },
  person: { rdSourceKey: 'TEXT', rdOriginalData: 'RAW_JSON' },
  task: { rdSourceKey: 'TEXT', rdOriginalData: 'RAW_JSON' },
  note: { rdSourceKey: 'TEXT', rdOriginalData: 'RAW_JSON' },
};
const fs = await import('node:fs');
for (const [object, entries] of Object.entries(fields))
  for (const [name, type] of Object.entries(entries)) {
    if (
      fs.existsSync(
        `src/fields/${object}-${name.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}.ts`,
      )
    )
      continue;
    execFileSync(
      'twenty',
      [
        'app',
        'add',
        'field',
        '--name',
        name,
        '--type',
        type,
        '--object',
        objects[object].universalIdentifier ?? objects[object],
        '--path',
        process.cwd(),
        '--no-input',
      ],
      { stdio: 'pipe' },
    );
    // The CLI names field files after the field alone; preserve every object extension.

    fs.renameSync(
      `src/fields/${name.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}.ts`,
      `src/fields/${object}-${name.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}.ts`,
    );
  }
