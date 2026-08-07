export const deploymentI18n = {
  credential: {
    created: 'Credential created successfully.',
    updated: 'Credential updated successfully.',
    deleted: 'Credential deleted.',
    notFound: 'Credential not found.',
  },
  target: {
    created: 'Deployment target registered.',
    updated: 'Deployment target updated.',
    deleted: 'Deployment target removed.',
    notFound: 'Deployment target not found.',
    connectionSuccess: 'SSH connection verified.',
    connectionFailed: 'SSH connection failed.',
  },
  application: {
    created: 'Application created successfully.',
    updated: 'Application updated.',
    deleted: 'Application deleted.',
    notFound: 'Application not found.',
    duplicateName: 'An application with this name already exists.',
  },
  deployment: {
    triggered: 'Deployment started. Monitor logs for progress.',
    alreadyRunning: 'This application is already deploying.',
    notFound: 'Deployment not found.',
    cancelled: 'Deployment cancelled.',
    rollbackStarted: 'Rollback initiated.',
    rollbackNoTarget: 'No previous release available to roll back to.',
    cannotRollback: 'Only successful deployments can be rolled back.',
    cannotCancel: 'Deployment cannot be cancelled in its current state.',
  },
};
