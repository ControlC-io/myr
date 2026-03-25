import { betterAuth } from 'better-auth';
import { createAuthMiddleware } from 'better-auth/api';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { twoFactor } from 'better-auth/plugins';
import { emailOTP } from 'better-auth/plugins/email-otp';
import prisma from './prisma';
import { createAuditLog } from '../middleware/auditLog';
import { sendOtp } from './emailService';

const requiredEnvVars = ['BETTER_AUTH_SECRET', 'JWT_SECRET', 'DATABASE_URL'];
for (const v of requiredEnvVars) {
  if (!process.env[v]) throw new Error(`Missing required env var: ${v}`);
}

const trustedOriginsEnv = process.env.TRUSTED_ORIGINS;
const trustedOrigins = [
  process.env.BETTER_AUTH_URL || 'http://localhost:3000',
  ...(trustedOriginsEnv
    ? trustedOriginsEnv.split(',').map((origin) => origin.trim()).filter(Boolean)
    : []),
];

/**
 * Better Auth configuration with email and password authentication.
 * Configured with Prisma adapter for PostgreSQL database.
 * Includes Two-Factor Authentication (TOTP) plugin for enhanced security.
 */
export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql'
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true
  },
  appName: 'DMZ Secure App',
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
  trustedOrigins,
  advanced: {
    cookiePrefix: 'dmz_auth'
  },
  plugins: [
    twoFactor({
      issuer: 'DMZ Secure App',
      totpOptions: {
        period: 30
      }
    }),
    emailOTP({
      expiresIn: 600, // 10 minutes
      disableSignUp: true, // only existing accounts can use passwordless login
      sendVerificationOTP: async ({ email, otp }) => {
        await sendOtp(email, otp, 10);
      },
    }),
  ],
  hooks: {
    // Single after-hook function that runs after every auth endpoint.
    // The path is checked inside to decide which action to log.
    after: createAuthMiddleware(async (ctx) => {
      try {
        const path = ctx.path;

        if (path === '/sign-in/email') {
          const session = ctx.context.newSession;
          if (session?.user) {
            await createAuditLog('SIGN_IN', session.user.id, {
              email: session.user.email,
              sessionId: session.session?.id ?? null
            });
          }
        } else if (path === '/sign-up/email') {
          const session = ctx.context.newSession;
          if (session?.user) {
            await createAuditLog('SIGN_UP', session.user.id, {
              email: session.user.email,
              name: session.user.name ?? null
            });

            // Optional: assign default global role
            const config = await loadAuthConfig();
            if (config.assignDefaultRoleEnabled) {
              const defaultRole = await prisma.role.findUnique({
                where: { name: config.defaultRoleName }
              });

              if (defaultRole) {
                // Ensure the UserRole junction exists (idempotent create)
                await prisma.userRole.upsert({
                  where: {
                    userId_roleId: {
                      userId: session.user.id,
                      roleId: defaultRole.id
                    }
                  },
                  update: {}, // No change if already exists
                  create: {
                    userId: session.user.id,
                    roleId: defaultRole.id
                  }
                }).catch(err => {
                  console.error('Error assigning default role during sign-up:', err);
                });
              }
            }
          }
        } else if (path === '/sign-out') {
          const session = ctx.context.session;
          if (session?.user) {
            await createAuditLog('SIGN_OUT', session.user.id, {
              email: session.user.email
            });
          }
        }
      } catch (err) {
        console.error('Audit log hook error:', err);
      }
    })
  }
});

/**
 * Load dynamic authentication configuration from the database.
 * This function queries SystemSettings for auth provider flags.
 */
export const loadAuthConfig = async () => {
  try {
    const authSettings = await prisma.systemSettings.findMany({
      where: {
        settingKey: {
          startsWith: 'auth_'
        }
      }
    });

    const config = {
      emailPasswordEnabled: authSettings.find(s => s.settingKey === 'auth_email_password_enabled')?.isEnabled ?? true,
      googleEnabled: authSettings.find(s => s.settingKey === 'auth_google_enabled')?.isEnabled ?? false,
      githubEnabled: authSettings.find(s => s.settingKey === 'auth_github_enabled')?.isEnabled ?? false,
      assignDefaultRoleEnabled: authSettings.find(s => s.settingKey === 'auth_assign_default_role')?.isEnabled ?? false,
      defaultRoleName: (authSettings.find(s => s.settingKey === 'auth_assign_default_role')?.providerConfig as any)?.roleName ?? 'Manager'
    };

    console.log('Auth configuration loaded:', config);
    return config;
  } catch (error) {
    console.error('Error loading auth configuration:', error);
    return {
      emailPasswordEnabled: true,
      googleEnabled: false,
      githubEnabled: false,
      assignDefaultRoleEnabled: false,
      defaultRoleName: 'Manager'
    };
  }
};
