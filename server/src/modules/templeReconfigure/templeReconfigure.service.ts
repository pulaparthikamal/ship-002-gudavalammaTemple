import { SevaCatalog } from '../seva/seva.model';
import { sevaService } from '../seva/seva.service';
import { DarshanQuota } from '../darshan/darshan.model';
import { darshanService } from '../darshan/darshan.service';
import { AccommodationRoomType } from '../accommodation/accommodation.model';
import { accommodationService } from '../accommodation/accommodation.service';
import { PrasadamItem } from '../prasadam/prasadam.model';
import { prasadamService } from '../prasadam/prasadam.service';
import { DonationFund } from '../donation/donationFund.model';
import { donationService } from '../donation/donation.service';
import { Facility } from '../facility/facility.model';
import { facilityService } from '../facility/facility.service';
import { NearbyPlace } from '../nearbyPlace/nearbyPlace.model';
import { TempleEvent } from '../templeEvent/templeEvent.model';
import { AppError } from '../../utils/error.util';
import { HTTP_STATUS } from '../../constants/httpStatus.constants';
import { t } from '../../i18n';

export type ReconfigureCatalogKey =
  | 'seva'
  | 'darshan'
  | 'accommodation'
  | 'prasadam'
  | 'donationFund'
  | 'facility'
  | 'nearbyPlace'
  | 'templeEvent';

interface CatalogEntry {
  label: string;
  model: { countDocuments: (filter?: Record<string, unknown>) => Promise<number>; deleteMany: (filter: Record<string, unknown>) => Promise<unknown> };
  reseed?: () => Promise<unknown>;
  supportsDefaults: boolean;
}

const CATALOG_REGISTRY: Record<ReconfigureCatalogKey, CatalogEntry> = {
  seva: { label: 'Seva Catalog', model: SevaCatalog, reseed: () => sevaService.listActive(), supportsDefaults: true },
  darshan: { label: 'Darshan Quotas', model: DarshanQuota, reseed: () => darshanService.listActive(), supportsDefaults: true },
  accommodation: {
    label: 'Accommodation Room Types',
    model: AccommodationRoomType,
    reseed: () => accommodationService.listRoomTypes(),
    supportsDefaults: true,
  },
  prasadam: { label: 'Prasadam Items', model: PrasadamItem, reseed: () => prasadamService.listItems(), supportsDefaults: true },
  donationFund: { label: 'Donation Funds', model: DonationFund, reseed: () => donationService.listFunds(), supportsDefaults: true },
  facility: { label: 'Facilities', model: Facility, reseed: () => facilityService.list(), supportsDefaults: true },
  nearbyPlace: { label: 'Nearby Places', model: NearbyPlace, supportsDefaults: false },
  templeEvent: { label: 'Temple Events', model: TempleEvent, supportsDefaults: false },
};

export const templeReconfigureService = {
  async listCatalogs() {
    const entries = Object.entries(CATALOG_REGISTRY) as Array<[ReconfigureCatalogKey, CatalogEntry]>;
    return Promise.all(
      entries.map(async ([key, entry]) => ({
        key,
        label: entry.label,
        count: await entry.model.countDocuments({}),
        supportsDefaults: entry.supportsDefaults,
      }))
    );
  },

  async resetCatalog(catalog: ReconfigureCatalogKey, mode: 'empty' | 'defaults', locale: string) {
    const entry = CATALOG_REGISTRY[catalog];
    if (!entry) {
      throw new AppError(t('templeReconfigure.unknownCatalog', {}, locale), HTTP_STATUS.BAD_REQUEST);
    }

    const removedCount = await entry.model.countDocuments({});
    await entry.model.deleteMany({});

    let currentCount = 0;
    if (mode === 'defaults' && entry.supportsDefaults && entry.reseed) {
      await entry.reseed();
      currentCount = await entry.model.countDocuments({});
    }

    return { catalog, mode, removedCount, currentCount };
  },
};
