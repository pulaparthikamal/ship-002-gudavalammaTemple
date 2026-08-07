import { Menu } from '../../modules/menu/menu.model';
import { Role } from '../../modules/role/role.model';
import { RoleEnum } from '../../constants/roles.constants';
import { logger } from '../../utils/logger.util';

const defaultMenus = [
  { title: 'Dashboard', permissionKey: 'dashboard', route: '/dashboard', sequenceNo: 1, iconName: 'dashboard' },
  { title: 'Users', permissionKey: 'users', route: '/users', sequenceNo: 2, iconName: 'users' },
  {
    title: 'RCM',
    permissionKey: 'rcm',
    route: '/rcm/dashboard',
    sequenceNo: 3,
    iconName: 'briefcase-business',
    submenu: [
      { name: 'RCM Dashboard', title: 'RCM Dashboard', permissionKey: 'dashboard', route: '/rcm/dashboard', sequenceNo: 30, iconName: 'layout-dashboard' },
      { name: 'Patients', title: 'Patients', permissionKey: 'patients', route: '/rcm/patients', sequenceNo: 31, iconName: 'user' },
      { name: 'Insurance Policies', title: 'Insurance Policies', permissionKey: 'insurance-policies', route: '/rcm/insurance-policies', sequenceNo: 32, iconName: 'circle' },
      { name: 'Eligibility Verifications', title: 'Eligibility Verifications', permissionKey: 'eligibility-verifications', route: '/rcm/eligibility-verifications', sequenceNo: 33, iconName: 'circle' },
      { name: 'Appointments', title: 'Appointments', permissionKey: 'appointments', route: '/rcm/appointments', sequenceNo: 34, iconName: 'circle' },
      { name: 'Referrals', title: 'Referrals', permissionKey: 'referrals', route: '/rcm/referrals', sequenceNo: 35, iconName: 'circle' },
      { name: 'Prior Authorizations', title: 'Prior Authorizations', permissionKey: 'prior-authorizations', route: '/rcm/prior-authorizations', sequenceNo: 36, iconName: 'circle' },
      { name: 'Providers', title: 'Providers', permissionKey: 'providers', route: '/rcm/providers', sequenceNo: 37, iconName: 'circle' },
      { name: 'Facilities', title: 'Facilities', permissionKey: 'facilities', route: '/rcm/facilities', sequenceNo: 38, iconName: 'circle' },
      { name: 'Payers', title: 'Payers', permissionKey: 'payers', route: '/rcm/payers', sequenceNo: 39, iconName: 'circle' },
      { name: 'Procedure Codes', title: 'Procedure Codes', permissionKey: 'procedure-codes', route: '/rcm/procedure-codes', sequenceNo: 40, iconName: 'circle' },
      { name: 'Rules', title: 'Rules', permissionKey: 'rules', route: '/rcm/rules', sequenceNo: 41, iconName: 'circle' },
      { name: 'Coverage Rules', title: 'Coverage Rules', permissionKey: 'coverage-rules', route: '/rcm/coverage-rules', sequenceNo: 42, iconName: 'circle' },
      { name: 'Encounters', title: 'Encounters', permissionKey: 'encounters', route: '/rcm/encounters', sequenceNo: 43, iconName: 'circle' },
      { name: 'Charge Masters', title: 'Charge Masters', permissionKey: 'charge-masters', route: '/rcm/charge-masters', sequenceNo: 44, iconName: 'circle' },
      { name: 'Fee Schedules', title: 'Fee Schedules', permissionKey: 'fee-schedules', route: '/rcm/fee-schedules', sequenceNo: 45, iconName: 'circle' },
      { name: 'Charges', title: 'Charges', permissionKey: 'charges', route: '/rcm/charges', sequenceNo: 46, iconName: 'circle' },
      { name: 'Coding Reviews', title: 'Coding Reviews', permissionKey: 'coding-reviews', route: '/rcm/coding-reviews', sequenceNo: 47, iconName: 'circle' },
      { name: 'Claims', title: 'Claims', permissionKey: 'claims', route: '/rcm/claims', sequenceNo: 48, iconName: 'circle' },
      { name: 'Claim AI Reviews', title: 'Claim AI Reviews', permissionKey: 'claim-ai-reviews', route: '/rcm/claim-ai-reviews', sequenceNo: 49, iconName: 'circle' },
      { name: 'Claim Predictions', title: 'Claim Predictions', permissionKey: 'claim-predictions', route: '/rcm/claim-predictions', sequenceNo: 50, iconName: 'circle' },
      { name: 'Claim Submissions', title: 'Claim Submissions', permissionKey: 'claim-submissions', route: '/rcm/claim-submissions', sequenceNo: 51, iconName: 'circle' },
      { name: 'Claim Tracking / Rejections', title: 'Claim Tracking / Rejections', permissionKey: 'claim-trackings', route: '/rcm/claim-trackings', sequenceNo: 52, iconName: 'circle' },
      { name: 'Payment Postings', title: 'Payment Postings', permissionKey: 'payment-postings', route: '/rcm/payment-postings', sequenceNo: 53, iconName: 'circle' },
      { name: 'ERA / EOB Processing', title: 'ERA / EOB Processing', permissionKey: 'era-eob-processings', route: '/rcm/era-eob-processings', sequenceNo: 54, iconName: 'circle' },
      { name: 'Adjustments / Write-offs', title: 'Adjustments / Write-offs', permissionKey: 'adjustments', route: '/rcm/adjustments', sequenceNo: 55, iconName: 'circle' },
      { name: 'AR Work Queue', title: 'AR Work Queue', permissionKey: 'ar-work-items', route: '/rcm/ar-work-items', sequenceNo: 56, iconName: 'circle' },
      { name: 'Denial Management', title: 'Denial Management', permissionKey: 'denials', route: '/rcm/denials', sequenceNo: 57, iconName: 'circle' },
      { name: 'Appeals', title: 'Appeals', permissionKey: 'appeals', route: '/rcm/appeals', sequenceNo: 58, iconName: 'circle' },
      { name: 'Corrected Claims / Resubmissions', title: 'Corrected Claims / Resubmissions', permissionKey: 'corrected-claims', route: '/rcm/corrected-claims', sequenceNo: 59, iconName: 'circle' },
      { name: 'Patient Billing', title: 'Patient Billing', permissionKey: 'patient-billings', route: '/rcm/patient-billings', sequenceNo: 60, iconName: 'circle' },
      { name: 'Patient Payments', title: 'Patient Payments', permissionKey: 'patient-payments', route: '/rcm/patient-payments', sequenceNo: 61, iconName: 'circle' },
      { name: 'Refunds', title: 'Refunds', permissionKey: 'refunds', route: '/rcm/refunds', sequenceNo: 62, iconName: 'circle' },
      { name: 'Collections', title: 'Collections', permissionKey: 'collections', route: '/rcm/collections', sequenceNo: 63, iconName: 'circle' },
      { name: 'Document Management', title: 'Document Management', permissionKey: 'documents', route: '/rcm/documents', sequenceNo: 64, iconName: 'circle' },
      { name: 'Documentation Compliance', title: 'Documentation Compliance', permissionKey: 'claims', route: '/rcm/documentation-compliance-alerts', sequenceNo: 65, iconName: 'documentation-compliance-alerts' },
      { name: 'Tasks / Work Queue', title: 'Tasks / Work Queue', permissionKey: 'tasks', route: '/rcm/tasks', sequenceNo: 66, iconName: 'circle' },
      { name: 'Audit Log', title: 'Audit Log', permissionKey: 'audit-logs', route: '/rcm/audit-logs', sequenceNo: 67, iconName: 'circle' },
      { name: 'Reports & Analytics', title: 'Reports & Analytics', permissionKey: 'reports', route: '/rcm/reports', sequenceNo: 68, iconName: 'circle' },
    ]
  },
  {
    title: 'MineCare AI',
    permissionKey: 'minecare-ai',
    route: '/minecare-ai/dashboard',
    sequenceNo: 14,
    iconName: 'minecare-ai',
    active: true,
    submenu: [
      { name: 'Dashboard', title: 'Dashboard', permissionKey: 'minecare-ai-dashboard', route: '/minecare-ai/dashboard', sequenceNo: 1, iconName: 'layout-dashboard', active: true, submenu: [] },
      { name: 'Equipment Registry', title: 'Equipment Registry', permissionKey: 'minecare-ai-equipment', route: '/minecare-ai/equipment', sequenceNo: 2, iconName: 'equipment-registry', active: true, submenu: [] },
      { name: 'Equipment Onboarding', title: 'Equipment Onboarding', permissionKey: 'minecare-ai-equipment-onboarding', route: '/minecare-ai/equipment/new', sequenceNo: 3, iconName: 'equipment-onboarding', active: true, submenu: [] },
      { name: 'Service Calendar', title: 'Service Calendar', permissionKey: 'minecare-ai-service-calendar', route: '/minecare-ai/service-calendar', sequenceNo: 4, iconName: 'service-calendar', active: true, submenu: [] },
      { name: 'Risk Ranking', title: 'Risk Ranking', permissionKey: 'minecare-ai-risk-ranking', route: '/minecare-ai/risk-ranking', sequenceNo: 5, iconName: 'risk-ranking', active: true, submenu: [] },
      { name: 'Warranty Tracker', title: 'Warranty Tracker', permissionKey: 'minecare-ai-warranty', route: '/minecare-ai/warranty', sequenceNo: 6, iconName: 'warranty-tracker', active: true, submenu: [] },
      { name: 'Operator Observations', title: 'Operator Observations', permissionKey: 'minecare-ai-operator-observations', route: '/minecare-ai/operator-observations', sequenceNo: 7, iconName: 'operator-observations', active: true, submenu: [] },
      { name: 'Spare Parts Planner', title: 'Spare Parts Planner', permissionKey: 'minecare-ai-spares', route: '/minecare-ai/spares', sequenceNo: 8, iconName: 'spare-parts-planner', active: true, submenu: [] },
      { name: 'Budget Forecast', title: 'Budget Forecast', permissionKey: 'minecare-ai-budget', route: '/minecare-ai/budget', sequenceNo: 9, iconName: 'budget-forecast', active: true, submenu: [] },
      { name: 'Alerts', title: 'Alerts', permissionKey: 'minecare-ai-alerts', route: '/minecare-ai/alerts', sequenceNo: 10, iconName: 'alerts', active: true, submenu: [] },
      { name: 'Action Center', title: 'Action Center', permissionKey: 'minecare-ai-action-center', route: '/minecare-ai/action-center', sequenceNo: 11, iconName: 'action-center', active: true, submenu: [] },
      { name: 'AI Copilot', title: 'AI Copilot', permissionKey: 'minecare-ai-copilot', route: '/minecare-ai/copilot', sequenceNo: 12, iconName: 'ai-copilot', active: true, submenu: [] },
      { name: 'Reports', title: 'Reports', permissionKey: 'minecare-ai-reports', route: '/minecare-ai/reports', sequenceNo: 13, iconName: 'file-search', active: true, submenu: [] },
      { name: 'AI Recommendations', title: 'AI Recommendations', permissionKey: 'minecare-ai-recommendations', route: '/minecare-ai/recommendations', sequenceNo: 14, iconName: 'ai-recommendations', active: true, submenu: [] },
      { name: 'Root Cause Analysis', title: 'Root Cause Analysis', permissionKey: 'minecare-ai-root-cause', route: '/minecare-ai/root-cause', sequenceNo: 15, iconName: 'root-cause-analysis', active: true, submenu: [] },
      { name: 'Checklists', title: 'Checklists', permissionKey: 'minecare-ai-checklists', route: '/minecare-ai/checklists', sequenceNo: 16, iconName: 'checklists', active: true, submenu: [] },
      { name: 'Knowledge Assistant', title: 'Knowledge Assistant', permissionKey: 'minecare-ai-knowledge-assistant', route: '/minecare-ai/knowledge-assistant', sequenceNo: 17, iconName: 'knowledge-assistant', active: true, submenu: [] },
      { name: 'Vendor SLA', title: 'Vendor SLA', permissionKey: 'minecare-ai-vendor-sla', route: '/minecare-ai/vendor-sla', sequenceNo: 18, iconName: 'vendor-sla', active: true, submenu: [] },
      { name: 'Repair / Replace', title: 'Repair / Replace', permissionKey: 'minecare-ai-repair-replace', route: '/minecare-ai/repair-replace', sequenceNo: 19, iconName: 'repair-replace', active: true, submenu: [] },
      { name: 'Downtime Simulator', title: 'Downtime Simulator', permissionKey: 'minecare-ai-downtime-simulator', route: '/minecare-ai/downtime-simulator', sequenceNo: 20, iconName: 'downtime-simulator', active: true, submenu: [] },
      { name: 'Workforce Advisor', title: 'Workforce Advisor', permissionKey: 'minecare-ai-workforce', route: '/minecare-ai/workforce', sequenceNo: 21, iconName: 'workforce-advisor', active: true, submenu: [] },
      { name: 'Procurement Advisor', title: 'Procurement Advisor', permissionKey: 'minecare-ai-procurement-advisor', route: '/minecare-ai/procurement-advisor', sequenceNo: 22, iconName: 'procurement-advisor', active: true, submenu: [] },
      { name: 'Sensor ML', title: 'Sensor ML', permissionKey: 'minecare-ai-sensor-ml', route: '/minecare-ai/sensor-ml', sequenceNo: 23, iconName: 'sensor-ml', active: true, submenu: [] },
    ],
  },
  { title: 'Roles', permissionKey: 'roles', route: '/roles', sequenceNo: 4, iconName: 'roles' },
  { title: 'Settings', permissionKey: 'settings', route: '/settings', sequenceNo: 5, iconName: 'settings' },
  { title: 'Menu Management', permissionKey: 'menu-management', route: '/menus', sequenceNo: 6, iconName: 'menus' },
  {
    title: 'Employee Mgmt.',
    permissionKey: 'employee-mgmt',
    route: '/employeeMgmt',
    sequenceNo: 10,
    iconName: 'building-user',
    submenu: [
      {
        name: 'Employees',
        route: '/employees',
        iconName: 'users',
        sequenceNo: 11,
        title: 'Employees',
        permissionKey: 'employees'
      }
    ]
  },
  {
    iconName: 'server-cog',
    route: '/serverAgent',
    sequenceNo: 15,
    title: 'Server Agent',
    permissionKey: 'server-agent',
    active: true,
    submenu: [
      {
        name: 'Dashboard',
        displayTitle: 'Dashboard',
        route: '/serverAgent/dashboard',
        iconName: 'layout-dashboard',
        sequenceNo: 1,
        active: true,
        title: 'Dashboard',
        permissionKey: 'server-agent-dashboard'
      },
      {
        name: 'Connect',
        displayTitle: 'Connect',
        route: '/serverAgent/servers',
        iconName: 'plug-zap',
        sequenceNo: 2,
        active: true,
        title: 'Connect',
        permissionKey: 'server-agent-servers'
      },
      {
        name: 'Remediation',
        displayTitle: 'Remediation',
        route: '/serverAgent/remediation',
        iconName: 'remediation',
        sequenceNo: 4,
        active: true,
        title: 'Remediation',
        permissionKey: 'server-agent-remediation'
      },
      {
        name: 'Metrics',
        displayTitle: 'Metrics',
        route: '/serverAgent/metrics',
        iconName: 'bar-chart-3',
        sequenceNo: 3,
        active: true,
        title: 'Metrics',
        permissionKey: 'server-agent-metrics'
      },
      {
        name: 'Configuration',
        displayTitle: 'Configuration',
        route: '/serverAgent/configuration',
        iconName: 'settings',
        sequenceNo: 5,
        active: true,
        title: 'Configuration',
        permissionKey: 'server-agent-configuration'
      },
      {
        name: 'Logs Intelligence',
        displayTitle: 'Logs Intelligence',
        route: '/serverAgent/logs',
        iconName: 'clipboard-list',
        sequenceNo: 6,
        active: true,
        title: 'Logs Intelligence',
        permissionKey: 'server-agent-logs'
      },
      {
        name: 'Threat Scanner',
        displayTitle: 'Threat Scanner',
        route: '/serverAgent/file-scanner',
        iconName: 'shield-alert',
        sequenceNo: 7,
        active: true,
        title: 'Threat Scanner',
        permissionKey: 'server-agent-file-scanner'
      },
      {
        name: 'Disk Cleanup',
        displayTitle: 'Disk Cleanup',
        route: '/serverAgent/disk-cleanup',
        iconName: 'trash-2',
        sequenceNo: 8,
        active: true,
        title: 'Disk Cleanup',
        permissionKey: 'server-agent-disk-cleanup'
      },
      {
        name: 'Reports',
        displayTitle: 'Reports',
        route: '/serverAgent/reports',
        iconName: 'file-search',
        sequenceNo: 9,
        active: true,
        title: 'Reports',
        permissionKey: 'server-agent-reports'
      }
    ]
  },
  {
    iconName: 'rocket',
    route: '/deployment',
    sequenceNo: 16,
    title: 'Deployment Agent',
    permissionKey: 'deployment-agent',
    active: true,
    submenu: [
      {
        name: 'Dashboard',
        displayTitle: 'Dashboard',
        route: '/deployment/dashboard',
        iconName: 'layout-dashboard',
        sequenceNo: 1,
        active: true,
        title: 'Dashboard',
        permissionKey: 'deployment-agent-dashboard'
      },
      {
        name: 'Credentials',
        displayTitle: 'Credentials',
        route: '/deployment/credentials',
        iconName: 'key',
        sequenceNo: 2,
        active: true,
        title: 'Credentials',
        permissionKey: 'deployment-agent-credentials'
      },
      {
        name: 'Deployment Targets',
        displayTitle: 'Deployment Targets',
        route: '/deployment/targets',
        iconName: 'server',
        sequenceNo: 3,
        active: true,
        title: 'Deployment Targets',
        permissionKey: 'deployment-agent-targets'
      },
      {
        name: 'Applications',
        displayTitle: 'Applications',
        route: '/deployment/applications',
        iconName: 'layers',
        sequenceNo: 4,
        active: true,
        title: 'Applications',
        permissionKey: 'deployment-agent-applications'
      },
      {
        name: 'Deployments',
        displayTitle: 'Deployments',
        route: '/deployment/deployments',
        iconName: 'history',
        sequenceNo: 5,
        active: true,
        title: 'Deployments',
        permissionKey: 'deployment-agent-deployments'
      },
      {
        name: 'Version History',
        displayTitle: 'Version History',
        route: '/deployment/version-history',
        iconName: 'git-commit',
        sequenceNo: 6,
        active: true,
        title: 'Version History',
        permissionKey: 'deployment-agent-version-history'
      },
      {
        name: 'Reports & Analytics',
        displayTitle: 'Reports & Analytics',
        route: '/deployment/reports',
        iconName: 'bar-chart-2',
        sequenceNo: 7,
        active: true,
        title: 'Reports & Analytics',
        permissionKey: 'deployment-agent-reports'
      },
      {
        name: 'Notifications',
        displayTitle: 'Notifications',
        route: '/deployment/notifications',
        iconName: 'bell',
        sequenceNo: 7,
        active: true,
        title: 'Notifications',
        permissionKey: 'deployment-agent-notifications'
      }
    ]
  }
];

const getMenusForRole = (roleEnum: string) => {
  if (roleEnum === RoleEnum.SUPER_ADMIN) {
    return defaultMenus;
  }
  if (roleEnum === RoleEnum.ADMIN) {
    return defaultMenus.filter(m => ['dashboard', 'users', 'rcm', 'patients', 'settings', 'employee-mgmt', 'server-agent', 'deployment-agent', 'minecare-ai'].includes(m.permissionKey));
  }
  if (roleEnum === RoleEnum.MANAGER) {
    return defaultMenus.filter(m => ['dashboard', 'users', 'rcm', 'patients', 'employee-mgmt', 'server-agent', 'deployment-agent', 'minecare-ai'].includes(m.permissionKey));
  }
  if (roleEnum === RoleEnum.USER) {
    return defaultMenus.filter(m => ['dashboard', 'users', 'rcm', 'patients', 'settings'].includes(m.permissionKey));
  }
  return [];
};

export const seedMenus = async () => {
  try {
    // Clear existing menus to remove any old role-linked data
    await Menu.deleteMany({});

    for (const menu of defaultMenus) {
      await Menu.create({
        ...menu,
        active: true,
        created: new Date(),
        updated: new Date()
      });
    }
    logger.info('Menus seeded successfully');
  } catch (error) {
    logger.error('Error seeding menus:', error);
  }
};
