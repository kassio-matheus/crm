import {
  defineApplicationRole,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS as objects,
  SystemPermissionFlag,
} from 'twenty-sdk/define';
import {
  APP_DISPLAY_NAME,
  DEFAULT_ROLE_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';
import { SOURCE_OBJECT } from 'src/constants/rd-identifiers';

export default defineApplicationRole({
  universalIdentifier: DEFAULT_ROLE_UNIVERSAL_IDENTIFIER,
  label: `${APP_DISPLAY_NAME} application role`,
  description:
    'Access only to sales records, migration snapshots and the capabilities required by the import UI.',
  canReadAllObjectRecords: false,
  canUpdateAllObjectRecords: false,
  canSoftDeleteAllObjectRecords: false,
  canDestroyAllObjectRecords: false,
  objectPermissions: [
    ...[
      objects.company,
      objects.person,
      objects.opportunity,
      objects.task,
      objects.taskTarget,
      objects.note,
      objects.noteTarget,
      objects.attachment,
    ].map((object) => ({
      objectUniversalIdentifier: object.universalIdentifier,
      canReadObjectRecords: true,
      canUpdateObjectRecords: true,
      canSoftDeleteObjectRecords: false,
      canDestroyObjectRecords: false,
    })),
    {
      objectUniversalIdentifier: objects.workspaceMember.universalIdentifier,
      canReadObjectRecords: true,
      canUpdateObjectRecords: false,
    },
    {
      objectUniversalIdentifier: SOURCE_OBJECT,
      canReadObjectRecords: true,
      canUpdateObjectRecords: true,
      canSoftDeleteObjectRecords: false,
      canDestroyObjectRecords: false,
    },
  ],
  permissionFlagUniversalIdentifiers: [
    SystemPermissionFlag.APPLICATIONS,
    SystemPermissionFlag.AI,
    SystemPermissionFlag.UPLOAD_FILE,
    SystemPermissionFlag.DOWNLOAD_FILE,
  ],
});
