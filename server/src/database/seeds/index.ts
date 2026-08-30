import mongoose from 'mongoose';
import { envConfig } from '../../config/env.config';
import { llmConfig } from '../../config/llm.config';
import { Role } from '../../modules/role/role.model';
import { Settings } from '../../modules/settings/settings.model';
import { SEED_ROLES } from '../../constants/roles.constants';
import { seedMenus } from './menu.seed';
import { logger } from '../../utils/logger.util';
import { seedSevaCatalog } from '../../modules/seva/seva.service';
import { seedDarshanQuotas } from '../../modules/darshan/darshan.service';
import { languageService } from '../../modules/language/language.service';
import { navTabService } from '../../modules/navTab/navTab.service';

/**
 * Upsert roles by `role` enum value so re-running the seed never orphans
 * existing Users' role references (no deleteMany + recreate here).
 */
const seedRoles = async (): Promise<number> => {
  let count = 0;
  for (const entry of SEED_ROLES) {
    await Role.findOneAndUpdate(
      { role: entry.role },
      { $set: entry },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    count += 1;
  }
  return count;
};

/**
 * Ensure the two LLM-related Settings rows exist so provider/model are
 * viewable + editable through the generic Settings CRUD. Upsert by `key`
 * so re-running the seed never duplicates them.
 */
const seedLlmSettings = async (): Promise<number> => {
  const defaults = [
    {
      key: 'llm.provider',
      group: 'llm',
      value: llmConfig.provider,
      label: 'LLM Provider',
      isEditable: true,
    },
    {
      key: 'llm.model',
      group: 'llm',
      value: llmConfig.model,
      label: 'LLM Model',
      isEditable: true,
    },
  ];

  let count = 0;
  for (const setting of defaults) {
    await Settings.findOneAndUpdate(
      { key: setting.key },
      { $setOnInsert: setting },
      { upsert: true, new: true }
    );
    count += 1;
  }
  return count;
};

const run = async () => {
  try {
    await mongoose.connect(envConfig.mongoUri, {
      maxPoolSize: envConfig.mongoMaxPoolSize,
    });
    logger.info('Seed script connected to MongoDB');

    const rolesCount = await seedRoles();

    // seedMenus() does its own deleteMany + create, which is safe: nothing
    // in the codebase references Menu documents by _id outside the menu
    // module itself.
    await seedMenus();
    const menusCount = await mongoose.connection.collection('menus').countDocuments();

    const settingsCount = await seedLlmSettings();
    await seedSevaCatalog();
    await seedDarshanQuotas();
    const languagesCount = await languageService.seedLanguages();
    const navTabsCount = await navTabService.seedNavTabs();

    logger.info(
      `Seed complete: ${rolesCount} roles upserted, ${menusCount} menus present, ${settingsCount} llm settings upserted, seva catalog + darshan quotas seeded, ${languagesCount} languages upserted, ${navTabsCount} nav tabs upserted.`
    );

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    logger.error('Seed script failed:', error);
    try {
      await mongoose.connection.close();
    } catch {
      // ignore close errors during failure path
    }
    process.exit(1);
  }
};

run();
