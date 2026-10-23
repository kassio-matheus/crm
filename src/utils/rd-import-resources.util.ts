/** Checkpoint indexes are persisted: never reorder this plan. */
export const rdImportResources = (version: 'v1' | 'v2'): string[] =>
  version === 'v1'
    ? [
        'deal_pipelines',
        'users',
        'teams',
        'organizations',
        'contacts',
        'products',
        'campaigns',
        'deal_sources',
        'deal_lost_reasons',
        'custom_fields',
        'deals',
        'tasks?done=false',
        'tasks?done=true',
      ]
    : [
        'pipelines',
        'users',
        'teams',
        'organizations',
        'contacts',
        'campaigns',
        'sources',
        'products',
        'lost_reasons',
        'custom_fields',
        'segments',
        'deals',
        'tasks',
        'meetings',
        'users/meeting_availability',
      ];
