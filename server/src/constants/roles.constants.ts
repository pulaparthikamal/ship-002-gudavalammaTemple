export enum RoleEnum {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  USER = 'USER',
}

export const SEED_ROLES = [
  {
    role: RoleEnum.SUPER_ADMIN,
    roleType: 'Super Admin',
    status: 'Active',
    active: true,
    permissions: {
      "users": {
        "type": "Edit",
        "actions": ["Add", "Update", "Delete", "View", "BulkUpload", "ExportToCsv"]
      },
      "patients": {
        "type": "Edit",
        "actions": ["Add", "Update", "Delete", "View", "BulkUpload", "ExportToCsv"]
      },
      "rcm": {
        "type": "View",
        "actions": ["View"]
      },
      "insurance-policies": {
        "type": "Edit",
        "actions": ["Add", "Update", "Delete", "View", "BulkUpload", "ExportToCsv"]
      },
      "eligibility-verifications": {
        "type": "Edit",
        "actions": ["Add", "Update", "Delete", "View", "BulkUpload", "ExportToCsv"]
      },
      "appointments": {
        "type": "Edit",
        "actions": ["Add", "Update", "Delete", "View", "BulkUpload", "ExportToCsv"]
      },
      "referrals": {
        "type": "Edit",
        "actions": ["Add", "Update", "Delete", "View", "BulkUpload", "ExportToCsv"]
      },
      "prior-authorizations": {
        "type": "Edit",
        "actions": ["Add", "Update", "Delete", "View", "BulkUpload", "ExportToCsv"]
      },
      "providers": {
        "type": "Edit",
        "actions": ["Add", "Update", "Delete", "View", "BulkUpload", "ExportToCsv"]
      },
      "facilities": {
        "type": "Edit",
        "actions": ["Add", "Update", "Delete", "View", "BulkUpload", "ExportToCsv"]
      },
      "payers": {
        "type": "Edit",
        "actions": ["Add", "Update", "Delete", "View", "BulkUpload", "ExportToCsv"]
      },
      "encounters": {
        "type": "Edit",
        "actions": ["Add", "Update", "Delete", "View", "BulkUpload", "ExportToCsv"]
      },
      "charge-masters": {
        "type": "Edit",
        "actions": ["Add", "Update", "Delete", "View", "BulkUpload", "ExportToCsv"]
      },
      "fee-schedules": {
        "type": "Edit",
        "actions": ["Add", "Update", "Delete", "View", "BulkUpload", "ExportToCsv"]
      },
      "procedure-codes": {
        "type": "Edit",
        "actions": ["Add", "Update", "Delete", "View", "BulkUpload", "ExportToCsv"]
      },
      "charges": {
        "type": "Edit",
        "actions": ["Add", "Update", "Delete", "View", "BulkUpload", "ExportToCsv"]
      },
      "coding-reviews": {
        "type": "Edit",
        "actions": ["Add", "Update", "Delete", "View", "BulkUpload", "ExportToCsv"]
      },
      "claims": {
        "type": "Edit",
        "actions": ["Add", "Update", "Delete", "View", "BulkUpload", "ExportToCsv"]
      },
      "claim-predictions": {
        "type": "Edit",
        "actions": ["Add", "Update", "Delete", "View", "BulkUpload", "ExportToCsv"]
      },
      "claim-ai-reviews": {
        "type": "Edit",
        "actions": ["Add", "Update", "Delete", "View", "BulkUpload", "ExportToCsv"]
      },
      "claim-submissions": {
        "type": "Edit",
        "actions": ["Add", "Update", "Delete", "View", "BulkUpload", "ExportToCsv"]
      },
      "claim-trackings": {
        "type": "Edit",
        "actions": ["Add", "Update", "Delete", "View", "BulkUpload", "ExportToCsv"]
      },
      "payment-postings": {
        "type": "Edit",
        "actions": ["Add", "Update", "Delete", "View", "BulkUpload", "ExportToCsv"]
      },
      "era-eob-processings": {
        "type": "Edit",
        "actions": ["Add", "Update", "Delete", "View", "BulkUpload", "ExportToCsv"]
      },
      "adjustments": {
        "type": "Edit",
        "actions": ["Add", "Update", "Delete", "View", "BulkUpload", "ExportToCsv"]
      },
      "ar-work-items": {
        "type": "Edit",
        "actions": ["Add", "Update", "Delete", "View", "BulkUpload", "ExportToCsv"]
      },
      "denials": {
        "type": "Edit",
        "actions": ["Add", "Update", "Delete", "View", "BulkUpload", "ExportToCsv"]
      },
      "appeals": {
        "type": "Edit",
        "actions": ["Add", "Update", "Delete", "View", "BulkUpload", "ExportToCsv"]
      },
      "corrected-claims": {
        "type": "Edit",
        "actions": ["Add", "Update", "Delete", "View", "BulkUpload", "ExportToCsv"]
      },
      "coverage-rules": {
        "type": "Edit",
        "actions": ["Add", "Update", "Delete", "View", "BulkUpload", "ExportToCsv"]
      },
      "patient-billings": {
        "type": "Edit",
        "actions": ["Add", "Update", "Delete", "View", "BulkUpload", "ExportToCsv"]
      },
      "patient-payments": {
        "type": "Edit",
        "actions": ["Add", "Update", "Delete", "View", "BulkUpload", "ExportToCsv"]
      },
      "refunds": {
        "type": "Edit",
        "actions": ["Add", "Update", "Delete", "View", "BulkUpload", "ExportToCsv"]
      },
      "collections": {
        "type": "Edit",
        "actions": ["Add", "Update", "Delete", "View", "BulkUpload", "ExportToCsv"]
      },
      "documents": {
        "type": "Edit",
        "actions": ["Add", "Update", "Delete", "View", "BulkUpload", "ExportToCsv"]
      },
      "tasks": {
        "type": "Edit",
        "actions": ["Add", "Update", "Delete", "View", "BulkUpload", "ExportToCsv"]
      },
      "audit-logs": {
        "type": "Edit",
        "actions": ["Add", "Update", "Delete", "View", "BulkUpload", "ExportToCsv"]
      },
      "reports": {
        "type": "Edit",
        "actions": ["Add", "Update", "Delete", "View", "BulkUpload", "ExportToCsv"]
      },
      "roles": {
        "type": "Edit",
        "actions": ["Add", "Update", "Delete", "View", "BulkUpload", "ExportToCsv"]
      },
      "menus": {
        "type": "Edit",
        "actions": ["Add", "Update", "Delete", "View"]
      },
      "settings": {
        "type": "Edit",
        "actions": ["Add", "Update", "Delete", "View"]
      },
      "tokens": {
        "type": "Edit",
        "actions": ["View", "Delete", "Update"]
      },
      "dashboard": {
        "type": "View",
        "actions": ["View"]
      },
      "menu-management": {
        "type": "Edit",
        "actions": ["Add", "Update", "Delete", "View"]
      },
      "employee-mgmt": {
        "type": "View",
        "actions": ["View"]
      },
      "employees": {
        "type": "Edit",
        "actions": ["Add", "Update", "Delete", "View"]
      },
      "activities": {
        "type": "View",
        "actions": ["View"]
      },
      "mediaCategories": {
        "type": "Edit",
        "actions": ["Add", "Update", "Delete", "View", "BulkUpload", "ExportToCsv"]
      }
    }
  },
  {
    role: RoleEnum.ADMIN,
    roleType: 'Admin',
    status: 'Active',
    active: true,
    permissions: {}
  },
  {
    role: RoleEnum.MANAGER,
    roleType: 'Manager',
    status: 'Active',
    active: true,
    permissions: {}
  },
  {
    role: RoleEnum.USER,
    roleType: 'User',
    status: 'Active',
    active: true,
    permissions: {
      "users": {
        "type": "View",
        "actions": ["View"]
      },
      "patients": {
        "type": "View",
        "actions": ["View"]
      },
      "rcm": {
        "type": "View",
        "actions": ["View"]
      },
      "insurance-policies": {
        "type": "View",
        "actions": ["View"]
      },
      "eligibility-verifications": {
        "type": "View",
        "actions": ["View"]
      },
      "appointments": {
        "type": "View",
        "actions": ["View"]
      },
      "referrals": {
        "type": "View",
        "actions": ["View"]
      },
      "prior-authorizations": {
        "type": "View",
        "actions": ["View"]
      },
      "providers": {
        "type": "View",
        "actions": ["View"]
      },
      "facilities": {
        "type": "View",
        "actions": ["View"]
      },
      "payers": {
        "type": "View",
        "actions": ["View"]
      },
      "encounters": {
        "type": "View",
        "actions": ["View"]
      },
      "charge-masters": {
        "type": "View",
        "actions": ["View"]
      },
      "fee-schedules": {
        "type": "View",
        "actions": ["View"]
      },
      "procedure-codes": {
        "type": "View",
        "actions": ["View"]
      },
      "charges": {
        "type": "View",
        "actions": ["View"]
      },
      "coding-reviews": {
        "type": "View",
        "actions": ["View"]
      },
      "claims": {
        "type": "View",
        "actions": ["View"]
      },
      "claim-predictions": {
        "type": "View",
        "actions": ["View"]
      },
      "claim-ai-reviews": {
        "type": "View",
        "actions": ["View"]
      },
      "claim-submissions": {
        "type": "View",
        "actions": ["View"]
      },
      "claim-trackings": {
        "type": "View",
        "actions": ["View"]
      },
      "payment-postings": {
        "type": "View",
        "actions": ["View"]
      },
      "era-eob-processings": {
        "type": "View",
        "actions": ["View"]
      },
      "adjustments": {
        "type": "View",
        "actions": ["View"]
      },
      "ar-work-items": {
        "type": "View",
        "actions": ["View"]
      },
      "denials": {
        "type": "View",
        "actions": ["View"]
      },
      "appeals": {
        "type": "View",
        "actions": ["View"]
      },
      "corrected-claims": {
        "type": "View",
        "actions": ["View"]
      },
      "coverage-rules": {
        "type": "View",
        "actions": ["View"]
      },
      "patient-billings": {
        "type": "View",
        "actions": ["View"]
      },
      "patient-payments": {
        "type": "View",
        "actions": ["View"]
      },
      "refunds": {
        "type": "View",
        "actions": ["View"]
      },
      "collections": {
        "type": "View",
        "actions": ["View"]
      },
      "documents": {
        "type": "View",
        "actions": ["View"]
      },
      "tasks": {
        "type": "View",
        "actions": ["View"]
      },
      "audit-logs": {
        "type": "View",
        "actions": ["View"]
      },
      "reports": {
        "type": "View",
        "actions": ["View"]
      },
      "menus": {
        "type": "View",
        "actions": ["View"]
      },
      "settings": {
        "type": "View",
        "actions": ["View"]
      },
      "dashboard": {
        "type": "View",
        "actions": ["View"]
      }
    }
  },
];
