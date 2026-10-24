/** New checkpoints store this plan explicitly; legacy indexes are never reinterpreted. */
export const recentImportPlan = (sample: boolean): string[] =>
  sample
    ? ['pipelines', 'users', 'teams', 'deals']
    : [
        'pipelines',
        'users',
        'teams',
        'deals',
        'tasks',
        'campaigns',
        'sources',
        'products',
        'lost_reasons',
        'custom_fields',
        'segments',
        'meetings',
        'users/meeting_availability',
        'organizations',
        'contacts',
      ];
