import feeScheduleRouter from './fee-schedule/fee-schedule.route';
import procedureCodeRouter from './procedure-code/procedure-code.route';
import ruleRouter from './rule/rule.route';
import coverageRuleRouter from './coverage-rule/coverage-rule.route';
import claimPredictionRouter from './claim-prediction/claim-prediction.route';
import claimTrackingRouter from './claim-tracking/claim-tracking.route';
import auditLogRouter from './audit-log/audit-log.route';
import paymentPostingRouter from './payment-posting/payment-posting.route';
import reportRouter from './report/report.route';

jest.mock('./claim-prediction/claim-prediction.controller', () => ({
  claimPredictionController: {
    predict: jest.fn(),
    predictByClaimId: jest.fn(),
    predictByChargeId: jest.fn(),
    predictByEncounterId: jest.fn(),
    estimateByAppointmentId: jest.fn(),
    list: jest.fn(),
  },
}));

function findRouteLayer(router: any, path: string, method: string) {
  return router.stack.find((layer: any) =>
    layer.route?.path === path &&
    Boolean(layer.route?.methods?.[method])
  );
}

function expectRouteHasPermissionGuard(router: any, path: string, method: string) {
  const layer = findRouteLayer(router, path, method);

  expect(layer).toBeDefined();
  expect(layer.route.stack.length).toBeGreaterThanOrEqual(2);
}

describe('RCM route permissions', () => {
  it('guards fee schedule contract rate routes', () => {
    expectRouteHasPermissionGuard(feeScheduleRouter, '/lookup', 'post');
    expectRouteHasPermissionGuard(feeScheduleRouter, '/', 'post');
    expectRouteHasPermissionGuard(feeScheduleRouter, '/', 'get');
    expectRouteHasPermissionGuard(feeScheduleRouter, '/:id', 'put');
    expectRouteHasPermissionGuard(feeScheduleRouter, '/:id', 'delete');
  });

  it('guards procedure-code coding rule routes', () => {
    expectRouteHasPermissionGuard(procedureCodeRouter, '/', 'post');
    expectRouteHasPermissionGuard(procedureCodeRouter, '/', 'get');
    expectRouteHasPermissionGuard(procedureCodeRouter, '/:id', 'patch');
    expectRouteHasPermissionGuard(procedureCodeRouter, '/:id', 'delete');
  });

  it('guards generic payer/coding rule routes', () => {
    expectRouteHasPermissionGuard(ruleRouter, '/', 'post');
    expectRouteHasPermissionGuard(ruleRouter, '/', 'get');
    expectRouteHasPermissionGuard(ruleRouter, '/:id', 'patch');
    expectRouteHasPermissionGuard(ruleRouter, '/:id', 'delete');
  });

  it('guards payer coverage rule routes', () => {
    expectRouteHasPermissionGuard(coverageRuleRouter, '/evaluate', 'post');
    expectRouteHasPermissionGuard(coverageRuleRouter, '/', 'post');
    expectRouteHasPermissionGuard(coverageRuleRouter, '/', 'get');
    expectRouteHasPermissionGuard(coverageRuleRouter, '/:id', 'put');
    expectRouteHasPermissionGuard(coverageRuleRouter, '/:id', 'delete');
  });

  it('guards claim prediction routes with UI permission keys', () => {
    expectRouteHasPermissionGuard(claimPredictionRouter, '/', 'post');
    expectRouteHasPermissionGuard(claimPredictionRouter, '/', 'get');
    expectRouteHasPermissionGuard(claimPredictionRouter, '/claim/:claimId', 'post');
    expectRouteHasPermissionGuard(claimPredictionRouter, '/appointment/:id/estimate', 'post');
  });

  it('keeps append-only tracking and audit routes read-only through the public API', () => {
    expectRouteHasPermissionGuard(claimTrackingRouter, '/', 'get');
    expectRouteHasPermissionGuard(claimTrackingRouter, '/:id', 'get');
    expect(findRouteLayer(claimTrackingRouter, '/', 'post')).toBeUndefined();
    expect(findRouteLayer(claimTrackingRouter, '/:id', 'put')).toBeUndefined();
    expect(findRouteLayer(claimTrackingRouter, '/:id', 'delete')).toBeUndefined();

    expectRouteHasPermissionGuard(auditLogRouter, '/', 'get');
    expectRouteHasPermissionGuard(auditLogRouter, '/:id', 'get');
    expectRouteHasPermissionGuard(auditLogRouter, '/', 'post');
    expectRouteHasPermissionGuard(auditLogRouter, '/bulk-delete', 'post');
    expectRouteHasPermissionGuard(auditLogRouter, '/bulk-update', 'patch');
    expectRouteHasPermissionGuard(auditLogRouter, '/:id', 'put');
    expectRouteHasPermissionGuard(auditLogRouter, '/:id', 'delete');
  });

  it('uses controlled payment posting reversal instead of bulk destructive posting actions', () => {
    expectRouteHasPermissionGuard(paymentPostingRouter, '/:id/reverse', 'post');
    expect(findRouteLayer(paymentPostingRouter, '/bulk-delete', 'post')).toBeUndefined();
    expect(findRouteLayer(paymentPostingRouter, '/bulk-update', 'post')).toBeUndefined();
  });

  it('guards enterprise operational report routes as read-only', () => {
    expectRouteHasPermissionGuard(reportRouter, '/denials', 'get');
    expectRouteHasPermissionGuard(reportRouter, '/claim-closure', 'get');
    expectRouteHasPermissionGuard(reportRouter, '/financial-risk', 'get');
    expectRouteHasPermissionGuard(reportRouter, '/ai-operations', 'get');
    expectRouteHasPermissionGuard(reportRouter, '/realtime', 'get');
    expect(findRouteLayer(reportRouter, '/', 'post')).toBeUndefined();
    expect(findRouteLayer(reportRouter, '/:id', 'delete')).toBeUndefined();
  });
});
