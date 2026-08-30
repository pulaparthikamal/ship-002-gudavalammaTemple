/**
 * One-time demo-data seed for the Gudavalamma Temple management platform.
 * Populates realistic, cross-linked records across every staff screen
 * (donors, properties, assets, liabilities, donations, all four booking
 * types, events, announcements, expense tracker, analytics) so the app
 * demos coherently end-to-end. Bypasses the HTTP/service layer and inserts
 * documents directly (mirroring the domain-doc + Booking-ledger shape the
 * real services write) so it doesn't fire ~90 real emails/WhatsApp sends.
 *
 * Guarded to run once: aborts if Donor documents already exist.
 *
 * Run: npx ts-node --transpile-only -r tsconfig-paths/register src/scripts/seed-demo-data.ts
 */
import mongoose, { Types } from 'mongoose';
import { envConfig } from '../config/env.config';
import { logger } from '../utils/logger.util';

import { Donor } from '../modules/donor/donor.model';
import { Property } from '../modules/property/property.model';
import { Asset } from '../modules/asset/asset.model';
import { Liability } from '../modules/liability/liability.model';
import { DonationFund } from '../modules/donation/donationFund.model';
import { Donation } from '../modules/donation/donation.model';
import { DarshanQuota, DarshanBooking } from '../modules/darshan/darshan.model';
import { SevaCatalog, SevaBooking } from '../modules/seva/seva.model';
import { AccommodationRoomType, AccommodationBooking } from '../modules/accommodation/accommodation.model';
import { PrasadamItem, PrasadamOrder } from '../modules/prasadam/prasadam.model';
import { Booking } from '../modules/booking/booking.model';
import { TempleEvent, EventRegistration } from '../modules/templeEvent/templeEvent.model';
import { Announcement } from '../modules/announcement/announcement.model';
import { ExpenseEvent } from '../modules/expenseEvent/expenseEvent.model';
import { ExpenseEntry } from '../modules/expenseEntry/expenseEntry.model';
import { User } from '../modules/user/user.model';
import { Role } from '../modules/role/role.model';
import { AnalyticsEvent } from '../modules/analytics/analyticsEvent.model';
import { analyticsEventService } from '../modules/analytics/analyticsEvent.service';

const NOW = new Date();

const rand = (min: number, max: number): number => Math.floor(Math.random() * (max - min + 1)) + min;
const choice = <T,>(arr: readonly T[]): T => arr[rand(0, arr.length - 1)];
const randomId = (): string => Math.random().toString(36).slice(2, 8);

const dateDaysAgo = (n: number, hour = rand(7, 20), minute = rand(0, 59)): Date => {
  const d = new Date(NOW);
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, 0, 0);
  return d;
};
const dateDaysFromNow = (n: number, hour = rand(7, 20), minute = rand(0, 59)): Date => dateDaysAgo(-n, hour, minute);
const dateKey = (d: Date): string => d.toISOString().slice(0, 10);

const LOCALES = ['te', 'te', 'te', 'en', 'en', 'hi'] as const;

interface Booker {
  name: string;
  phone: string;
  email?: string;
  address: string;
  panNumber?: string;
}

const DONORS: Booker[] = [
  { name: 'Venkata Ramana Chowdary', phone: '9848012345', email: 'venkat.ramana@gmail.com', address: '12-3-45, Brodipet, Guntur, Andhra Pradesh - 522002', panNumber: 'AXCPV5234R' },
  { name: 'Lakshmi Narasamma', phone: '9440023456', address: '5-67, Temple Street, Gudavalli, Andhra Pradesh - 522017' },
  { name: 'Subba Rao Pothuri', phone: '9876534567', email: 'subbarao.pothuri@yahoo.com', address: 'D.No 29-14-8, Governorpet, Vijayawada, Andhra Pradesh - 520002', panNumber: 'BNZPP7821K' },
  { name: 'Padmavathi Devi Kolli', phone: '9963345678', address: '1-45, Ramalayam Street, Tenali, Andhra Pradesh - 522201', panNumber: 'IJKPK1189D' },
  { name: 'Ramakrishna Yarlagadda', phone: '9848156789', email: 'ramakrishna.y@gmail.com', address: '22-8-9, Lakshmipuram, Guntur, Andhra Pradesh - 522007', panNumber: 'CPTRY4456M' },
  { name: 'Anasuya Devi Mutyala', phone: '9440267890', address: '8-112, Main Road, Gudavalli, Andhra Pradesh - 522017' },
  { name: 'Krishna Murthy Bhupathiraju', phone: '9876378901', email: 'krishnamurthy.b@outlook.com', address: '40-1-23, Patamata, Vijayawada, Andhra Pradesh - 520010', panNumber: 'DHLPB9087N' },
  { name: 'Saraswathi Gollapudi', phone: '9963489012', address: '3-56, Anjaneya Nagar, Tenali, Andhra Pradesh - 522202' },
  { name: 'Nageswara Rao Chintalapudi', phone: '9848590123', email: 'nageswararao.c@gmail.com', address: '16-2-78, Kothapet, Guntur, Andhra Pradesh - 522001', panNumber: 'EFGPC3345L' },
  { name: 'Vijaya Lakshmi Tummala', phone: '9440601234', address: '9-34, Agraharam Street, Gudavalli, Andhra Pradesh - 522017', panNumber: 'JKLPT8823F' },
  { name: 'Satyanarayana Vemuri', phone: '9876712345', email: 'satyanarayana.vemuri@gmail.com', address: '27-9-56, Bhavanipuram, Vijayawada, Andhra Pradesh - 520012', panNumber: 'FJKPV6612Q' },
  { name: 'Kamala Devi Nallamothu', phone: '9963823456', address: '6-78, Market Street, Tenali, Andhra Pradesh - 522201' },
  { name: 'Srinivasa Rao Pasupuleti', phone: '9848934567', email: 'srinivasarao.p@gmail.com', address: '14-5-90, Arundelpet, Guntur, Andhra Pradesh - 522002', panNumber: 'GHMPP2298S' },
  { name: 'Annapurna Devi Bandaru', phone: '9440045678', address: '2-19, Chinna Bazaar, Gudavalli, Andhra Pradesh - 522017' },
  { name: 'Bhaskara Rao Kandregula', phone: '9876156789', email: 'bhaskararao.k@gmail.com', address: '33-6-12, Suryaraopet, Vijayawada, Andhra Pradesh - 520002', panNumber: 'HIJPK7734T' },
  { name: 'Sitamahalakshmi Kasturi', phone: '9963267890', address: '18-90, Koneti Vari Street, Tenali, Andhra Pradesh - 522201' },
];

async function seedDonors() {
  const docs = await Donor.insertMany(
    DONORS.map((d) => ({
      name: d.name,
      phone: d.phone,
      email: d.email,
      address: d.address,
      panNumber: d.panNumber,
      notes: undefined,
      active: true,
    }))
  );
  return docs;
}

async function seedProperties() {
  await Property.insertMany([
    {
      name: 'Temple Main Complex Land',
      type: 'land',
      location: 'Gudavalli, Andhra Pradesh',
      areaSqft: 108900,
      acquisitionDate: new Date('1985-06-15'),
      estimatedValue: 45000000,
      status: 'active',
      notes: 'Ancestral temple land; core shrine, prakaram and queue complex.',
    },
    {
      name: 'Choultry & Guest House Building',
      type: 'building',
      location: 'Gudavalli, Andhra Pradesh',
      areaSqft: 18000,
      acquisitionDate: new Date('2005-03-10'),
      estimatedValue: 12000000,
      status: 'active',
      notes: '3-floor devotee accommodation block, 40+ rooms including the free choultry hall.',
    },
    {
      name: 'Agricultural Land (Wet) - Tenali Road',
      type: 'land',
      location: 'Near Tenali, Andhra Pradesh',
      areaSqft: 348480,
      acquisitionDate: new Date('1998-11-02'),
      estimatedValue: 9600000,
      status: 'active',
      notes: 'Leased to a tenant farmer on an annual lease; income credited to the Annadanam fund.',
    },
    {
      name: 'Commercial Shops - Guntur (6 units)',
      type: 'building',
      location: 'Brodipet, Guntur, Andhra Pradesh',
      areaSqft: 4200,
      acquisitionDate: new Date('2010-07-20'),
      estimatedValue: 18000000,
      status: 'active',
      notes: 'Rented to local vendors; rental income supports general temple operations.',
    },
    {
      name: 'Kalyana Mandapam (Marriage Hall)',
      type: 'building',
      location: 'Gudavalli, Andhra Pradesh',
      areaSqft: 9000,
      acquisitionDate: new Date('2015-01-18'),
      estimatedValue: 15000000,
      status: 'active',
      notes: 'Event rental venue for devotee weddings and functions.',
    },
    {
      name: 'Godown / Storage Building',
      type: 'building',
      location: 'Gudavalli, Andhra Pradesh',
      areaSqft: 2500,
      acquisitionDate: new Date('2012-09-05'),
      estimatedValue: 2500000,
      status: 'active',
      notes: 'Grain and prasadam raw-material storage.',
    },
  ]);
}

async function seedAssets() {
  await Asset.insertMany([
    { name: 'Utsava Vigraham (Processional Deity Idols, Gold-plated)', category: 'jewellery', purchaseDate: new Date('1990-04-01'), cost: 800000, currentValue: 1500000, custodian: 'Head Priest', location: 'Main Shrine Strongroom' },
    { name: 'Temple Ratham (Festival Chariot)', category: 'vehicle', purchaseDate: new Date('2008-05-12'), cost: 600000, currentValue: 450000, custodian: 'Temple Committee', location: 'Ratham Shed' },
    { name: 'Devotee Shuttle Van (Tempo Traveller)', category: 'vehicle', purchaseDate: new Date('2022-02-14'), cost: 1200000, currentValue: 850000, custodian: 'Transport In-charge', location: 'Temple Parking Area' },
    { name: 'Silver Kavacham (Deity Ornament Set)', category: 'jewellery', purchaseDate: new Date('2001-09-09'), cost: 250000, currentValue: 400000, custodian: 'Head Priest', location: 'Main Shrine Strongroom' },
    { name: 'Gold Crown (Kireetam)', category: 'jewellery', purchaseDate: new Date('1995-03-21'), cost: 500000, currentValue: 950000, custodian: 'Head Priest', location: 'Main Shrine Strongroom' },
    { name: 'PA / Sound System', category: 'electronics', purchaseDate: new Date('2021-06-18'), cost: 150000, currentValue: 90000, custodian: 'Facilities In-charge', location: 'Main Mandapam' },
    { name: 'CCTV Surveillance System (32-camera)', category: 'electronics', purchaseDate: new Date('2023-01-30'), cost: 400000, currentValue: 280000, custodian: 'Security In-charge', location: 'Temple Complex' },
    { name: 'Diesel Generator (125 KVA)', category: 'electronics', purchaseDate: new Date('2019-08-11'), cost: 900000, currentValue: 600000, custodian: 'Facilities In-charge', location: 'Power House' },
    { name: 'Devotee Queue Steel Barricades (Set of 50)', category: 'furniture', purchaseDate: new Date('2020-10-25'), cost: 175000, currentValue: 120000, custodian: 'Facilities In-charge', location: 'Queue Complex' },
    { name: 'Office Computers & Printers (Admin Block)', category: 'electronics', purchaseDate: new Date('2024-04-02'), cost: 220000, currentValue: 110000, custodian: 'Office Superintendent', location: 'Administrative Office' },
    { name: 'Brass Utensils Set (Annadanam Kitchen)', category: 'other', purchaseDate: new Date('2017-07-07'), cost: 180000, currentValue: 140000, custodian: 'Annadanam In-charge', location: 'Annadanam Kitchen' },
    { name: 'Prasadam Preparation Steam Cooker', category: 'other', purchaseDate: new Date('2020-12-15'), cost: 320000, currentValue: 250000, custodian: 'Prasadam In-charge', location: 'Prasadam Kitchen' },
    { name: 'Wooden Furniture - Devasthanam Office', category: 'furniture', purchaseDate: new Date('2016-05-05'), cost: 140000, currentValue: 85000, custodian: 'Office Superintendent', location: 'Administrative Office' },
    { name: 'Solar Water Heating System', category: 'electronics', purchaseDate: new Date('2023-11-20'), cost: 260000, currentValue: 200000, custodian: 'Facilities In-charge', location: 'Choultry Rooftop' },
  ]);
}

async function seedLiabilities() {
  await Liability.insertMany([
    { name: 'SBI Temple Renovation Loan', category: 'Bank Loan', amount: 3500000, dueDate: dateDaysFromNow(400), creditor: 'State Bank of India, Guntur Branch', status: 'open', notes: 'EMI-based term loan sanctioned in 2024 for choultry renovation.' },
    { name: 'Pending Contractor Payment - Choultry Extension', category: 'Trade Payable', amount: 425000, dueDate: dateDaysFromNow(20), creditor: 'Sri Balaji Constructions', status: 'open' },
    { name: 'Electricity Board Dues (APEPDCL)', category: 'Utility Payable', amount: 68500, dueDate: dateDaysFromNow(10), creditor: 'APEPDCL Guntur Circle', status: 'open' },
    { name: 'Statutory PF/ESI Dues - Staff', category: 'Statutory Dues', amount: 45200, dueDate: dateDaysFromNow(15), creditor: 'EPFO / ESIC', status: 'open' },
    { name: 'Vehicle Loan - Devotee Shuttle Van', category: 'Bank Loan', amount: 620000, dueDate: dateDaysFromNow(300), creditor: 'HDFC Bank, Vijayawada', status: 'open' },
    { name: 'Advance from Donor (Kalyana Mandapam Booking)', category: 'Advance Received', amount: 50000, dueDate: dateDaysAgo(10), creditor: 'Sri Ramakrishna Yarlagadda', status: 'paid', notes: 'Adjusted against the February 2026 Kalyana Mandapam booking.' },
  ]);
}

async function seedDonationFunds() {
  const existing = await DonationFund.find({}).lean();
  const newFunds = [
    { slug: 'temple-renovation', name: 'Temple Renovation & Development Fund', description: 'Contribute towards the ongoing renovation and infrastructure development of the temple complex.' },
    { slug: 'vidya-daanam', name: 'Vidya Daanam (Student Education Support)', description: 'Support the education of underprivileged students through scholarships and study materials.' },
  ];
  const toInsert = newFunds.filter((f) => !existing.some((e) => e.slug === f.slug));
  const created = toInsert.length > 0 ? await DonationFund.insertMany(toInsert) : [];
  return [...existing, ...created];
}

async function seedDonations(donors: Array<{ _id: Types.ObjectId; name: string; phone?: string }>, funds: Array<{ _id: Types.ObjectId; slug: string; name: string }>) {
  const fundBySlug = new Map(funds.map((f) => [f.slug, f]));
  const weightedFundSlugs = [
    ...Array(9).fill('hundi'),
    ...Array(4).fill('annadanam'),
    ...Array(3).fill('temple-renovation'),
    ...Array(2).fill('goSamrakshana'),
    ...Array(1).fill('vidya-daanam'),
  ];
  const amountPresets = [101, 151, 251, 501, 501, 1001, 1001, 1501, 2501, 2501, 5001, 10001, 25001];
  const dayOffsets = [178, 165, 150, 140, 125, 112, 98, 84, 70, 61, 52, 45, 38, 32, 27, 22, 18, 15, 12, 9];
  const guestOnlyDonors = [
    { name: 'Devotee (Hundi Box Collection)', phone: undefined },
    { name: 'Anonymous Devotee', phone: undefined },
    { name: 'Walk-in Devotee', phone: '9701122334' },
    { name: 'Devotee - Festival Collection', phone: undefined },
    { name: 'Pilgrim Group Offering', phone: '9701233445' },
    { name: 'Anonymous Devotee', phone: undefined },
    { name: 'Walk-in Devotee', phone: '9701344556' },
    { name: 'Devotee (Hundi Box Collection)', phone: undefined },
  ];

  const donationDocs: any[] = [];
  const ledgerDocs: any[] = [];

  for (let i = 0; i < 20; i += 1) {
    const donor = donors[i % donors.length];
    const fund = fundBySlug.get(choice(weightedFundSlugs))!;
    const amount = choice(amountPresets);
    const created = dateDaysAgo(dayOffsets[i]);
    const paymentStatus = dayOffsets[i] <= 12 && i % 5 === 0 ? 'pending' : 'paid';
    const receiptNo = `DN-${created.getTime()}-${randomId().toUpperCase()}`;
    const _id = new Types.ObjectId();
    donationDocs.push({
      _id,
      donorId: donor._id,
      guestName: donor.name,
      guestPhone: donor.phone,
      preferredLocale: choice(LOCALES),
      fundId: fund._id,
      amount,
      paymentStatus,
      paymentReference: paymentStatus === 'paid' ? randomId().toUpperCase() + randomId() : undefined,
      status: 'confirmed',
      receiptNo,
      created,
      updated: created,
    });
    ledgerDocs.push({
      guestName: donor.name,
      guestPhone: donor.phone,
      type: 'donation',
      refId: _id,
      refModel: 'Donation',
      title: fund.name,
      amount,
      date: created,
      status: 'confirmed',
      paymentStatus,
      created,
      updated: created,
    });
  }

  const guestOffsets = [95, 80, 65, 50, 40, 30, 20, 6];
  for (let i = 0; i < guestOnlyDonors.length; i += 1) {
    const guest = guestOnlyDonors[i];
    const fund = fundBySlug.get(choice(['hundi', 'hundi', 'annadanam']))!;
    const amount = choice([101, 251, 501, 1001]);
    const created = dateDaysAgo(guestOffsets[i]);
    const receiptNo = `DN-${created.getTime()}-${randomId().toUpperCase()}`;
    const _id = new Types.ObjectId();
    donationDocs.push({
      _id,
      guestName: guest.name,
      guestPhone: guest.phone,
      preferredLocale: choice(LOCALES),
      fundId: fund._id,
      amount,
      paymentStatus: 'paid',
      status: 'confirmed',
      receiptNo,
      created,
      updated: created,
    });
    ledgerDocs.push({
      guestName: guest.name,
      guestPhone: guest.phone,
      type: 'donation',
      refId: _id,
      refModel: 'Donation',
      title: fund.name,
      amount,
      date: created,
      status: 'confirmed',
      paymentStatus: 'paid',
      created,
      updated: created,
    });
  }

  await Donation.insertMany(donationDocs);
  await Booking.insertMany(ledgerDocs);
  return donationDocs.length;
}

async function seedDarshanBookings(donors: Booker[]) {
  const quotas = await DarshanQuota.find({}).lean();
  const pastOffsets = [58, 52, 47, 41, 36, 30, 25, 21, 18, 15, 12, 9, 7, 5, 3];
  const futureOffsets = [3, 7, 15];
  const domainDocs: any[] = [];
  const ledgerDocs: any[] = [];

  const build = (offset: number, isFuture: boolean, idx: number) => {
    const quota = choice(quotas);
    const booker = choice(donors);
    const devoteeCount = rand(1, 4);
    const amount = quota.price * devoteeCount;
    const date = isFuture ? dateDaysFromNow(offset) : dateDaysAgo(offset);
    const status = isFuture ? 'confirmed' : rand(1, 20) === 1 ? 'cancelled' : 'completed';
    const paymentStatus = amount === 0 ? 'waived' : status === 'cancelled' ? 'waived' : idx % 7 === 0 ? 'pending' : 'paid';
    const _id = new Types.ObjectId();
    domainDocs.push({
      _id,
      guestName: booker.name,
      guestEmail: booker.email,
      guestPhone: booker.phone,
      preferredLocale: choice(LOCALES),
      quota: quota._id,
      date,
      devoteeCount,
      amount,
      status,
      created: date,
      updated: date,
    });
    ledgerDocs.push({
      guestName: booker.name,
      guestEmail: booker.email,
      guestPhone: booker.phone,
      type: 'darshan',
      refId: _id,
      refModel: 'DarshanBooking',
      title: quota.name,
      amount,
      date,
      status,
      paymentStatus,
      created: date,
      updated: date,
    });
  };

  pastOffsets.forEach((o, i) => build(o, false, i));
  futureOffsets.forEach((o, i) => build(o, true, i));

  await DarshanBooking.insertMany(domainDocs);
  await Booking.insertMany(ledgerDocs);
  return domainDocs.length;
}

async function seedSevaBookings(donors: Booker[]) {
  const catalog = await SevaCatalog.find({}).lean();
  const pastOffsets = [55, 49, 44, 38, 33, 28, 24, 20, 17, 14, 11, 8, 4];
  const futureOffsets = [2, 6, 12];
  const domainDocs: any[] = [];
  const ledgerDocs: any[] = [];

  const build = (offset: number, isFuture: boolean, idx: number) => {
    const seva = choice(catalog);
    const booker = choice(donors);
    const amount = seva.price;
    const date = isFuture ? dateDaysFromNow(offset) : dateDaysAgo(offset);
    const status = isFuture ? 'confirmed' : rand(1, 20) === 1 ? 'cancelled' : 'completed';
    const paymentStatus = status === 'cancelled' ? 'waived' : idx % 6 === 0 ? 'pending' : 'paid';
    const _id = new Types.ObjectId();
    domainDocs.push({
      _id,
      guestName: booker.name,
      guestEmail: booker.email,
      guestPhone: booker.phone,
      preferredLocale: choice(LOCALES),
      seva: seva._id,
      date,
      amount,
      status,
      created: date,
      updated: date,
    });
    ledgerDocs.push({
      guestName: booker.name,
      guestEmail: booker.email,
      guestPhone: booker.phone,
      type: 'seva',
      refId: _id,
      refModel: 'SevaBooking',
      title: seva.name,
      amount,
      date,
      status,
      paymentStatus,
      created: date,
      updated: date,
    });
  };

  pastOffsets.forEach((o, i) => build(o, false, i));
  futureOffsets.forEach((o, i) => build(o, true, i));

  await SevaBooking.insertMany(domainDocs);
  await Booking.insertMany(ledgerDocs);
  return domainDocs.length;
}

async function seedAccommodationBookings(donors: Booker[]) {
  const roomTypes = await AccommodationRoomType.find({}).lean();
  const pastCheckIns = [50, 44, 38, 32, 26, 20, 14, 8];
  const futureCheckIns = [5, 20];
  const domainDocs: any[] = [];
  const ledgerDocs: any[] = [];

  const build = (offset: number, isFuture: boolean, idx: number) => {
    const roomType = choice(roomTypes);
    const booker = choice(donors);
    const nights = rand(1, 3);
    const checkIn = isFuture ? dateDaysFromNow(offset, 12, 0) : dateDaysAgo(offset, 12, 0);
    const checkOut = new Date(checkIn);
    checkOut.setDate(checkOut.getDate() + nights);
    const amount = roomType.pricePerNight * nights;
    const status = isFuture ? 'confirmed' : rand(1, 15) === 1 ? 'cancelled' : 'completed';
    const paymentStatus = amount === 0 ? 'waived' : status === 'cancelled' ? 'waived' : idx % 5 === 0 ? 'pending' : 'paid';
    const _id = new Types.ObjectId();
    domainDocs.push({
      _id,
      guestName: booker.name,
      guestEmail: booker.email,
      guestPhone: booker.phone,
      preferredLocale: choice(LOCALES),
      roomTypeId: roomType._id,
      checkIn,
      checkOut,
      guests: rand(1, 4),
      amount,
      status,
      paymentStatus,
      created: checkIn,
      updated: checkIn,
    });
    ledgerDocs.push({
      guestName: booker.name,
      guestEmail: booker.email,
      guestPhone: booker.phone,
      type: 'accommodation',
      refId: _id,
      refModel: 'AccommodationBooking',
      title: `${roomType.name} · ${nights} night${nights > 1 ? 's' : ''}`,
      amount,
      date: checkIn,
      status,
      paymentStatus,
      created: checkIn,
      updated: checkIn,
    });
  };

  pastCheckIns.forEach((o, i) => build(o, false, i));
  futureCheckIns.forEach((o, i) => build(o, true, i));

  await AccommodationBooking.insertMany(domainDocs);
  await Booking.insertMany(ledgerDocs);
  return domainDocs.length;
}

async function seedPrasadamOrders(donors: Booker[]) {
  const items = await PrasadamItem.find({}).lean();
  const pastOffsets = [52, 46, 40, 35, 29, 23, 18, 13, 9, 4];
  const futureOffsets = [1, 3];
  const domainDocs: any[] = [];
  const ledgerDocs: any[] = [];

  const build = (offset: number, isFuture: boolean, idx: number) => {
    const booker = choice(donors);
    const pickCount = rand(1, 3);
    const picked = [...items].sort(() => Math.random() - 0.5).slice(0, pickCount);
    let amount = 0;
    let totalQty = 0;
    const orderItems = picked.map((item) => {
      const qty = rand(1, 3);
      amount += item.price * qty;
      totalQty += qty;
      return { itemId: item._id, name: item.name, price: item.price, qty };
    });
    const created = isFuture ? dateDaysFromNow(offset) : dateDaysAgo(offset);
    const status = isFuture ? 'confirmed' : rand(1, 15) === 1 ? 'cancelled' : 'completed';
    const paymentStatus = status === 'cancelled' ? 'waived' : idx % 6 === 0 ? 'pending' : 'paid';
    const _id = new Types.ObjectId();
    const title = `Prasadam order (${totalQty} item${totalQty > 1 ? 's' : ''})`;
    domainDocs.push({
      _id,
      guestName: booker.name,
      guestEmail: booker.email,
      guestPhone: booker.phone,
      preferredLocale: choice(LOCALES),
      items: orderItems,
      amount,
      status,
      paymentStatus,
      created,
      updated: created,
    });
    ledgerDocs.push({
      guestName: booker.name,
      guestEmail: booker.email,
      guestPhone: booker.phone,
      type: 'prasadam',
      refId: _id,
      refModel: 'PrasadamOrder',
      title,
      amount,
      date: created,
      status,
      paymentStatus,
      created,
      updated: created,
    });
  };

  pastOffsets.forEach((o, i) => build(o, false, i));
  futureOffsets.forEach((o, i) => build(o, true, i));

  await PrasadamOrder.insertMany(domainDocs);
  await Booking.insertMany(ledgerDocs);
  return domainDocs.length;
}

async function seedEventsAndRegistrations(donors: Booker[]) {
  const ugadiStart = dateDaysAgo(150);
  const ramaNavamiStart = dateDaysAgo(120);
  const vaikuntaEkadasiStart = dateDaysFromNow(140);
  const brahmotsavamStart = dateDaysFromNow(45);
  const brahmotsavamEnd = dateDaysFromNow(53);
  const deepotsavamStart = dateDaysFromNow(90);

  const events = await TempleEvent.insertMany([
    {
      name: 'Ugadi Celebrations 2026',
      description: 'Telugu New Year celebrations with Panchanga Sravanam, special poojas and cultural programs.',
      startDate: ugadiStart,
      endDate: ugadiStart,
      registrationRequired: false,
      active: true,
    },
    {
      name: 'Sri Rama Navami',
      description: 'Sri Sita Rama Kalyanotsavam celebrated with grandeur, followed by Annadanam.',
      startDate: ramaNavamiStart,
      endDate: ramaNavamiStart,
      registrationRequired: false,
      active: true,
    },
    {
      name: 'Vaikunta Ekadasi Special Darshan',
      description: 'Special Vaikunta Dwara Darshan on the most auspicious Ekadasi of the year. Advance registration recommended to manage crowds.',
      startDate: vaikuntaEkadasiStart,
      endDate: vaikuntaEkadasiStart,
      registrationRequired: true,
      capacity: 2000,
      registrationDeadline: dateDaysFromNow(135),
      active: true,
    },
    {
      name: 'Gudavalamma Devi Brahmotsavams',
      description: 'The annual multi-day Brahmotsavams with daily vahana sevas, cultural programs and a grand Rathotsavam.',
      startDate: brahmotsavamStart,
      endDate: brahmotsavamEnd,
      registrationRequired: true,
      capacity: 5000,
      registrationDeadline: dateDaysFromNow(40),
      active: true,
    },
    {
      name: 'Karthika Masam Deepotsavam',
      description: 'Lakhs of lamps lit across the temple complex through the holy Karthika Masam, with daily Nagula Chavithi and Kartika Pournami specials.',
      startDate: deepotsavamStart,
      endDate: dateDaysFromNow(95),
      registrationRequired: false,
      active: true,
    },
  ]);

  const [, , vaikuntaEkadasi, brahmotsavam] = events;
  const registrationDocs = [];

  for (let i = 0; i < 9; i += 1) {
    const booker = choice(donors);
    registrationDocs.push({
      event: vaikuntaEkadasi._id,
      guestName: booker.name,
      guestEmail: booker.email,
      guestPhone: booker.phone,
      preferredLocale: choice(LOCALES),
      status: rand(1, 12) === 1 ? 'cancelled' : 'confirmed',
      registeredAt: dateDaysAgo(rand(5, 30)),
    });
  }
  for (let i = 0; i < 6; i += 1) {
    const booker = choice(donors);
    registrationDocs.push({
      event: brahmotsavam._id,
      guestName: booker.name,
      guestEmail: booker.email,
      guestPhone: booker.phone,
      preferredLocale: choice(LOCALES),
      status: rand(1, 12) === 1 ? 'cancelled' : 'confirmed',
      registeredAt: dateDaysAgo(rand(1, 15)),
    });
  }

  await EventRegistration.insertMany(registrationDocs);
  return { events, registrationCount: registrationDocs.length };
}

async function seedAnnouncements(brahmotsavamEvent: { _id: Types.ObjectId; endDate?: Date }, deepotsavamEvent: { _id: Types.ObjectId; endDate?: Date }) {
  await Announcement.insertMany([
    {
      title: 'Brahmotsavams Schedule Announced',
      body: 'The annual Gudavalamma Devi Brahmotsavams will be celebrated with daily vahana sevas and a grand Rathotsavam. Devotees are encouraged to register in advance for the special darshan lines.',
      linkedEventId: brahmotsavamEvent._id,
      type: 'festival',
      startAt: dateDaysAgo(2),
      endAt: brahmotsavamEvent.endDate ?? dateDaysFromNow(53),
      targetAudience: 'all',
      priority: 10,
    },
    {
      title: 'Temple Renovation Work Notice',
      body: 'Renovation work on the choultry extension is in progress. Devotees may notice minor inconvenience near the north entrance; alternate pathways are marked for your convenience.',
      type: 'info',
      startAt: dateDaysAgo(10),
      endAt: null,
      targetAudience: 'all',
      priority: 3,
    },
    {
      title: 'Special Darshan Timings - Karthika Masam',
      body: 'In view of the Karthika Masam Deepotsavam, darshan timings will be extended. Please check the Temple Profile page for the revised schedule.',
      linkedEventId: deepotsavamEvent._id,
      type: 'info',
      startAt: dateDaysFromNow(80),
      endAt: deepotsavamEvent.endDate ?? dateDaysFromNow(95),
      targetAudience: 'devotee',
      priority: 5,
    },
    {
      title: 'Online Booking Now Available for Accommodation',
      body: 'Devotees can now book Choultry, Non-AC, AC Cottage and Dormitory accommodation directly online, with instant UPI payment support.',
      type: 'info',
      startAt: dateDaysAgo(30),
      endAt: null,
      targetAudience: 'all',
      priority: 2,
    },
    {
      title: 'Heavy Rains Alert - Darshan Timings Revised',
      body: 'Due to heavy rains in the region, Sarva Darshan timings have been temporarily revised. Please check with the helpline before starting your journey.',
      type: 'urgent',
      startAt: dateDaysAgo(3),
      endAt: dateDaysFromNow(2),
      targetAudience: 'all',
      priority: 9,
    },
  ]);
}

async function seedExpenseTracker() {
  const ugadiStart = dateDaysAgo(150);
  const ramaNavamiStart = dateDaysAgo(120);
  const julStart = new Date('2026-07-01');
  const julEnd = new Date('2026-07-31');
  const augStart = new Date('2026-08-01');
  const augEnd = new Date('2026-08-31');

  const expenseEvents = await ExpenseEvent.insertMany([
    { name: 'Ugadi Celebrations 2026', startDate: ugadiStart, endDate: ugadiStart, budget: 250000, notes: 'Decorations, prasadam, and cultural program artists.' },
    { name: 'Sri Rama Navami', startDate: ramaNavamiStart, endDate: ramaNavamiStart, budget: 180000, notes: 'Kalyanotsavam arrangements and Annadanam.' },
    { name: 'Monthly Operations - July 2026', startDate: julStart, endDate: julEnd, budget: 400000, notes: 'Routine temple operating expenses for July.' },
    { name: 'Monthly Operations - August 2026', startDate: augStart, endDate: augEnd, budget: 400000, notes: 'Routine temple operating expenses for August.' },
  ]);
  const [ugadiEvent, ramaNavamiEvent, julEvent, augEvent] = expenseEvents;

  await ExpenseEntry.insertMany([
    { date: dateDaysAgo(151), eventId: ugadiEvent._id, category: 'Decorations & Floral Work', amount: 45000, type: 'expense', paymentMode: 'cash' },
    { date: dateDaysAgo(150), eventId: ugadiEvent._id, category: 'Prasadam Ingredients', amount: 60000, type: 'expense', paymentMode: 'bank_transfer' },
    { date: dateDaysAgo(150), eventId: ugadiEvent._id, category: 'Cultural Program Artists Honorarium', amount: 35000, type: 'expense', paymentMode: 'cash' },
    { date: dateDaysAgo(150), eventId: ugadiEvent._id, category: 'Hundi Collection - Ugadi (Manual Count)', description: 'Special Ugadi day hundi collection', amount: 180000, type: 'income', paymentMode: 'cash' },

    { date: dateDaysAgo(121), eventId: ramaNavamiEvent._id, category: 'Kalyanotsavam Special Arrangements', amount: 40000, type: 'expense', paymentMode: 'cash' },
    { date: dateDaysAgo(120), eventId: ramaNavamiEvent._id, category: 'Prasadam Ingredients', amount: 50000, type: 'expense', paymentMode: 'bank_transfer' },
    { date: dateDaysAgo(120), eventId: ramaNavamiEvent._id, category: 'Hundi Collection - Rama Navami (Manual Count)', amount: 150000, type: 'income', paymentMode: 'cash' },

    { date: new Date('2026-07-05'), eventId: julEvent._id, category: 'Priest Honorarium', amount: 60000, type: 'expense', paymentMode: 'bank_transfer' },
    { date: new Date('2026-07-08'), eventId: julEvent._id, category: 'Electricity Bill (APEPDCL)', amount: 22000, type: 'expense', paymentMode: 'upi' },
    { date: new Date('2026-07-10'), eventId: julEvent._id, category: 'Staff Salaries', amount: 180000, type: 'expense', paymentMode: 'bank_transfer' },
    { date: new Date('2026-07-12'), eventId: julEvent._id, category: 'Flowers & Pooja Items', amount: 35000, type: 'expense', paymentMode: 'cash' },
    { date: new Date('2026-07-15'), eventId: julEvent._id, category: 'Diesel for Generator', amount: 12000, type: 'expense', paymentMode: 'cash' },
    { date: new Date('2026-07-20'), eventId: julEvent._id, category: 'Maintenance - Plumbing & Electrical', amount: 18000, type: 'expense', paymentMode: 'cash' },
    { date: new Date('2026-07-31'), eventId: julEvent._id, category: 'Hundi Collection - July (Manual Count)', amount: 220000, type: 'income', paymentMode: 'cash' },
    { date: new Date('2026-07-31'), eventId: julEvent._id, category: 'Kalyana Mandapam Rental Income', amount: 45000, type: 'income', paymentMode: 'upi' },

    { date: new Date('2026-08-05'), eventId: augEvent._id, category: 'Priest Honorarium', amount: 60000, type: 'expense', paymentMode: 'bank_transfer' },
    { date: new Date('2026-08-08'), eventId: augEvent._id, category: 'Electricity Bill (APEPDCL)', amount: 15000, type: 'expense', paymentMode: 'upi' },
    { date: new Date('2026-08-10'), eventId: augEvent._id, category: 'Staff Salaries', amount: 180000, type: 'expense', paymentMode: 'bank_transfer' },
    { date: new Date('2026-08-12'), eventId: augEvent._id, category: 'Flowers & Pooja Items', amount: 20000, type: 'expense', paymentMode: 'cash' },
    { date: new Date('2026-08-14'), eventId: augEvent._id, category: 'Hundi Collection - August (Manual Count)', amount: 130000, type: 'income', paymentMode: 'cash' },
    { date: new Date('2026-08-14'), eventId: augEvent._id, category: 'UPI Devotee Contributions', amount: 60000, type: 'income', paymentMode: 'upi' },
    { date: new Date('2026-08-15'), eventId: undefined, category: 'Vehicle Fuel & Upkeep', amount: 8000, type: 'expense', paymentMode: 'cash' },
    { date: new Date('2026-08-15'), eventId: undefined, category: 'Office Stationery', amount: 4500, type: 'expense', paymentMode: 'cash' },
  ]);
}

async function seedStaffUsers() {
  const [adminRole, managerRole] = await Promise.all([
    Role.findOne({ role: 'ADMIN' }),
    Role.findOne({ role: 'MANAGER' }),
  ]);
  if (!adminRole || !managerRole) {
    logger.warn('ADMIN/MANAGER role not found - skipping staff user seed.');
    return;
  }

  const existing = await User.findOne({ email: { $in: ['eo@gudavalammatemple.org', 'accounts@gudavalammatemple.org'] } });
  if (existing) {
    logger.info('Demo staff users already exist - skipping.');
    return;
  }

  await User.create([
    {
      firstName: 'Ramesh',
      lastName: 'Babu',
      email: 'eo@gudavalammatemple.org',
      password: 'Temple@123',
      role: adminRole._id,
      phone: '9440998877',
      active: true,
      firstTimeLogin: false,
      isEmailVerified: true,
      preferredLocale: 'te',
      createdByName: 'Demo data seed',
    },
    {
      firstName: 'Lakshmi',
      lastName: 'Priya',
      email: 'accounts@gudavalammatemple.org',
      password: 'Temple@123',
      role: managerRole._id,
      phone: '9440998866',
      active: true,
      firstTimeLogin: false,
      isEmailVerified: true,
      preferredLocale: 'en',
      createdByName: 'Demo data seed',
    },
  ]);
}

const FUNNEL_DEFS: Record<string, { path: string; steps: string[] }> = {
  darshan_booking: { path: '/devotee/darshan', steps: ['viewed', 'date_selected', 'submitted'] },
  seva_booking: { path: '/devotee/seva', steps: ['viewed', 'submitted'] },
  accommodation_booking: { path: '/devotee/accommodation', steps: ['viewed', 'stay_selected', 'submitted'] },
  prasadam_order: { path: '/devotee/prasadam', steps: ['viewed', 'item_added', 'submitted'] },
  donation: { path: '/devotee/donations', steps: ['viewed', 'fund_selected', 'submitted'] },
  event_registration: { path: '/devotee/events', steps: ['viewed', 'submitted'] },
};

const NAV_CLICK_LABELS = [
  'nav_darshan', 'nav_seva', 'nav_accommodation', 'nav_prasadam', 'nav_donations',
  'nav_bookings', 'nav_facilities', 'nav_events', 'nav_nearby_places',
  'quickaction_darshan', 'quickaction_seva', 'quickaction_accommodation',
  'quickaction_prasadam', 'quickaction_donations', 'quickaction_events', 'quickaction_bookings',
];
// Deliberately excluded from click generation, matching the real "instrumented but never used"
// insight the Analytics feature-usage panel is designed to surface: nav_live, quickaction_live,
// quickaction_facilities, quickaction_nearby_places.

const PAGE_PATHS = ['/', '/devotee/darshan', '/devotee/seva', '/devotee/accommodation', '/devotee/prasadam', '/devotee/donations', '/devotee/events', '/devotee/bookings', '/devotee/nearby-places'];

async function seedAnalytics(days: number) {
  const events: Array<Record<string, unknown>> = [];

  for (let dayIndex = 0; dayIndex < days; dayIndex += 1) {
    const offset = days - 1 - dayIndex; // oldest first
    const busyness = 0.5 + dayIndex / days; // ramps up towards "today"
    const sessionsToday = Math.round(rand(18, 35) * busyness);

    for (let s = 0; s < sessionsToday; s += 1) {
      const sessionId = `sess-${offset}-${s}-${randomId()}`;
      const pageviewCount = rand(1, 4);
      for (let p = 0; p < pageviewCount; p += 1) {
        events.push({
          sessionId,
          path: choice(PAGE_PATHS),
          eventType: 'pageview',
          timestamp: dateDaysAgo(offset),
        });
      }
      if (rand(1, 100) <= 55) {
        events.push({
          sessionId,
          path: choice(PAGE_PATHS),
          eventType: 'click',
          targetLabel: choice(NAV_CLICK_LABELS),
          timestamp: dateDaysAgo(offset),
        });
      }
    }

    Object.entries(FUNNEL_DEFS).forEach(([funnelName, def]) => {
      const viewedSessions = Math.round(rand(4, 10) * busyness);
      for (let f = 0; f < viewedSessions; f += 1) {
        const sessionId = `funnel-${funnelName}-${offset}-${f}-${randomId()}`;
        const reachesStep = (stepIndex: number) => {
          if (stepIndex === 0) return true;
          const dropoff = stepIndex === def.steps.length - 1 ? 0.55 : 0.7;
          return Math.random() < dropoff;
        };
        let reached = true;
        def.steps.forEach((stepName, stepIndex) => {
          if (!reached) return;
          events.push({
            sessionId,
            path: def.path,
            eventType: 'funnel_step',
            funnelName,
            stepIndex,
            stepName,
            timestamp: dateDaysAgo(offset),
          });
          reached = reachesStep(stepIndex + 1);
        });
      }
    });
  }

  await AnalyticsEvent.insertMany(events, { ordered: false });

  for (let dayIndex = 0; dayIndex < days; dayIndex += 1) {
    const offset = days - 1 - dayIndex;
    await analyticsEventService.computeDailyRollup(dateKey(dateDaysAgo(offset)));
  }

  return events.length;
}

async function main() {
  await mongoose.connect(envConfig.mongoUri, { maxPoolSize: envConfig.mongoMaxPoolSize });
  logger.info('Demo data seed connected to MongoDB');

  const existingDonors = await Donor.countDocuments();
  if (existingDonors > 0) {
    logger.warn(`Donor collection already has ${existingDonors} documents - aborting to avoid duplicate demo data.`);
    await mongoose.connection.close();
    process.exit(0);
  }

  const donors = await seedDonors();
  logger.info(`Seeded ${donors.length} donors`);

  await seedProperties();
  logger.info('Seeded properties');

  await seedAssets();
  logger.info('Seeded assets');

  await seedLiabilities();
  logger.info('Seeded liabilities');

  const funds = await seedDonationFunds();
  logger.info(`Donation funds available: ${funds.length}`);

  const donationCount = await seedDonations(donors, funds);
  logger.info(`Seeded ${donationCount} donations + ledger rows`);

  const darshanCount = await seedDarshanBookings(DONORS);
  logger.info(`Seeded ${darshanCount} darshan bookings + ledger rows`);

  const sevaCount = await seedSevaBookings(DONORS);
  logger.info(`Seeded ${sevaCount} seva bookings + ledger rows`);

  const accommodationCount = await seedAccommodationBookings(DONORS);
  logger.info(`Seeded ${accommodationCount} accommodation bookings + ledger rows`);

  const prasadamCount = await seedPrasadamOrders(DONORS);
  logger.info(`Seeded ${prasadamCount} prasadam orders + ledger rows`);

  const { events, registrationCount } = await seedEventsAndRegistrations(DONORS);
  logger.info(`Seeded ${events.length} temple events + ${registrationCount} event registrations`);

  await seedAnnouncements(events[3], events[4]);
  logger.info('Seeded announcements');

  await seedExpenseTracker();
  logger.info('Seeded expense events + entries');

  await seedStaffUsers();
  logger.info('Seeded staff users');

  const analyticsEventCount = await seedAnalytics(21);
  logger.info(`Seeded ${analyticsEventCount} analytics events + 21 daily rollups`);

  logger.info('Demo data seed complete.');
  await mongoose.connection.close();
  process.exit(0);
}

main().catch(async (error) => {
  logger.error('Demo data seed failed:', error);
  try {
    await mongoose.connection.close();
  } catch {
    // ignore close errors during failure path
  }
  process.exit(1);
});
