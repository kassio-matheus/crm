/** New checkpoints store this plan explicitly; legacy indexes are never reinterpreted. */
export const recentImportPlan = (sample: boolean): string[] =>
  sample
    ? ['pipelines', 'users', 'teams', 'custom_fields', 'deals']
    : [
        'pipelines',
        'users',
        'teams',
        'custom_fields',
        'deals',
        'tasks',
        'campaigns',
        'sources',
        'products',
        'lost_reasons',
        'segments',
        'meetings',
        'users/meeting_availability',
        'organizations',
        'contacts',
      ];
