import mongoose from 'mongoose';
import { User } from '../../modules/user/user.model';
import { Role } from '../../modules/role/role.model';
import { Menu } from '../../modules/menu/menu.model';
import { Patient } from '../../modules/rcm/patient/patient.model';
import { Claim } from '../../modules/rcm/claim/claim.model';
import { ClaimRejection } from '../../modules/rcm/claim-rejection/claim-rejection.model';
import { logger } from '../../utils/logger.util';

export const migrateSchemaV1 = async () => {
  try {
    logger.info('Starting schema migration V1...');

    // Update Users
    const userResult = await User.updateMany(
      { 
        $or: [
          { active: { $exists: false } },
          { created: { $exists: false } },
          { updated: { $exists: false } }
        ] 
      },
      { 
        $set: { 
          active: true,
          created: new Date(),
          updated: new Date()
        } 
      }
    );
    logger.info(`Updated ${userResult.modifiedCount} users.`);

    // Update Roles
    const roleResult = await Role.updateMany(
      { 
        $or: [
          { active: { $exists: false } },
          { created: { $exists: false } },
          { updated: { $exists: false } }
        ] 
      },
      { 
        $set: { 
          active: true,
          created: new Date(),
          updated: new Date()
        } 
      }
    );
    logger.info(`Updated ${roleResult.modifiedCount} roles.`);

    // Update Menus
    const menuResult = await Menu.updateMany(
      { 
        $or: [
          { active: { $exists: false } },
          { created: { $exists: false } },
          { updated: { $exists: false } }
        ] 
      },
      { 
        $set: { 
          active: true,
          created: new Date(),
          updated: new Date()
        } 
      }
    );
    logger.info(`Updated ${menuResult.modifiedCount} menus.`);

    // Update Patients
    const patientResult = await Patient.updateMany(
      {
        $or: [
          { active: { $exists: false } },
          { created: { $exists: false } },
          { updated: { $exists: false } }
        ]
      },
      {
        $set: {
          active: true,
          created: new Date(),
          updated: new Date()
        }
      }
    );
    logger.info(`Updated ${patientResult.modifiedCount} patients.`);

    const claimVersionResult = await Claim.updateMany(
      {
        $or: [
          { version: { $exists: false } },
          { resubmissionCount: { $exists: false } }
        ]
      },
      {
        $set: {
          version: 1,
          resubmissionCount: 0,
          updated: new Date()
        }
      }
    );
    await Claim.syncIndexes();
    await ClaimRejection.syncIndexes();
    logger.info(`Updated ${claimVersionResult.modifiedCount} claims with resubmission metadata.`);

    logger.info('Schema migration V1 completed successfully.');
  } catch (error) {
    logger.error('Error during schema migration V1:', error);
  }
};
