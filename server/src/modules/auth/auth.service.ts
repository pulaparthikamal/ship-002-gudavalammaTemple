import { User } from '../user/user.model';
import { Role } from '../role/role.model';
import { Token } from '../token/token.model';
import { Settings } from '../settings/settings.model';
import { AppError } from '../../utils/error.util';
import { HTTP_STATUS } from '../../constants/httpStatus.constants';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/token.util';
import { t } from '../../i18n';
import { RoleEnum } from '../../constants/roles.constants';
import { JwtPayload } from 'jsonwebtoken';

export const authService = {
  async register(data: any, locale: string) {
    const existingUser = await User.findOne({ email: data.email });
    if (existingUser) {
      throw new AppError(t('auth.register.emailExists', {}, locale), HTTP_STATUS.CONFLICT);
    }

    let roleId = data.role;
    if (!roleId) {
      const defaultRole = await Role.findOne({ role: RoleEnum.USER });
      if (!defaultRole) {
        throw new AppError(t('common.server.internalError', {}, locale), HTTP_STATUS.INTERNAL_SERVER_ERROR);
      }
      roleId = defaultRole._id;
    }

    // Model pre-save hook handles hashing
    const user = await User.create({
      ...data,
      role: roleId,
      created: new Date(),
      updated: new Date(),
    });

    const userObj = user.toJSON();
    delete (userObj as any).password;
    delete (userObj as any).salt;
    return userObj;
  },

  async login(data: any, locale: string) {
    const user = await User.findOne({ email: data.email }).select('+password +salt').populate('role');
    if (!user || !user.password) {
      throw new AppError(t('auth.login.invalidCredentials', {}, locale), HTTP_STATUS.UNAUTHORIZED);
    }

    if (!user.active) {
      throw new AppError(t('auth.login.accountInactive', {}, locale), HTTP_STATUS.FORBIDDEN);
    }

    // Using instance method for authentication
    const isMatch = user.authenticate(data.password);
    if (!isMatch) {
      throw new AppError(t('auth.login.invalidCredentials', {}, locale), HTTP_STATUS.UNAUTHORIZED);
    }

    const payload = {
      _id: user._id,
      email: user.email,
      role: (user.role as any)?.role,
    };

    const sessionExpiry = await Settings.findOne({ key: 'SESSION_EXPIRY', active: true });
    let expiresIn: string | undefined = undefined;

    if (sessionExpiry && sessionExpiry.value) {
      const value = String(sessionExpiry.value).trim();
      if (value && !isNaN(Number(value))) {
        expiresIn = `${value}m`;
      }
    }

    const accessToken = signAccessToken(payload, expiresIn);
    const refreshToken = signRefreshToken(payload);

    await Token.create({
      user: user._id,
      accessToken,
      refreshToken,
      created: new Date(),
      updated: new Date(),
    });

    const userObj = user.toJSON();
    delete (userObj as any).password;
    delete (userObj as any).salt;

    return { user: userObj, accessToken, refreshToken };
  },

  async refreshToken(token: string, locale: string) {
    try {
      const decoded = verifyRefreshToken(token) as JwtPayload;
      const tokenDoc = await Token.findOne({ refreshToken: token, active: true }).populate({
        path: 'user',
        populate: { path: 'role' }
      });

      if (!tokenDoc || !tokenDoc.user) {
        throw new AppError(t('auth.token.invalid', {}, locale), HTTP_STATUS.UNAUTHORIZED);
      }

      const user: any = tokenDoc.user;
      if (!user.active) {
        throw new AppError(t('auth.token.invalid', {}, locale), HTTP_STATUS.UNAUTHORIZED);
      }

      const payload = {
        _id: user._id,
        email: user.email,
        role: user.role.role,
      };

      const sessionExpiry = await Settings.findOne({ key: 'SESSION_EXPIRY', active: true });
      let expiresIn: string | undefined = undefined;

      if (sessionExpiry && sessionExpiry.value) {
        const value = String(sessionExpiry.value).trim();
        if (value && !isNaN(Number(value))) {
          expiresIn = `${value}m`;
        }
      }

      const accessToken = signAccessToken(payload, expiresIn);

      tokenDoc.accessToken = accessToken;
      tokenDoc.updated = new Date();
      await tokenDoc.save();

      return { accessToken };
    } catch (error) {
      throw new AppError(t('auth.token.invalid', {}, locale), HTTP_STATUS.UNAUTHORIZED);
    }
  },

  async logout(accessToken: string) {
    await Token.findOneAndDelete({ accessToken });
    return true;
  },

  async changePassword(userId: string, data: any, locale: string) {
    const user = await User.findById(userId).select('+password +salt');
    if (!user || !user.password) {
      throw new AppError(t('user.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    const isMatch = user.authenticate(data.currentPassword);
    if (!isMatch) {
      throw new AppError(t('auth.password.incorrectCurrent', {}, locale), HTTP_STATUS.BAD_REQUEST);
    }

    user.password = data.newPassword; // Model pre-save hook handles hashing
    user.updated = new Date();
    await user.save();

    return true;
  },

  async getMe(userId: string, locale: string) {
    const user = await User.findById(userId).populate('role');
    if (!user || !user.active) {
      throw new AppError(t('user.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }
    return user;
  },
};
