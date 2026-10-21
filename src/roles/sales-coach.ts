import {
  defineRole,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS as objects,
} from 'twenty-sdk/define';
import { AI_ROLE } from 'src/constants/rd-identifiers';

export default defineRole({
  universalIdentifier: AI_ROLE,
  label: 'Sales coach — read only',
  canReadAllObjectRecords: false,
  canUpdateAllObjectRecords: false,
  canSoftDeleteAllObjectRecords: false,
  canDestroyAllObjectRecords: false,
  canBeAssignedToAgents: true,
  canBeAssignedToUsers: false,
  canBeAssignedToApiKeys: false,
  objectPermissions: [
    objects.opportunity,
    objects.task,
    objects.taskTarget,
  ].map((object) => ({
    objectUniversalIdentifier: object.universalIdentifier,
    canReadObjectRecords: true,
    canUpdateObjectRecords: false,
    canSoftDeleteObjectRecords: false,
    canDestroyObjectRecords: false,
  })),
});
