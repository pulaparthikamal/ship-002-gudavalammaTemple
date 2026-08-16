import { User, IUser } from '../user/user.model';
import { Role } from '../role/role.model';
import { Token } from '../token/token.model';
import { Settings } from '../settings/settings.model';
import { AppError } from '../../utils/error.util';
import { HTTP_STATUS } from '../../constants/httpStatus.constants';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/token.util';
import { t } from '../../i18n';
import { RoleEnum } from '../../constants/roles.constants';
import { JwtPayload } from 'jsonwebtoken';
import { generateOtp, hashOtp, OTP_MAX_ATTEMPTS, OTP_RESEND_COOLDOWN_MS, OTP_TTL_MS } from '../../utils/otp.util';
import { sendMail } from '../../utils/mail.util';
import { sendOtpWhatsApp } from '../../services/notification/whatsapp.service';
import { logger } from '../../utils/logger.util';
import { TempleProfile } from '../templeProfile/templeProfile.model';

/** Shared by password login and OTP-verify login — issues the same JWT
 * access/refresh token pair and persists the same Token record either way. */
async function issueSession(user: IUser & { _id: unknown }) {
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

  const userObj = (user as any).toJSON();
  delete (userObj as any).password;
  delete (userObj as any).salt;

  return { user: userObj, accessToken, refreshToken };
}

export const authService = {
  async register(data: any, locale: string) {
    const existingUser = await User.findOne({ email: data.email });
    if (existingUser) {
      throw new AppError(t('auth.register.emailExists', {}, locale), HTTP_STATUS.CONFLICT);
    }

    if (data.phone) {
      const existingPhone = await User.findOne({ phone: data.phone });
      if (existingPhone) {
        throw new AppError(t('auth.register.phoneExists', {}, locale), HTTP_STATUS.CONFLICT);
      }
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
    const identifierQuery = data.email ? { email: data.email } : { phone: data.phone };
    const user = await User.findOne(identifierQuery).select('+password +salt').populate('role');
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

    return issueSession(user);
  },

  /**
   * Generates a 6-digit OTP for an existing devotee account (identified by
   * phone — this is a login flow, not registration), hashes+stores it, and
   * delivers it via every channel the account has: WhatsApp (best-effort —
   * only actually carries the code once a real Meta "Authentication"
   * template is approved, see whatsapp.service.ts) and email (always
   * attempted, since email is required at registration and already works
   * today via the configured SMTP). Never reveals whether a phone number
   * exists via response shape/timing beyond the one clear error below —
   * still throws for "not found" since a login flow inherently confirms
   * account existence anyway once you reach password-entry.
   */
  async requestOtp(phone: string, locale: string) {
    const user = await User.findOne({ phone });
    if (!user) {
      throw new AppError(t('auth.otp.phoneNotFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    if (!user.active) {
      throw new AppError(t('auth.login.accountInactive', {}, locale), HTTP_STATUS.FORBIDDEN);
    }

    if (user.otpExpires && user.otpExpires.getTime() - OTP_TTL_MS + OTP_RESEND_COOLDOWN_MS > Date.now()) {
      throw new AppError(t('auth.otp.tooSoon', {}, locale), HTTP_STATUS.TOO_MANY_REQUESTS);
    }

    const code = generateOtp();
    user.otp = hashOtp(code);
    user.otpExpires = new Date(Date.now() + OTP_TTL_MS);
    user.otpAttempts = 0;
    await user.save();

    const profile = await TempleProfile.findOne();
    const templeName = profile?.templeName ?? 'the temple';
    const results = await Promise.allSettled([
      sendMail({
        to: user.email,
        subject: `Your login code: ${code}`,
        html: `<div style="font-family: sans-serif;"><p>Your one-time login code for ${templeName} is:</p><h2 style="letter-spacing: 4px;">${code}</h2><p>This code expires in 5 minutes.</p></div>`,
        text: `Your one-time login code is ${code}. It expires in 5 minutes.`,
      }),
      sendOtpWhatsApp(phone, code),
    ]);

    const emailFailed = results[0].status === 'rejected';
    const whatsappSent = results[1].status === 'fulfilled' && results[1].value === true;
    if (emailFailed) {
      logger.warn(`[auth.otp] Failed to email OTP to ${user.email}: ${(results[0] as PromiseRejectedResult).reason}`);
    }
    if (results[1].status === 'rejected') {
      logger.warn(`[auth.otp] Failed to WhatsApp OTP to ${phone}: ${(results[1] as PromiseRejectedResult).reason}`);
    }

    return {
      phone,
      expiresInSeconds: OTP_TTL_MS / 1000,
      deliveredVia: {
        email: !emailFailed,
        whatsapp: whatsappSent,
      },
    };
  },

  async verifyOtp(phone: string, code: string, locale: string) {
    const user = await User.findOne({ phone }).populate('role');
    if (!user || !user.otp || !user.otpExpires) {
      throw new AppError(t('auth.otp.invalid', {}, locale), HTTP_STATUS.UNAUTHORIZED);
    }

    if (!user.active) {
      throw new AppError(t('auth.login.accountInactive', {}, locale), HTTP_STATUS.FORBIDDEN);
    }

    if (user.otpExpires.getTime() < Date.now()) {
      throw new AppError(t('auth.otp.expired', {}, locale), HTTP_STATUS.UNAUTHORIZED);
    }

    if ((user.otpAttempts ?? 0) >= OTP_MAX_ATTEMPTS) {
      throw new AppError(t('auth.otp.tooManyAttempts', {}, locale), HTTP_STATUS.TOO_MANY_REQUESTS);
    }

    const isMatch = user.otp === hashOtp(code);
    if (!isMatch) {
      user.otpAttempts = (user.otpAttempts ?? 0) + 1;
      await user.save();
      throw new AppError(t('auth.otp.invalid', {}, locale), HTTP_STATUS.UNAUTHORIZED);
    }

    user.otp = undefined;
    user.otpExpires = undefined;
    user.otpAttempts = 0;
    await user.save();

    return issueSession(user);
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
