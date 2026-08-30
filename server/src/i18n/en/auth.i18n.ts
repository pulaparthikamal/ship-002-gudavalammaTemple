export const authI18n = {
  login: {
    success: 'Login successful',
    invalidCredentials: 'Username or password is incorrect',
    accountInactive: 'Your account is disabled. Please contact support',
  },
  register: {
    success: 'Registration successful',
    emailExists: 'Email is already registered',
    phoneExists: 'Phone number is already registered',
  },
  otp: {
    phoneNotFound: 'No account found with this phone number',
    sent: 'A verification code has been sent',
    tooSoon: 'Please wait before requesting another code',
    invalid: 'Invalid or expired code',
    expired: 'This code has expired. Please request a new one',
    tooManyAttempts: 'Too many incorrect attempts. Please request a new code',
    loginSuccess: 'Login successful',
  },
  token: {
    refreshSuccess: 'Token refreshed successfully',
    invalid: 'Invalid or expired token',
    missing: 'Authentication token is missing',
    loggedOut: 'Logged out successfully',
  },
  password: {
    changeSuccess: 'Password changed successfully',
    incorrectCurrent: 'Current password is incorrect',
  },
  unauthorized: 'Unauthorized access',
};
