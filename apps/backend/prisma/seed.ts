import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Check if database is already seeded
  const existingDepartments = await prisma.department.count();
  const existingUsers = await prisma.user.count();
  
  if (existingDepartments > 0 && existingUsers > 0) {
    console.log('Database is already seeded. Skipping seed process.');
    console.log(`Found ${existingDepartments} departments and ${existingUsers} users.`);
    return;
  }

  console.log('Starting database seed...');

  // Create departments
  const departments = await Promise.all([
    prisma.department.upsert({
      where: { name: 'فناوری اطلاعات' },
      update: {},
      create: {
        name: 'فناوری اطلاعات',
      },
    }),
    prisma.department.upsert({
      where: { name: 'مالی' },
      update: {},
      create: {
        name: 'مالی',
      },
    }),
    prisma.department.upsert({
      where: { name: 'منابع انسانی' },
      update: {},
      create: {
        name: 'منابع انسانی',
      },
    }),
  ]);

  console.log('Departments created:', departments.length);

  // Create buildings
  const buildings = await Promise.all([
    prisma.building.upsert({
      where: { name: 'ساختمان اصلی' },
      update: {},
      create: {
        name: 'ساختمان اصلی',
      },
    }),
    prisma.building.upsert({
      where: { name: 'ساختمان فرعی' },
      update: {},
      create: {
        name: 'ساختمان فرعی',
      },
    }),
  ]);

  console.log('Buildings created:', buildings.length);

  // Create floors
  const floors = await Promise.all([
    prisma.floor.upsert({
      where: { buildingId_name: { buildingId: buildings[0].id, name: 'طبقه همکف' } },
      update: {},
      create: {
        name: 'طبقه همکف',
        buildingId: buildings[0].id,
      },
    }),
    prisma.floor.upsert({
      where: { buildingId_name: { buildingId: buildings[0].id, name: 'طبقه اول' } },
      update: {},
      create: {
        name: 'طبقه اول',
        buildingId: buildings[0].id,
      },
    }),
  ]);

  console.log('Floors created:', floors.length);

  // Create rooms
  const rooms = await Promise.all([
    prisma.room.upsert({
      where: { buildingId_floorId_name: { buildingId: buildings[0].id, floorId: floors[0].id, name: 'اتاق 101' } },
      update: {},
      create: {
        name: 'اتاق 101',
        buildingId: buildings[0].id,
        floorId: floors[0].id,
      },
    }),
    prisma.room.upsert({
      where: { buildingId_floorId_name: { buildingId: buildings[0].id, floorId: floors[0].id, name: 'اتاق 102' } },
      update: {},
      create: {
        name: 'اتاق 102',
        buildingId: buildings[0].id,
        floorId: floors[0].id,
      },
    }),
  ]);

  console.log('Rooms created:', rooms.length);

  // Create admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@arzesh.com' },
    update: {},
    create: {
      email: 'admin@arzesh.com',
      password: hashedPassword,
      firstName: 'مدیر',
      lastName: 'سیستم',
      role: 'ADMIN',
      departmentId: departments[0].id,
    },
  });

  console.log('Admin user created:', adminUser.email);

  // Create regular users
  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: 'user1@arzesh.com' },
      update: {},
      create: {
        email: 'user1@arzesh.com',
        password: await bcrypt.hash('user123', 10),
        firstName: 'علی',
        lastName: 'احمدی',
        role: 'USER',
        departmentId: departments[1].id,
      },
    }),
    prisma.user.upsert({
      where: { email: 'user2@arzesh.com' },
      update: {},
      create: {
        email: 'user2@arzesh.com',
        password: await bcrypt.hash('user123', 10),
        firstName: 'فاطمه',
        lastName: 'محمدی',
        role: 'MANAGER',
        departmentId: departments[2].id,
      },
    }),
  ]);

  console.log('Users created:', users.length);

  // Create asset types
  const assetTypes = await Promise.all([
    prisma.assetType.upsert({
      where: { name: 'کامپیوتر' },
      update: {},
      create: {
        name: 'کامپیوتر',
        description: 'رایانه‌های شخصی و سرور',
      },
    }),
    prisma.assetType.upsert({
      where: { name: 'اثاثیه' },
      update: {},
      create: {
        name: 'اثاثیه',
        description: 'میز، صندلی، کمد و...',
      },
    }),
  ]);

  console.log('Asset types created:', assetTypes.length);

  // Create asset categories
  const assetCategories = await Promise.all([
    prisma.assetCategory.upsert({
      where: { name: 'سخت‌افزار' },
      update: {},
      create: {
        name: 'سخت‌افزار',
        description: 'تجهیزات سخت‌افزاری',
        codePrefix: 'HW',
      },
    }),
    prisma.assetCategory.upsert({
      where: { name: 'نرم‌افزار' },
      update: {},
      create: {
        name: 'نرم‌افزار',
        description: 'لایسنس‌های نرم‌افزاری',
        codePrefix: 'SW',
      },
    }),
  ]);

  console.log('Asset categories created:', assetCategories.length);

  // Create sample assets
  const assets = await Promise.all([
    prisma.asset.upsert({
      where: { barcode: 'HW001' },
      update: {},
      create: {
        name: 'لپ‌تاپ Dell Latitude',
        barcode: 'HW001',
        description: 'لپ‌تاپ Dell Latitude 5520 با پردازنده i7',
        typeId: assetTypes[0].id,
        categoryId: assetCategories[0].id,
        condition: 'NEW',
        availability: 'AVAILABLE',
        serialNumber: 'DL123456',
        purchaseDate: new Date('2024-01-15'),
        cost: 25000000,
        createdById: adminUser.id,
      },
    }),
    prisma.asset.upsert({
      where: { barcode: 'HW002' },
      update: {},
      create: {
        name: 'مانیتور Samsung',
        barcode: 'HW002',
        description: 'مانیتور Samsung 24 اینچ',
        typeId: assetTypes[0].id,
        categoryId: assetCategories[0].id,
        condition: 'USED_GOOD',
        availability: 'IN_USE',
        serialNumber: 'SM789012',
        purchaseDate: new Date('2023-06-10'),
        cost: 5000000,
        createdById: adminUser.id,
      },
    }),
    prisma.asset.upsert({
      where: { barcode: 'HW003' },
      update: {},
      create: {
        name: 'میز اداری',
        barcode: 'HW003',
        description: 'میز اداری چوبی',
        typeId: assetTypes[1].id,
        categoryId: assetCategories[0].id,
        condition: 'NEW',
        availability: 'AVAILABLE',
        purchaseDate: new Date('2024-03-20'),
        cost: 3000000,
        createdById: adminUser.id,
      },
    }),
  ]);

  console.log('Assets created:', assets.length);

  // Create asset assignments (only if they don't exist)
  const existingAssignment = await prisma.assetAssignment.findFirst({
    where: {
      assetId: assets[1].id,
      userId: users[0].id,
    },
  });

  let assignments = [];
  if (!existingAssignment) {
    assignments = await Promise.all([
      prisma.assetAssignment.create({
        data: {
          assetId: assets[1].id, // Monitor assigned to user
          userId: users[0].id,
          departmentId: departments[1].id,
          buildingId: buildings[0].id,
          floorId: floors[0].id,
          roomId: rooms[0].id,
          purpose: 'استفاده روزمره',
          assignedById: adminUser.id,
        },
      }),
    ]);
  } else {
    console.log('Asset assignments already exist, skipping...');
  }

  console.log('Asset assignments created:', assignments.length);

  console.log('Seed data creation completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
