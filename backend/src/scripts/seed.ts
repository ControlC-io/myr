import { PrismaClient, MemberRole } from '@prisma/client';

const prisma = new PrismaClient();

const seedAuthSettings = async () => {
  console.log('Seeding auth configuration settings...');

  const settings = [
    {
      settingKey: 'auth_email_password_enabled',
      isEnabled: true
    },
    {
      settingKey: 'auth_google_enabled',
      isEnabled: false,
      providerConfig: {
        clientId: '',
        clientSecret: '',
        note: 'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env to enable'
      }
    },
    {
      settingKey: 'auth_github_enabled',
      isEnabled: false,
      providerConfig: {
        clientId: '',
        clientSecret: '',
        note: 'Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in .env to enable'
      }
    },
    {
      settingKey: 'auth_assign_default_role',
      isEnabled: true,
      providerConfig: {
        roleName: 'Manager',
        note: 'Automatically assign this global role to new users on sign-up'
      }
    }
  ];

  for (const setting of settings) {
    const existing = await prisma.systemSettings.findUnique({
      where: { settingKey: setting.settingKey }
    });

    if (existing) {
      console.log(`  ✓ ${setting.settingKey} already exists`);
    } else {
      await prisma.systemSettings.create({
        data: setting
      });
      console.log(`  + Created ${setting.settingKey} (enabled: ${setting.isEnabled})`);
    }
  }

  console.log('\nAuth settings seeded successfully!');
};

const seedRoles = async () => {
  console.log('Seeding default RBAC roles...');

  const defaultRoles = [
    { name: 'Admin User', description: 'Full system access' },
    { name: 'Manager', description: 'Read and write access to core resources' },
  ];

  for (const role of defaultRoles) {
    const existing = await prisma.role.findUnique({
      where: { name: role.name },
    });

    if (existing) {
      console.log(`  ✓ Role "${role.name}" already exists`);
    } else {
      await prisma.role.create({
        data: role,
      });
      console.log(`  + Created role "${role.name}"`);
    }
  }

  console.log('Default roles seeded successfully!');
};

/**
 * Upserts an organization and returns it.
 */
const upsertOrg = async (name: string, slug: string, externalReferenceId?: string) =>
  prisma.organization.upsert({
    where: { slug },
    update: { externalReferenceId: externalReferenceId ?? null },
    create: { name, slug, externalReferenceId: externalReferenceId ?? null },
  });

/**
 * Upserts a member (user → org with role).
 */
const upsertMember = async (userId: string, organizationId: string, role: MemberRole) =>
  prisma.member.upsert({
    where: { userId_organizationId: { userId, organizationId } },
    update: { role },
    create: { userId, organizationId, role },
  });

const seedOrganizationsAndMembers = async () => {
  console.log('Seeding organizations and member matrix...');

  // ── Organizations ──────────────────────────────────────────────────────────
  const controlc  = await upsertOrg('ControlC',  'controlc',  '400007212');
  const acme      = await upsertOrg('Acme Corp',  'acme',      '400000037');
  const betacorp  = await upsertOrg('BetaCorp',   'betacorp');

  console.log(`  + Organizations: ControlC (${controlc.id}), Acme (${acme.id}), BetaCorp (${betacorp.id})`);

  // ── Test user (from .env) as OWNER of ControlC, ADMIN of Acme ─────────────
  const testUserEmail = process.env.TEST_USER_EMAIL;
  if (!testUserEmail) {
    console.warn('  ! TEST_USER_EMAIL not set; skipping test-user memberships.');
  } else {
    const testUser = await prisma.user.findUnique({ where: { email: testUserEmail } });
    if (!testUser) {
      console.warn(`  ! No user with email "${testUserEmail}"; skipping.`);
    } else {
      await upsertMember(testUser.id, controlc.id, MemberRole.OWNER);
      await upsertMember(testUser.id, acme.id, MemberRole.ADMIN);
      console.log(`  + ${testUserEmail}: OWNER of ControlC, ADMIN of Acme`);
    }
  }

  // ── Synthetic demo users with varied roles ─────────────────────────────────
  // These are lightweight users created only if they don't already exist so the
  // seed is safe to re-run.  Passwords are intentionally blank — they cannot log
  // in via email/password without a real hash; they exist solely to populate the
  // member table for UI/test purposes.
  const demoUsers: Array<{ email: string; name: string }> = [
    { email: 'manager.acme@demo.local',   name: 'Alice Manager' },
    { email: 'viewer.acme@demo.local',    name: 'Bob Viewer' },
    { email: 'manager.beta@demo.local',   name: 'Carol Beta' },
    { email: 'viewer.beta@demo.local',    name: 'Dave Beta' },
  ];

  const createdUsers: Record<string, string> = {};
  for (const { email, name } of demoUsers) {
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, name, emailVerified: false },
    });
    createdUsers[email] = user.id;
    console.log(`  + Demo user: ${email} (${user.id})`);
  }

  // ── Assign demo roles ──────────────────────────────────────────────────────
  await upsertMember(createdUsers['manager.acme@demo.local'],  acme.id,     MemberRole.MANAGER);
  await upsertMember(createdUsers['viewer.acme@demo.local'],   acme.id,     MemberRole.VIEWER);
  await upsertMember(createdUsers['manager.beta@demo.local'],  betacorp.id, MemberRole.MANAGER);
  await upsertMember(createdUsers['viewer.beta@demo.local'],   betacorp.id, MemberRole.VIEWER);
  // Cross-org: Carol is also a VIEWER in ControlC
  await upsertMember(createdUsers['manager.beta@demo.local'],  controlc.id, MemberRole.VIEWER);

  console.log('Organizations and member matrix seeded successfully!');
};

const main = async () => {
  try {
    await seedAuthSettings();
    await seedRoles();
    await seedOrganizationsAndMembers();
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
};

main();
