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
      "seva": {
        "type": "Edit",
        "actions": ["Add", "Update", "Delete", "View"]
      },
      "darshan": {
        "type": "Edit",
        "actions": ["Add", "Update", "Delete", "View"]
      },
      "accommodationRoomType": {
        "type": "Edit",
        "actions": ["Add", "Update", "Delete", "View"]
      },
      "prasadamItem": {
        "type": "Edit",
        "actions": ["Add", "Update", "Delete", "View"]
      },
      "donationFund": {
        "type": "Edit",
        "actions": ["Add", "Update", "Delete", "View"]
      },
      "facility": {
        "type": "Edit",
        "actions": ["Add", "Update", "Delete", "View"]
      },
      "announcement": {
        "type": "Edit",
        "actions": ["Add", "Update", "Delete", "View"]
      },
      "donor": {
        "type": "Edit",
        "actions": ["Add", "Update", "Delete", "View", "ExportToCsv"]
      },
      "property": {
        "type": "Edit",
        "actions": ["Add", "Update", "Delete", "View", "ExportToCsv"]
      },
      "asset": {
        "type": "Edit",
        "actions": ["Add", "Update", "Delete", "View", "ExportToCsv"]
      },
      "liability": {
        "type": "Edit",
        "actions": ["Add", "Update", "Delete", "View", "ExportToCsv"]
      },
      "expenseEvent": {
        "type": "Edit",
        "actions": ["Add", "Update", "Delete", "View"]
      },
      "expenseEntry": {
        "type": "Edit",
        "actions": ["Add", "Update", "Delete", "View", "ExportToCsv"]
      },
      "templeProfile": {
        "type": "Edit",
        "actions": ["Add", "Update", "Delete", "View"]
      },
      "language": {
        "type": "Edit",
        "actions": ["View", "Update"]
      },
      "pageContent": {
        "type": "Edit",
        "actions": ["View", "Update"]
      },
      "templeEvent": {
        "type": "Edit",
        "actions": ["Add", "Update", "Delete", "View"]
      },
      "donation": {
        "type": "Edit",
        "actions": ["View", "Update"]
      },
      "bookingLedger": {
        "type": "Edit",
        "actions": ["View", "Update"]
      },
      "nearbyPlace": {
        "type": "Edit",
        "actions": ["Add", "Update", "Delete", "View"]
      },
      "templeReconfigure": {
        "type": "Edit",
        "actions": ["View", "Update"]
      },
      "analytics": {
        "type": "View",
        "actions": ["View"]
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
