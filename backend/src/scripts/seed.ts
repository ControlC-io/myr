import { PrismaClient } from '@prisma/client';

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

const main = async () => {
  try {
    await seedAuthSettings();
    await seedRoles();
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
};

main();
