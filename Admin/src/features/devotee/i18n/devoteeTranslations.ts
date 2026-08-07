export type DevoteeLanguageCode = 'en' | 'te' | 'hi'

export const DEVOTEE_LANGUAGES: { code: DevoteeLanguageCode; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'te', label: 'తెలుగు' },
  { code: 'hi', label: 'हिन्दी' },
]

export interface DevoteeTranslationStrings {
  // Common
  appName: string
  appTagline: string
  languageLabel: string
  eyebrow: string
  bookNow: string
  donateNow: string
  watchNow: string
  viewAll: string
  free: string
  perNight: string
  perUnit: string
  backToDashboard: string

  // Nav
  navHome: string
  navDarshan: string
  navSeva: string
  navAccommodation: string
  navPrasadam: string
  navDonations: string
  navLive: string
  navBookings: string
  navFacilities: string
  navProfile: string
  navLogout: string
  navLogin: string
  staffPortalLink: string
  logoutSuccess: string

  // Auth — login
  loginBrandSubtitle: string
  loginHeroLine1: string
  loginHeroHighlight: string
  loginHeroTagline: string
  loginChipSecure: string
  loginChipSupport: string
  loginTabTitle: string
  loginEmailLabel: string
  loginEmailPlaceholder: string
  loginPasswordLabel: string
  loginPasswordPlaceholder: string
  loginRememberMe: string
  loginForgotPassword: string
  loginSignIn: string
  loginSigningIn: string
  loginNoAccount: string
  loginCreateAccount: string
  loginStaffCross: string
  loginTermsNote: string
  loginSuccessTitle: string
  loginSuccessDetail: string
  loginFailedTitle: string
  errorInvalidEmail: string
  errorPasswordMin: string

  // Auth — register
  registerBrandSubtitle: string
  registerTitle: string
  registerSubtitle: string
  firstNameLabel: string
  firstNamePlaceholder: string
  lastNameLabel: string
  lastNamePlaceholder: string
  emailLabel: string
  emailPlaceholder: string
  phoneLabel: string
  phonePlaceholder: string
  phoneHelper: string
  passwordLabel: string
  passwordPlaceholder: string
  confirmPasswordLabel: string
  confirmPasswordPlaceholder: string
  createAccountButton: string
  creatingAccount: string
  alreadyHaveAccount: string
  signInLink: string
  registerSuccessTitle: string
  registerSuccessDetail: string
  registerFailedTitle: string
  errorFirstNameMin: string
  errorLastNameMin: string
  errorPhoneMin: string
  errorConfirmMismatch: string

  // Auth — forgot password
  forgotTitle: string
  forgotSubtitle: string
  forgotSendButton: string
  forgotSending: string
  forgotBackToSignIn: string
  forgotRequestFailedTitle: string
  forgotResetSentTitle: string
  forgotDefaultSuccessMessage: string

  // Dashboard
  welcomeBack: string
  quickActionsTitle: string
  darshanCardTitle: string
  darshanCardDesc: string
  sevaCardTitle: string
  sevaCardDesc: string
  accommodationCardTitle: string
  accommodationCardDesc: string
  prasadamCardTitle: string
  prasadamCardDesc: string
  donationCardTitle: string
  donationCardDesc: string
  liveCardTitle: string
  liveCardDesc: string
  bookingsCardTitle: string
  bookingsCardDesc: string
  facilitiesCardTitle: string
  facilitiesCardDesc: string
  liveRightNowTitle: string
  queueWaitLabel: string
  queueWaitUnit: string
  queueDevoteesLabel: string
  nextFestivalLabel: string
  festivalName: string
  countdownDays: string
  countdownHours: string
  countdownMinutes: string
  countdownSeconds: string
  todayScheduleTitle: string
  scheduleSuprabhatam: string
  scheduleSarvaDarshan: string
  scheduleArchana: string
  scheduleEkanta: string

  // Darshan
  darshanTitle: string
  darshanSubtitle: string
  calendarLabel: string
  quotaSarvaName: string
  quotaSarvaDesc: string
  quotaSpecialName: string
  quotaSpecialDesc: string
  quotaSeniorName: string
  quotaSeniorDesc: string
  devoteesLabel: string
  maxNote: string
  selectedDateLabel: string
  quotaLabel: string
  totalLabel: string
  noDateSelected: string
  proceedButton: string
  selectDateFirst: string

  // Seva
  sevaTitle: string
  sevaSubtitle: string
  categoryParoksha: string
  categoryParokshaDesc: string
  categoryPratyaksha: string
  categoryPratyakshaDesc: string
  categorySaswata: string
  categorySaswataDesc: string
  limitedSlots: string
  bookSeva: string
  oneTime: string

  // Accommodation
  accommodationTitle: string
  accommodationSubtitle: string
  availabilityNote: string
  bookStay: string

  // Donation
  donationTitle: string
  donationSubtitle: string
  hundiTitle: string
  hundiDesc: string
  annadanamTitle: string
  annadanamDesc: string
  goSamrakshanaTitle: string
  goSamrakshanaDesc: string
  chooseAmount: string
  customAmount: string
  customAmountPlaceholder: string
  taxNote: string

  // Prasadam
  prasadamTitle: string
  prasadamSubtitle: string
  cartItems: string
  cartTotal: string
  checkoutButton: string
  emptyCart: string

  // Live darshan
  liveTitle: string
  liveSubtitle: string
  liveBadge: string
  camGarbhagriha: string
  camQueue: string
  camTower: string
  liveNote: string
  queueStatusTitle: string
  sarvaLine: string
  specialLine: string
  seniorLine: string

  // Bookings
  bookingsTitle: string
  bookingsSubtitle: string
  bookingsEmptyTitle: string
  bookingsEmptyDesc: string
  statusConfirmed: string
  statusPending: string
  statusCompleted: string
  statusCancelled: string
  cancelButton: string
  downloadButton: string
  filterAll: string
  filterUpcoming: string
  filterPast: string
  columnType: string
  columnDetails: string
  columnDate: string
  columnStatus: string
  columnAction: string

  // Facilities
  facilitiesTitle: string
  facilitiesSubtitle: string

  // Profile
  profileTitle: string
  profileSubtitle: string
  profileNameLabel: string
  profileEmailLabel: string
  profilePhoneLabel: string
  profileSaveButton: string
  profileSavedToast: string

  // Footer
  footerAddress: string
  footerHelpline: string
  footerCopyright: string
  footerPrivacyPolicy: string
  footerTerms: string
  footerQuickLinks: string
  footerContact: string
}

export type DevoteeTranslationKey = keyof DevoteeTranslationStrings

export const devoteeTranslations: Record<DevoteeLanguageCode, DevoteeTranslationStrings> = {
  en: {
    appName: 'Gudavalamma Temple',
    appTagline: 'Devotee Services Portal',
    languageLabel: 'Language',
    eyebrow: '|| Om Sri Gudavalamma Devi Namaha ||',
    bookNow: 'Book Now',
    donateNow: 'Donate Now',
    watchNow: 'Watch Now',
    viewAll: 'View All',
    free: 'Free',
    perNight: '/ night',
    perUnit: 'per unit',
    backToDashboard: 'Back to dashboard',

    navHome: 'Home',
    navDarshan: 'Darshan',
    navSeva: 'Seva',
    navAccommodation: 'Stay',
    navPrasadam: 'Prasadam',
    navDonations: 'Donations',
    navLive: 'Live Darshan',
    navBookings: 'My Bookings',
    navFacilities: 'Facilities',
    navProfile: 'Profile',
    navLogout: 'Logout',
    navLogin: 'Devotee Login',
    staffPortalLink: 'Temple Staff Login',
    logoutSuccess: 'You have been signed out.',

    loginBrandSubtitle: 'DEVOTEE PORTAL',
    loginHeroLine1: 'Darshan, Seva & Stay —',
    loginHeroHighlight: 'From Wherever You Are.',
    loginHeroTagline:
      'Book your darshan slot, sevas, accommodation and prasadam online, and manage every visit from one devotee account.',
    loginChipSecure: 'Secure devotee sign-in',
    loginChipSupport: '24×7 devotee helpline',
    loginTabTitle: 'Devotee Login',
    loginEmailLabel: 'Email',
    loginEmailPlaceholder: 'you@example.com',
    loginPasswordLabel: 'Password',
    loginPasswordPlaceholder: 'Enter your password',
    loginRememberMe: 'Remember me',
    loginForgotPassword: 'Forgot password?',
    loginSignIn: 'Sign in',
    loginSigningIn: 'Signing in...',
    loginNoAccount: 'New devotee?',
    loginCreateAccount: 'Create a free account',
    loginStaffCross: 'Temple staff? Sign in here',
    loginTermsNote: "By continuing you agree to the Devasthanam Trust's Terms of Service & Privacy Policy.",
    loginSuccessTitle: 'Login successful',
    loginSuccessDetail: 'Welcome back.',
    loginFailedTitle: 'Login failed',
    errorInvalidEmail: 'Enter a valid email address',
    errorPasswordMin: 'Password must be at least 8 characters',

    registerBrandSubtitle: 'DEVOTEE PORTAL',
    registerTitle: 'Create Your Devotee Account',
    registerSubtitle: 'Register once to book darshan, sevas, accommodation and prasadam online.',
    firstNameLabel: 'First name',
    firstNamePlaceholder: 'First name',
    lastNameLabel: 'Last name',
    lastNamePlaceholder: 'Last name',
    emailLabel: 'Email',
    emailPlaceholder: 'you@example.com',
    phoneLabel: 'Mobile number',
    phonePlaceholder: '+91 98xxxxxx00',
    phoneHelper: 'Optional — used for booking updates',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Create a password',
    confirmPasswordLabel: 'Confirm password',
    confirmPasswordPlaceholder: 'Re-enter password',
    createAccountButton: 'Create account',
    creatingAccount: 'Creating account...',
    alreadyHaveAccount: 'Already have an account?',
    signInLink: 'Sign in',
    registerSuccessTitle: 'Registration successful',
    registerSuccessDetail: 'Your devotee account has been created. Please sign in.',
    registerFailedTitle: 'Registration failed',
    errorFirstNameMin: 'First name must be at least 2 characters',
    errorLastNameMin: 'Last name must be at least 2 characters',
    errorPhoneMin: 'Mobile number must be at least 8 characters',
    errorConfirmMismatch: 'Passwords must match',

    forgotTitle: 'Reset your password',
    forgotSubtitle: "Enter your email and we'll send you a reset link.",
    forgotSendButton: 'Send reset link',
    forgotSending: 'Sending...',
    forgotBackToSignIn: 'Back to sign in',
    forgotRequestFailedTitle: 'Request failed',
    forgotResetSentTitle: 'Reset link requested',
    forgotDefaultSuccessMessage: 'If the email exists, a password reset link has been sent.',

    welcomeBack: 'Welcome back',
    quickActionsTitle: 'Quick Actions',
    darshanCardTitle: 'Book Darshan',
    darshanCardDesc: 'Reserve Sarva or Special Entry darshan slots.',
    sevaCardTitle: 'Book Seva',
    sevaCardDesc: 'Archana, Abhishekam, Kalyanotsavam & more.',
    accommodationCardTitle: 'Book Accommodation',
    accommodationCardDesc: 'Choultries, cottages & dormitory rooms.',
    prasadamCardTitle: 'Order Prasadam',
    prasadamCardDesc: 'Laddu & temple prasadam, home delivered.',
    donationCardTitle: 'Donate / e-Hundi',
    donationCardDesc: 'Contribute towards sevas & Annadanam.',
    liveCardTitle: 'Live Darshan',
    liveCardDesc: 'Watch the sanctum sanctorum, live.',
    bookingsCardTitle: 'My Bookings',
    bookingsCardDesc: 'View & manage your upcoming visits.',
    facilitiesCardTitle: 'Facilities',
    facilitiesCardDesc: 'Cloak room, medical aid, Annadanam & more.',
    liveRightNowTitle: 'Live Right Now',
    queueWaitLabel: 'Current Queue Wait',
    queueWaitUnit: 'min',
    queueDevoteesLabel: 'devotees in darshan queue today',
    nextFestivalLabel: 'Next Festival',
    festivalName: 'Brahmotsavam',
    countdownDays: 'Days',
    countdownHours: 'Hrs',
    countdownMinutes: 'Min',
    countdownSeconds: 'Sec',
    todayScheduleTitle: "Today's Schedule",
    scheduleSuprabhatam: 'Suprabhata Seva',
    scheduleSarvaDarshan: 'Sarva Darshan',
    scheduleArchana: 'Archana / Abhishekam',
    scheduleEkanta: 'Ekanta Seva',

    darshanTitle: 'Book Darshan Tickets',
    darshanSubtitle: 'Select a date, choose your darshan quota, and confirm the number of devotees.',
    calendarLabel: 'Select Date',
    quotaSarvaName: 'Sarva Darshan',
    quotaSarvaDesc: 'Free · General queue line',
    quotaSpecialName: 'Special Entry Darshan',
    quotaSpecialDesc: 'Priority queue · shorter wait',
    quotaSeniorName: 'Senior Citizen / Divyangjan',
    quotaSeniorDesc: 'Free · dedicated priority line',
    devoteesLabel: 'Devotees',
    maxNote: '(max 5 per booking)',
    selectedDateLabel: 'Selected date',
    quotaLabel: 'Quota',
    totalLabel: 'Total amount',
    noDateSelected: '—',
    proceedButton: 'Proceed to Payment',
    selectDateFirst: 'Please select a date first.',

    sevaTitle: 'Book a Seva',
    sevaSubtitle: 'Participate in daily rituals performed inside the sanctum.',
    categoryParoksha: 'Paroksha Seva',
    categoryParokshaDesc: 'Worship from anywhere — performed on your behalf and streamed online.',
    categoryPratyaksha: 'Pratyaksha Seva',
    categoryPratyakshaDesc: 'Be personally present inside the temple for the ritual.',
    categorySaswata: 'Saswata Seva',
    categorySaswataDesc: 'A one-time endowment that sponsors this seva every year, in perpetuity.',
    limitedSlots: 'Limited slots/day',
    bookSeva: 'Book Seva',
    oneTime: 'one-time',

    accommodationTitle: 'Accommodation',
    accommodationSubtitle: 'Choose from choultries, cottages and dormitory rooms near the temple.',
    availabilityNote: 'Subject to availability',
    bookStay: 'Book Stay',

    donationTitle: 'Donations',
    donationSubtitle: 'Support temple sevas, Annadanam and trust operations from anywhere in the world.',
    hundiTitle: 'e-Hundi',
    hundiDesc: 'General donations for the welfare and upkeep of the temple.',
    annadanamTitle: 'Annadanam Trust',
    annadanamDesc: 'Sponsor free meals served daily to pilgrims.',
    goSamrakshanaTitle: 'Go Samrakshana Trust',
    goSamrakshanaDesc: 'Support the temple goshala (cow shelter).',
    chooseAmount: 'Choose an amount',
    customAmount: 'Custom amount',
    customAmountPlaceholder: 'Enter amount',
    taxNote: 'Donations may be eligible for tax benefits under applicable law. A receipt will be emailed to you.',

    prasadamTitle: 'Order Prasadam',
    prasadamSubtitle: 'Sacred offerings, packed fresh and shipped to your doorstep.',
    cartItems: 'Items',
    cartTotal: 'Cart total',
    checkoutButton: 'Checkout',
    emptyCart: 'Your cart is empty. Add a few items to get started.',

    liveTitle: 'Live Darshan',
    liveSubtitle: 'Watch the sanctum sanctorum in real time from anywhere in the world.',
    liveBadge: 'LIVE',
    camGarbhagriha: 'Garbhagriha View',
    camQueue: 'Queue Complex',
    camTower: 'Temple Tower',
    liveNote:
      'Streamed dim and quiet, just as the sanctum is kept — this is a devotional service; nothing replaces in-person darshan.',
    queueStatusTitle: 'Queue Status',
    sarvaLine: 'Sarva Darshan line',
    specialLine: 'Special Entry line',
    seniorLine: 'Senior Citizen line',

    bookingsTitle: 'My Bookings',
    bookingsSubtitle: 'Track and manage everything you have booked with the temple.',
    bookingsEmptyTitle: 'No bookings yet',
    bookingsEmptyDesc: 'Your darshan, seva, accommodation and prasadam bookings will show up here.',
    statusConfirmed: 'Confirmed',
    statusPending: 'Pending',
    statusCompleted: 'Completed',
    statusCancelled: 'Cancelled',
    cancelButton: 'Cancel',
    downloadButton: 'Download',
    filterAll: 'All',
    filterUpcoming: 'Upcoming',
    filterPast: 'Past',
    columnType: 'Type',
    columnDetails: 'Details',
    columnDate: 'Date',
    columnStatus: 'Status',
    columnAction: 'Action',

    facilitiesTitle: 'Devotee Facilities',
    facilitiesSubtitle: 'Everything provided by the Devasthanam to make your visit comfortable.',

    profileTitle: 'My Profile',
    profileSubtitle: 'Manage your devotee account details.',
    profileNameLabel: 'Full name',
    profileEmailLabel: 'Email',
    profilePhoneLabel: 'Mobile number',
    profileSaveButton: 'Save changes',
    profileSavedToast: 'Profile updated.',

    footerAddress: '10-19-54, Temple Street, Gudavalli, Andhra Pradesh, India',
    footerHelpline: '24×7 Devotee Helpline: 1800-000-0000',
    footerCopyright: 'Gudavalamma Temple · Devotee Services Portal — for demonstration purposes.',
    footerPrivacyPolicy: 'Privacy Policy',
    footerTerms: 'Terms & Conditions',
    footerQuickLinks: 'Quick Links',
    footerContact: 'Contact',
  },
  te: {
    appName: 'గుడవళ్లమ్మ ఆలయం',
    appTagline: 'భక్తుల సేవల పోర్టల్',
    languageLabel: 'భాష',
    eyebrow: '|| ఓం శ్రీ గుడవళ్లమ్మ దేవి నమః ||',
    bookNow: 'ఇప్పుడే బుక్ చేయండి',
    donateNow: 'ఇప్పుడే విరాళం ఇవ్వండి',
    watchNow: 'ఇప్పుడే చూడండి',
    viewAll: 'అన్నీ చూడండి',
    free: 'ఉచితం',
    perNight: '/ ఒక రాత్రికి',
    perUnit: 'ఒక్కొక్కటికి',
    backToDashboard: 'డాష్‌బోర్డ్‌కు తిరిగి వెళ్ళండి',

    navHome: 'హోమ్',
    navDarshan: 'దర్శనం',
    navSeva: 'సేవ',
    navAccommodation: 'వసతి',
    navPrasadam: 'ప్రసాదం',
    navDonations: 'విరాళాలు',
    navLive: 'ప్రత్యక్ష దర్శనం',
    navBookings: 'నా బుకింగ్‌లు',
    navFacilities: 'సదుపాయాలు',
    navProfile: 'ప్రొఫైల్',
    navLogout: 'లాగ్అవుట్',
    navLogin: 'భక్తుల లాగిన్',
    staffPortalLink: 'ఆలయ సిబ్బంది లాగిన్',
    logoutSuccess: 'మీరు సైన్ అవుట్ అయ్యారు.',

    loginBrandSubtitle: 'భక్తుల పోర్టల్',
    loginHeroLine1: 'దర్శనం, సేవ & వసతి —',
    loginHeroHighlight: 'మీరు ఎక్కడ ఉన్నా.',
    loginHeroTagline:
      'దర్శన స్లాట్, సేవలు, వసతి మరియు ప్రసాదాన్ని ఆన్‌లైన్‌లో బుక్ చేయండి — అన్నీ ఒకే భక్తుల ఖాతా నుండి నిర్వహించండి.',
    loginChipSecure: 'సురక్షిత భక్తుల లాగిన్',
    loginChipSupport: '24×7 భక్తుల హెల్ప్‌లైన్',
    loginTabTitle: 'భక్తుల లాగిన్',
    loginEmailLabel: 'ఇమెయిల్',
    loginEmailPlaceholder: 'you@example.com',
    loginPasswordLabel: 'పాస్‌వర్డ్',
    loginPasswordPlaceholder: 'మీ పాస్‌వర్డ్ నమోదు చేయండి',
    loginRememberMe: 'నన్ను గుర్తుంచుకో',
    loginForgotPassword: 'పాస్‌వర్డ్ మర్చిపోయారా?',
    loginSignIn: 'సైన్ ఇన్',
    loginSigningIn: 'సైన్ ఇన్ చేస్తోంది...',
    loginNoAccount: 'కొత్త భక్తులా?',
    loginCreateAccount: 'ఉచిత ఖాతా సృష్టించండి',
    loginStaffCross: 'ఆలయ సిబ్బందా? ఇక్కడ సైన్ ఇన్ చేయండి',
    loginTermsNote: 'కొనసాగించడం ద్వారా మీరు దేవస్థానం ట్రస్ట్ నిబంధనలు & గోప్యతా విధానానికి అంగీకరిస్తున్నారు.',
    loginSuccessTitle: 'లాగిన్ విజయవంతమైంది',
    loginSuccessDetail: 'మళ్ళీ స్వాగతం.',
    loginFailedTitle: 'లాగిన్ విఫలమైంది',
    errorInvalidEmail: 'సరైన ఇమెయిల్ చిరునామాను నమోదు చేయండి',
    errorPasswordMin: 'పాస్‌వర్డ్ కనీసం 8 అక్షరాలు ఉండాలి',

    registerBrandSubtitle: 'భక్తుల పోర్టల్',
    registerTitle: 'మీ భక్తుల ఖాతాను సృష్టించండి',
    registerSubtitle: 'దర్శనం, సేవలు, వసతి మరియు ప్రసాదాన్ని ఆన్‌లైన్‌లో బుక్ చేయడానికి ఒకసారి నమోదు చేయండి.',
    firstNameLabel: 'మొదటి పేరు',
    firstNamePlaceholder: 'మొదటి పేరు',
    lastNameLabel: 'చివరి పేరు',
    lastNamePlaceholder: 'చివరి పేరు',
    emailLabel: 'ఇమెయిల్',
    emailPlaceholder: 'you@example.com',
    phoneLabel: 'మొబైల్ నంబర్',
    phonePlaceholder: '+91 98xxxxxx00',
    phoneHelper: 'ఐచ్ఛికం — బుకింగ్ నవీకరణల కోసం ఉపయోగించబడుతుంది',
    passwordLabel: 'పాస్‌వర్డ్',
    passwordPlaceholder: 'పాస్‌వర్డ్ సృష్టించండి',
    confirmPasswordLabel: 'పాస్‌వర్డ్ నిర్ధారించండి',
    confirmPasswordPlaceholder: 'పాస్‌వర్డ్ మళ్ళీ నమోదు చేయండి',
    createAccountButton: 'ఖాతా సృష్టించండి',
    creatingAccount: 'ఖాతా సృష్టిస్తోంది...',
    alreadyHaveAccount: 'ఇప్పటికే ఖాతా ఉందా?',
    signInLink: 'సైన్ ఇన్',
    registerSuccessTitle: 'నమోదు విజయవంతమైంది',
    registerSuccessDetail: 'మీ భక్తుల ఖాతా సృష్టించబడింది. దయచేసి సైన్ ఇన్ చేయండి.',
    registerFailedTitle: 'నమోదు విఫలమైంది',
    errorFirstNameMin: 'మొదటి పేరు కనీసం 2 అక్షరాలు ఉండాలి',
    errorLastNameMin: 'చివరి పేరు కనీసం 2 అక్షరాలు ఉండాలి',
    errorPhoneMin: 'మొబైల్ నంబర్ కనీసం 8 అక్షరాలు ఉండాలి',
    errorConfirmMismatch: 'పాస్‌వర్డ్‌లు సరిపోలాలి',

    forgotTitle: 'మీ పాస్‌వర్డ్ రీసెట్ చేయండి',
    forgotSubtitle: 'మీ ఇమెయిల్ నమోదు చేయండి, మేము మీకు రీసెట్ లింక్ పంపుతాము.',
    forgotSendButton: 'రీసెట్ లింక్ పంపండి',
    forgotSending: 'పంపుతోంది...',
    forgotBackToSignIn: 'సైన్ ఇన్‌కు తిరిగి వెళ్ళండి',
    forgotRequestFailedTitle: 'అభ్యర్థన విఫలమైంది',
    forgotResetSentTitle: 'రీసెట్ లింక్ అభ్యర్థించబడింది',
    forgotDefaultSuccessMessage: 'ఇమెయిల్ ఉంటే, పాస్‌వర్డ్ రీసెట్ లింక్ పంపబడింది.',

    welcomeBack: 'మళ్ళీ స్వాగతం',
    quickActionsTitle: 'త్వరిత చర్యలు',
    darshanCardTitle: 'దర్శనం బుక్ చేయండి',
    darshanCardDesc: 'సర్వ దర్శనం లేదా ప్రత్యేక దర్శన స్లాట్‌లను రిజర్వ్ చేయండి.',
    sevaCardTitle: 'సేవ బుక్ చేయండి',
    sevaCardDesc: 'అర్చన, అభిషేకం, కళ్యాణోత్సవం & మరిన్ని.',
    accommodationCardTitle: 'వసతి బుక్ చేయండి',
    accommodationCardDesc: 'చౌల్ట్రీలు, కాటేజీలు & డార్మిటరీ గదులు.',
    prasadamCardTitle: 'ప్రసాదం ఆర్డర్ చేయండి',
    prasadamCardDesc: 'లడ్డూ & ఆలయ ప్రసాదం, ఇంటికే డెలివరీ.',
    donationCardTitle: 'విరాళం / ఇ-హుండీ',
    donationCardDesc: 'సేవలు & అన్నదానానికి తోడ్పడండి.',
    liveCardTitle: 'ప్రత్యక్ష దర్శనం',
    liveCardDesc: 'గర్భగుడిని ప్రత్యక్షంగా చూడండి.',
    bookingsCardTitle: 'నా బుకింగ్‌లు',
    bookingsCardDesc: 'మీ రాబోయే సందర్శనలను చూడండి & నిర్వహించండి.',
    facilitiesCardTitle: 'సదుపాయాలు',
    facilitiesCardDesc: 'క్లోక్ రూమ్, వైద్య సహాయం, అన్నదానం & మరిన్ని.',
    liveRightNowTitle: 'ఇప్పుడు ప్రత్యక్షంగా',
    queueWaitLabel: 'ప్రస్తుత క్యూ నిరీక్షణ',
    queueWaitUnit: 'నిమి',
    queueDevoteesLabel: 'నేడు దర్శన క్యూలో భక్తులు',
    nextFestivalLabel: 'రాబోయే ఉత్సవం',
    festivalName: 'బ్రహ్మోత్సవం',
    countdownDays: 'రోజులు',
    countdownHours: 'గంటలు',
    countdownMinutes: 'నిమిషాలు',
    countdownSeconds: 'సెకన్లు',
    todayScheduleTitle: 'నేటి కార్యక్రమం',
    scheduleSuprabhatam: 'సుప్రభాత సేవ',
    scheduleSarvaDarshan: 'సర్వ దర్శనం',
    scheduleArchana: 'అర్చన / అభిషేకం',
    scheduleEkanta: 'ఏకాంత సేవ',

    darshanTitle: 'దర్శన టికెట్లు బుక్ చేయండి',
    darshanSubtitle: 'తేదీని ఎంచుకుని, మీ దర్శన కోటాను ఎంచుకుని, భక్తుల సంఖ్యను నిర్ధారించండి.',
    calendarLabel: 'తేదీ ఎంచుకోండి',
    quotaSarvaName: 'సర్వ దర్శనం',
    quotaSarvaDesc: 'ఉచితం · సాధారణ క్యూ లైన్',
    quotaSpecialName: 'ప్రత్యేక దర్శనం',
    quotaSpecialDesc: 'ప్రాధాన్యత క్యూ · తక్కువ నిరీక్షణ',
    quotaSeniorName: 'వృద్ధులు / దివ్యాంగులు',
    quotaSeniorDesc: 'ఉచితం · ప్రత్యేక ప్రాధాన్యత లైన్',
    devoteesLabel: 'భక్తులు',
    maxNote: '(ఒక్కో బుకింగ్‌కు గరిష్టంగా 5 మంది)',
    selectedDateLabel: 'ఎంచుకున్న తేదీ',
    quotaLabel: 'కోటా',
    totalLabel: 'మొత్తం రుసుము',
    noDateSelected: '—',
    proceedButton: 'చెల్లింపుకు వెళ్ళండి',
    selectDateFirst: 'దయచేసి ముందుగా తేదీని ఎంచుకోండి.',

    sevaTitle: 'సేవ బుక్ చేయండి',
    sevaSubtitle: 'గర్భగుడిలో నిర్వహించే నిత్య పూజలలో పాల్గొనండి.',
    categoryParoksha: 'పరోక్ష సేవ',
    categoryParokshaDesc: 'ఎక్కడి నుండైనా పూజ చేయించుకోండి — మీ తరపున నిర్వహించి ఆన్‌లైన్‌లో ప్రసారం చేస్తారు.',
    categoryPratyaksha: 'ప్రత్యక్ష సేవ',
    categoryPratyakshaDesc: 'పూజ కోసం మీరు స్వయంగా ఆలయంలో హాజరు కావాలి.',
    categorySaswata: 'శాశ్వత సేవ',
    categorySaswataDesc: 'ఒకేసారి చెల్లించే విరాళంతో ఈ సేవను ప్రతి సంవత్సరం శాశ్వతంగా స్పాన్సర్ చేయండి.',
    limitedSlots: 'రోజుకు పరిమిత స్లాట్‌లు',
    bookSeva: 'సేవ బుక్ చేయండి',
    oneTime: 'ఒకేసారి',

    accommodationTitle: 'వసతి',
    accommodationSubtitle: 'ఆలయం సమీపంలోని చౌల్ట్రీలు, కాటేజీలు మరియు డార్మిటరీ గదుల నుండి ఎంచుకోండి.',
    availabilityNote: 'లభ్యతను బట్టి',
    bookStay: 'వసతి బుక్ చేయండి',

    donationTitle: 'విరాళాలు',
    donationSubtitle: 'ప్రపంచంలో ఎక్కడి నుండైనా ఆలయ సేవలు, అన్నదానం మరియు ట్రస్ట్ కార్యకలాపాలకు తోడ్పడండి.',
    hundiTitle: 'ఇ-హుండీ',
    hundiDesc: 'ఆలయ సంక్షేమం మరియు నిర్వహణ కోసం సాధారణ విరాళాలు.',
    annadanamTitle: 'అన్నదానం ట్రస్ట్',
    annadanamDesc: 'యాత్రికులకు నిత్యం ఉచిత భోజనం అందించడానికి స్పాన్సర్ చేయండి.',
    goSamrakshanaTitle: 'గో సంరక్షణ ట్రస్ట్',
    goSamrakshanaDesc: 'ఆలయ గోశాలకు తోడ్పడండి.',
    chooseAmount: 'మొత్తాన్ని ఎంచుకోండి',
    customAmount: 'ఇతర మొత్తం',
    customAmountPlaceholder: 'మొత్తాన్ని నమోదు చేయండి',
    taxNote: 'విరాళాలు వర్తించే చట్టం ప్రకారం పన్ను ప్రయోజనాలకు అర్హత పొందవచ్చు. రసీదు మీ ఇమెయిల్‌కు పంపబడుతుంది.',

    prasadamTitle: 'ప్రసాదం ఆర్డర్ చేయండి',
    prasadamSubtitle: 'పవిత్రమైన నైవేద్యాలు, తాజాగా ప్యాక్ చేసి మీ ఇంటికే పంపబడతాయి.',
    cartItems: 'వస్తువులు',
    cartTotal: 'కార్ట్ మొత్తం',
    checkoutButton: 'చెక్‌అవుట్',
    emptyCart: 'మీ కార్ట్ ఖాళీగా ఉంది. ప్రారంభించడానికి కొన్ని వస్తువులను జోడించండి.',

    liveTitle: 'ప్రత్యక్ష దర్శనం',
    liveSubtitle: 'ప్రపంచంలో ఎక్కడి నుండైనా గర్భగుడిని ప్రత్యక్షంగా చూడండి.',
    liveBadge: 'ప్రత్యక్షం',
    camGarbhagriha: 'గర్భగుడి దృశ్యం',
    camQueue: 'క్యూ కాంప్లెక్స్',
    camTower: 'ఆలయ గోపురం',
    liveNote:
      'గర్భగుడిని ఉంచినట్లుగానే మందకొడి, నిశ్శబ్దంగా ప్రసారం చేయబడుతుంది — ఇది భక్తి సేవ మాత్రమే; ప్రత్యక్ష దర్శనానికి ఇది ప్రత్యామ్నాయం కాదు.',
    queueStatusTitle: 'క్యూ స్థితి',
    sarvaLine: 'సర్వ దర్శన లైన్',
    specialLine: 'ప్రత్యేక దర్శన లైన్',
    seniorLine: 'వృద్ధుల లైన్',

    bookingsTitle: 'నా బుకింగ్‌లు',
    bookingsSubtitle: 'ఆలయంతో మీరు బుక్ చేసిన ప్రతిదాన్ని ట్రాక్ చేసి నిర్వహించండి.',
    bookingsEmptyTitle: 'ఇంకా బుకింగ్‌లు లేవు',
    bookingsEmptyDesc: 'మీ దర్శనం, సేవ, వసతి మరియు ప్రసాదం బుకింగ్‌లు ఇక్కడ కనిపిస్తాయి.',
    statusConfirmed: 'నిర్ధారించబడింది',
    statusPending: 'పెండింగ్‌లో ఉంది',
    statusCompleted: 'పూర్తయింది',
    statusCancelled: 'రద్దు చేయబడింది',
    cancelButton: 'రద్దు చేయండి',
    downloadButton: 'డౌన్‌లోడ్',
    filterAll: 'అన్నీ',
    filterUpcoming: 'రాబోయేవి',
    filterPast: 'గతం',
    columnType: 'రకం',
    columnDetails: 'వివరాలు',
    columnDate: 'తేదీ',
    columnStatus: 'స్థితి',
    columnAction: 'చర్య',

    facilitiesTitle: 'భక్తుల సదుపాయాలు',
    facilitiesSubtitle: 'మీ సందర్శనను సౌకర్యవంతంగా చేయడానికి దేవస్థానం అందించే ప్రతిదీ.',

    profileTitle: 'నా ప్రొఫైల్',
    profileSubtitle: 'మీ భక్తుల ఖాతా వివరాలను నిర్వహించండి.',
    profileNameLabel: 'పూర్తి పేరు',
    profileEmailLabel: 'ఇమెయిల్',
    profilePhoneLabel: 'మొబైల్ నంబర్',
    profileSaveButton: 'మార్పులను సేవ్ చేయండి',
    profileSavedToast: 'ప్రొఫైల్ నవీకరించబడింది.',

    footerAddress: '10-19-54, టెంపుల్ స్ట్రీట్, గుడవల్లి, ఆంధ్రప్రదేశ్, భారతదేశం',
    footerHelpline: '24×7 భక్తుల హెల్ప్‌లైన్: 1800-000-0000',
    footerCopyright: 'గుడవళ్లమ్మ ఆలయం · భక్తుల సేవల పోర్టల్ — ప్రదర్శన ఉద్దేశాల కోసం మాత్రమే.',
    footerPrivacyPolicy: 'గోప్యతా విధానం',
    footerTerms: 'నిబంధనలు & షరతులు',
    footerQuickLinks: 'త్వరిత లింకులు',
    footerContact: 'సంప్రదించండి',
  },
  hi: {
    appName: 'गुडवल्लम्मा मंदिर',
    appTagline: 'भक्त सेवा पोर्टल',
    languageLabel: 'भाषा',
    eyebrow: '|| ॐ श्री गुडवल्लम्मा देवी नमः ||',
    bookNow: 'अभी बुक करें',
    donateNow: 'अभी दान करें',
    watchNow: 'अभी देखें',
    viewAll: 'सभी देखें',
    free: 'निःशुल्क',
    perNight: '/ प्रति रात',
    perUnit: 'प्रति यूनिट',
    backToDashboard: 'डैशबोर्ड पर वापस जाएं',

    navHome: 'होम',
    navDarshan: 'दर्शन',
    navSeva: 'सेवा',
    navAccommodation: 'आवास',
    navPrasadam: 'प्रसादम',
    navDonations: 'दान',
    navLive: 'लाइव दर्शन',
    navBookings: 'मेरी बुकिंग',
    navFacilities: 'सुविधाएं',
    navProfile: 'प्रोफ़ाइल',
    navLogout: 'लॉगआउट',
    navLogin: 'भक्त लॉगिन',
    staffPortalLink: 'मंदिर स्टाफ लॉगिन',
    logoutSuccess: 'आप साइन आउट हो गए हैं।',

    loginBrandSubtitle: 'भक्त पोर्टल',
    loginHeroLine1: 'दर्शन, सेवा और आवास —',
    loginHeroHighlight: 'आप जहां भी हों.',
    loginHeroTagline:
      'अपना दर्शन स्लॉट, सेवा, आवास और प्रसादम ऑनलाइन बुक करें, और अपनी हर यात्रा एक ही भक्त खाते से प्रबंधित करें।',
    loginChipSecure: 'सुरक्षित भक्त साइन-इन',
    loginChipSupport: '24×7 भक्त हेल्पलाइन',
    loginTabTitle: 'भक्त लॉगिन',
    loginEmailLabel: 'ईमेल',
    loginEmailPlaceholder: 'you@example.com',
    loginPasswordLabel: 'पासवर्ड',
    loginPasswordPlaceholder: 'अपना पासवर्ड दर्ज करें',
    loginRememberMe: 'मुझे याद रखें',
    loginForgotPassword: 'पासवर्ड भूल गए?',
    loginSignIn: 'साइन इन',
    loginSigningIn: 'साइन इन हो रहा है...',
    loginNoAccount: 'नए भक्त हैं?',
    loginCreateAccount: 'मुफ़्त खाता बनाएं',
    loginStaffCross: 'मंदिर स्टाफ हैं? यहां साइन इन करें',
    loginTermsNote: 'जारी रखकर आप देवस्थानम ट्रस्ट की सेवा शर्तों और गोपनीयता नीति से सहमत होते हैं।',
    loginSuccessTitle: 'लॉगिन सफल',
    loginSuccessDetail: 'वापसी पर स्वागत है.',
    loginFailedTitle: 'लॉगिन विफल',
    errorInvalidEmail: 'एक वैध ईमेल पता दर्ज करें',
    errorPasswordMin: 'पासवर्ड कम से कम 8 अक्षरों का होना चाहिए',

    registerBrandSubtitle: 'भक्त पोर्टल',
    registerTitle: 'अपना भक्त खाता बनाएं',
    registerSubtitle: 'दर्शन, सेवा, आवास और प्रसादम ऑनलाइन बुक करने के लिए एक बार पंजीकरण करें।',
    firstNameLabel: 'पहला नाम',
    firstNamePlaceholder: 'पहला नाम',
    lastNameLabel: 'अंतिम नाम',
    lastNamePlaceholder: 'अंतिम नाम',
    emailLabel: 'ईमेल',
    emailPlaceholder: 'you@example.com',
    phoneLabel: 'मोबाइल नंबर',
    phonePlaceholder: '+91 98xxxxxx00',
    phoneHelper: 'वैकल्पिक — बुकिंग अपडेट के लिए उपयोग किया जाता है',
    passwordLabel: 'पासवर्ड',
    passwordPlaceholder: 'एक पासवर्ड बनाएं',
    confirmPasswordLabel: 'पासवर्ड की पुष्टि करें',
    confirmPasswordPlaceholder: 'पासवर्ड फिर से दर्ज करें',
    createAccountButton: 'खाता बनाएं',
    creatingAccount: 'खाता बनाया जा रहा है...',
    alreadyHaveAccount: 'क्या आपके पास पहले से खाता है?',
    signInLink: 'साइन इन',
    registerSuccessTitle: 'पंजीकरण सफल',
    registerSuccessDetail: 'आपका भक्त खाता बना दिया गया है। कृपया साइन इन करें।',
    registerFailedTitle: 'पंजीकरण विफल',
    errorFirstNameMin: 'पहला नाम कम से कम 2 अक्षरों का होना चाहिए',
    errorLastNameMin: 'अंतिम नाम कम से कम 2 अक्षरों का होना चाहिए',
    errorPhoneMin: 'मोबाइल नंबर कम से कम 8 अक्षरों का होना चाहिए',
    errorConfirmMismatch: 'पासवर्ड मेल खाना चाहिए',

    forgotTitle: 'अपना पासवर्ड रीसेट करें',
    forgotSubtitle: 'अपना ईमेल दर्ज करें और हम आपको एक रीसेट लिंक भेजेंगे।',
    forgotSendButton: 'रीसेट लिंक भेजें',
    forgotSending: 'भेजा जा रहा है...',
    forgotBackToSignIn: 'साइन इन पर वापस जाएं',
    forgotRequestFailedTitle: 'अनुरोध विफल',
    forgotResetSentTitle: 'रीसेट लिंक का अनुरोध किया गया',
    forgotDefaultSuccessMessage: 'यदि ईमेल मौजूद है, तो एक पासवर्ड रीसेट लिंक भेजा गया है।',

    welcomeBack: 'वापसी पर स्वागत है',
    quickActionsTitle: 'त्वरित कार्य',
    darshanCardTitle: 'दर्शन बुक करें',
    darshanCardDesc: 'सर्व दर्शन या विशेष प्रवेश दर्शन स्लॉट आरक्षित करें।',
    sevaCardTitle: 'सेवा बुक करें',
    sevaCardDesc: 'अर्चना, अभिषेकम, कल्याणोत्सवम और अधिक।',
    accommodationCardTitle: 'आवास बुक करें',
    accommodationCardDesc: 'चौल्ट्री, कॉटेज और डॉर्मिटरी कमरे।',
    prasadamCardTitle: 'प्रसादम ऑर्डर करें',
    prasadamCardDesc: 'लड्डू और मंदिर प्रसादम, घर पर डिलीवर।',
    donationCardTitle: 'दान / ई-हुंडी',
    donationCardDesc: 'सेवा और अन्नदानम के लिए योगदान करें।',
    liveCardTitle: 'लाइव दर्शन',
    liveCardDesc: 'गर्भगृह को लाइव देखें।',
    bookingsCardTitle: 'मेरी बुकिंग',
    bookingsCardDesc: 'अपनी आगामी यात्राओं को देखें और प्रबंधित करें।',
    facilitiesCardTitle: 'सुविधाएं',
    facilitiesCardDesc: 'क्लोक रूम, चिकित्सा सहायता, अन्नदानम और अधिक।',
    liveRightNowTitle: 'अभी लाइव',
    queueWaitLabel: 'वर्तमान कतार प्रतीक्षा',
    queueWaitUnit: 'मिनट',
    queueDevoteesLabel: 'आज दर्शन कतार में भक्त',
    nextFestivalLabel: 'आगामी उत्सव',
    festivalName: 'ब्रह्मोत्सवम',
    countdownDays: 'दिन',
    countdownHours: 'घंटे',
    countdownMinutes: 'मिनट',
    countdownSeconds: 'सेकंड',
    todayScheduleTitle: 'आज का कार्यक्रम',
    scheduleSuprabhatam: 'सुप्रभात सेवा',
    scheduleSarvaDarshan: 'सर्व दर्शन',
    scheduleArchana: 'अर्चना / अभिषेकम',
    scheduleEkanta: 'एकांत सेवा',

    darshanTitle: 'दर्शन टिकट बुक करें',
    darshanSubtitle: 'एक तारीख चुनें, अपना दर्शन कोटा चुनें, और भक्तों की संख्या की पुष्टि करें।',
    calendarLabel: 'तारीख चुनें',
    quotaSarvaName: 'सर्व दर्शन',
    quotaSarvaDesc: 'निःशुल्क · सामान्य कतार लाइन',
    quotaSpecialName: 'विशेष प्रवेश दर्शन',
    quotaSpecialDesc: 'प्राथमिकता कतार · कम प्रतीक्षा',
    quotaSeniorName: 'वरिष्ठ नागरिक / दिव्यांगजन',
    quotaSeniorDesc: 'निःशुल्क · समर्पित प्राथमिकता लाइन',
    devoteesLabel: 'भक्त',
    maxNote: '(प्रति बुकिंग अधिकतम 5)',
    selectedDateLabel: 'चयनित तारीख',
    quotaLabel: 'कोटा',
    totalLabel: 'कुल राशि',
    noDateSelected: '—',
    proceedButton: 'भुगतान के लिए आगे बढ़ें',
    selectDateFirst: 'कृपया पहले एक तारीख चुनें।',

    sevaTitle: 'सेवा बुक करें',
    sevaSubtitle: 'गर्भगृह के भीतर की जाने वाली नित्य पूजाओं में भाग लें।',
    categoryParoksha: 'परोक्ष सेवा',
    categoryParokshaDesc: 'कहीं से भी पूजा करवाएं — आपकी ओर से की जाती है और ऑनलाइन प्रसारित की जाती है।',
    categoryPratyaksha: 'प्रत्यक्ष सेवा',
    categoryPratyakshaDesc: 'पूजा के लिए आपको स्वयं मंदिर में उपस्थित रहना होगा।',
    categorySaswata: 'शाश्वत सेवा',
    categorySaswataDesc: 'एकमुश्त दान जो हर साल स्थायी रूप से इस सेवा को प्रायोजित करता है।',
    limitedSlots: 'प्रतिदिन सीमित स्लॉट',
    bookSeva: 'सेवा बुक करें',
    oneTime: 'एकमुश्त',

    accommodationTitle: 'आवास',
    accommodationSubtitle: 'मंदिर के पास चौल्ट्री, कॉटेज और डॉर्मिटरी कमरों में से चुनें।',
    availabilityNote: 'उपलब्धता के अनुसार',
    bookStay: 'आवास बुक करें',

    donationTitle: 'दान',
    donationSubtitle: 'दुनिया में कहीं से भी मंदिर सेवा, अन्नदानम और ट्रस्ट कार्यों का समर्थन करें।',
    hundiTitle: 'ई-हुंडी',
    hundiDesc: 'मंदिर के कल्याण और रखरखाव के लिए सामान्य दान।',
    annadanamTitle: 'अन्नदानम ट्रस्ट',
    annadanamDesc: 'तीर्थयात्रियों को रोज़ाना परोसे जाने वाले मुफ़्त भोजन को प्रायोजित करें।',
    goSamrakshanaTitle: 'गो संरक्षण ट्रस्ट',
    goSamrakshanaDesc: 'मंदिर की गौशाला का समर्थन करें।',
    chooseAmount: 'राशि चुनें',
    customAmount: 'अन्य राशि',
    customAmountPlaceholder: 'राशि दर्ज करें',
    taxNote: 'दान लागू कानून के तहत कर लाभ के लिए पात्र हो सकते हैं। रसीद आपको ईमेल की जाएगी।',

    prasadamTitle: 'प्रसादम ऑर्डर करें',
    prasadamSubtitle: 'पवित्र नैवेद्य, ताज़ा पैक किए गए और आपके द्वार तक भेजे गए।',
    cartItems: 'वस्तुएं',
    cartTotal: 'कार्ट कुल',
    checkoutButton: 'चेकआउट',
    emptyCart: 'आपका कार्ट खाली है। शुरू करने के लिए कुछ वस्तुएं जोड़ें।',

    liveTitle: 'लाइव दर्शन',
    liveSubtitle: 'दुनिया में कहीं से भी गर्भगृह को वास्तविक समय में देखें।',
    liveBadge: 'लाइव',
    camGarbhagriha: 'गर्भगृह दृश्य',
    camQueue: 'कतार परिसर',
    camTower: 'मंदिर शिखर',
    liveNote:
      'गर्भगृह को जैसे रखा जाता है वैसे ही धीमी रोशनी और शांति के साथ प्रसारित किया जाता है — यह एक भक्ति सेवा है; व्यक्तिगत दर्शन का कोई विकल्प नहीं है।',
    queueStatusTitle: 'कतार की स्थिति',
    sarvaLine: 'सर्व दर्शन लाइन',
    specialLine: 'विशेष प्रवेश लाइन',
    seniorLine: 'वरिष्ठ नागरिक लाइन',

    bookingsTitle: 'मेरी बुकिंग',
    bookingsSubtitle: 'मंदिर के साथ आपकी सभी बुकिंग को ट्रैक और प्रबंधित करें।',
    bookingsEmptyTitle: 'अभी तक कोई बुकिंग नहीं',
    bookingsEmptyDesc: 'आपकी दर्शन, सेवा, आवास और प्रसादम बुकिंग यहां दिखाई देंगी।',
    statusConfirmed: 'पुष्टि की गई',
    statusPending: 'लंबित',
    statusCompleted: 'पूर्ण',
    statusCancelled: 'रद्द',
    cancelButton: 'रद्द करें',
    downloadButton: 'डाउनलोड',
    filterAll: 'सभी',
    filterUpcoming: 'आगामी',
    filterPast: 'पूर्व',
    columnType: 'प्रकार',
    columnDetails: 'विवरण',
    columnDate: 'तारीख',
    columnStatus: 'स्थिति',
    columnAction: 'कार्रवाई',

    facilitiesTitle: 'भक्त सुविधाएं',
    facilitiesSubtitle: 'आपकी यात्रा को आरामदायक बनाने के लिए देवस्थानम द्वारा प्रदान की जाने वाली हर चीज़।',

    profileTitle: 'मेरी प्रोफ़ाइल',
    profileSubtitle: 'अपने भक्त खाते का विवरण प्रबंधित करें।',
    profileNameLabel: 'पूरा नाम',
    profileEmailLabel: 'ईमेल',
    profilePhoneLabel: 'मोबाइल नंबर',
    profileSaveButton: 'बदलाव सहेजें',
    profileSavedToast: 'प्रोफ़ाइल अपडेट हो गई।',

    footerAddress: '10-19-54, टेम्पल स्ट्रीट, गुडवल्ली, आंध्र प्रदेश, भारत',
    footerHelpline: '24×7 भक्त हेल्पलाइन: 1800-000-0000',
    footerCopyright: 'गुडवल्लम्मा मंदिर · भक्त सेवा पोर्टल — केवल प्रदर्शन उद्देश्यों के लिए।',
    footerPrivacyPolicy: 'गोपनीयता नीति',
    footerTerms: 'नियम और शर्तें',
    footerQuickLinks: 'त्वरित लिंक',
    footerContact: 'संपर्क करें',
  },
}
