export const activityConfig: Record<string, any> = {
  settingsCreate: {
    context: 'SETTINGS',
    contextType: 'CREATE',
    desc: 'Settings created',
    key: '101'
  },
  settingsUpdate: {
    context: 'SETTINGS',
    contextType: 'UPDATE',
    desc: 'Settings updated',
    key: '102'
  },
  settingsDelete: {
    context: 'SETTINGS',
    contextType: 'DELETE',
    desc: 'Settings deleted',
    key: '103'
  },
  userCreate: {
    context: 'USER',
    contextType: 'CREATE',
    desc: 'User created',
    key: '151'
  },
  userUpdate: {
    context: 'USER',
    contextType: 'UPDATE',
    desc: 'User updated',
    key: '152'
  },
  userDelete: {
    context: 'USER',
    contextType: 'DELETE',
    desc: 'User deleted',
    key: '153'
  },
  patientCreate: {
    context: 'PATIENT',
    contextType: 'CREATE',
    desc: 'Patient created',
    key: '161'
  },
  patientUpdate: {
    context: 'PATIENT',
    contextType: 'UPDATE',
    desc: 'Patient updated',
    key: '162'
  },
  patientDelete: {
    context: 'PATIENT',
    contextType: 'DELETE',
    desc: 'Patient deleted',
    key: '163'
  },
  roleCreate: {
    context: 'ROLE',
    contextType: 'CREATE',
    desc: 'Role created',
    key: '201'
  },
  roleUpdate: {
    context: 'ROLE',
    contextType: 'UPDATE',
    desc: 'Role updated',
    key: '202'
  },
  roleDelete: {
    context: 'ROLE',
    contextType: 'DELETE',
    desc: 'Role deleted',
    key: '203'
  },
  menuCreate: {
    context: 'MENU',
    contextType: 'CREATE',
    desc: 'Menu created',
    key: '251'
  },
  menuUpdate: {
    context: 'MENU',
    contextType: 'UPDATE',
    desc: 'Menu updated',
    key: '252'
  },
  menuDelete: {
    context: 'MENU',
    contextType: 'DELETE',
    desc: 'Menu deleted',
    key: '253'
  },
  loginSuccess: {
    context: 'AUTH',
    contextType: 'LOGINSUCCESS',
    desc: 'Login successful',
    key: '301'
  },
  logoutSuccess: {
    context: 'AUTH',
    contextType: 'LOGOUT',
    desc: 'Logout successful',
    key: '302'
  },
  passwordChange: {
    context: 'AUTH',
    contextType: 'PASSWORDCHANGE',
    desc: 'Password changed',
    key: '303'
  }
};

export default {
  activityConfig
};
