export type LoginLanguageCode = 'en' | 'te' | 'hi'

export interface LoginTranslationStrings {
  brandName: string
  brandSubtitle: string
  languageLabel: string
  eyebrow: string
  heroTitleLine1: string
  heroTitleHighlight: string
  heroTagline: string
  chipSecure: string
  chipSupport: string
  tabLogin: string
  emailLabel: string
  emailPlaceholder: string
  passwordLabel: string
  passwordPlaceholder: string
  rememberMe: string
  forgotPassword: string
  signIn: string
  signingIn: string
  devoteeCross: string
  termsNote: string
  loginFailedTitle: string
  loginSuccessTitle: string
  loginSuccessDetail: string
  errorInvalidEmail: string
  errorPasswordMin: string
}

export type LoginTranslationKey = keyof LoginTranslationStrings

export const LOGIN_LANGUAGES: { code: LoginLanguageCode; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'te', label: 'తెలుగు' },
  { code: 'hi', label: 'हिन्दी' },
]

export const loginTranslations: Record<LoginLanguageCode, LoginTranslationStrings> = {
  en: {
    brandName: 'Gudavalamma Temple',
    brandSubtitle: 'ADMINISTRATION PORTAL',
    languageLabel: 'Language',
    eyebrow: '|| Om Sri Gudavalamma Devi Namaha ||',
    heroTitleLine1: 'Temple Administration,',
    heroTitleHighlight: 'Made Simple.',
    heroTagline:
      'Sign in to manage darshan schedules, sevas, staff records and trust operations — all in one secure portal.',
    chipSecure: 'Secure staff sign-in',
    chipSupport: '24×7 helpdesk support',
    tabLogin: 'Staff Login',
    emailLabel: 'Email',
    emailPlaceholder: 'you@example.com',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Enter your password',
    rememberMe: 'Remember me',
    forgotPassword: 'Forgot password?',
    signIn: 'Sign in',
    signingIn: 'Signing in...',
    devoteeCross: 'Are you a devotee? Sign in to the devotee portal here',
    termsNote: "By continuing you agree to the Devasthanam Trust's Terms of Service & Privacy Policy.",
    loginFailedTitle: 'Login failed',
    loginSuccessTitle: 'Login successful',
    loginSuccessDetail: 'Welcome back.',
    errorInvalidEmail: 'Enter a valid email address',
    errorPasswordMin: 'Password must be at least 8 characters',
  },
  te: {
    brandName: 'గుడవళ్లమ్మ ఆలయం',
    brandSubtitle: 'పరిపాలన పోర్టల్',
    languageLabel: 'భాష',
    eyebrow: '|| ఓం శ్రీ గుడవళ్లమ్మ దేవి నమః ||',
    heroTitleLine1: 'ఆలయ నిర్వహణ,',
    heroTitleHighlight: 'సులభతరం.',
    heroTagline:
      'దర్శన షెడ్యూళ్లు, సేవలు, సిబ్బంది వివరాలు మరియు ట్రస్ట్ కార్యకలాపాలను నిర్వహించడానికి సైన్ ఇన్ చేయండి — అన్నీ ఒకే సురక్షిత పోర్టల్‌లో.',
    chipSecure: 'సురక్షిత సిబ్బంది లాగిన్',
    chipSupport: '24×7 హెల్ప్‌డెస్క్ మద్దతు',
    tabLogin: 'సిబ్బంది లాగిన్',
    emailLabel: 'ఇమెయిల్',
    emailPlaceholder: 'you@example.com',
    passwordLabel: 'పాస్‌వర్డ్',
    passwordPlaceholder: 'మీ పాస్‌వర్డ్ నమోదు చేయండి',
    rememberMe: 'నన్ను గుర్తుంచుకో',
    forgotPassword: 'పాస్‌వర్డ్ మర్చిపోయారా?',
    signIn: 'సైన్ ఇన్',
    signingIn: 'సైన్ ఇన్ చేస్తోంది...',
    devoteeCross: 'మీరు భక్తులా? భక్తుల పోర్టల్‌లో ఇక్కడ సైన్ ఇన్ చేయండి',
    termsNote: 'కొనసాగించడం ద్వారా మీరు దేవస్థానం ట్రస్ట్ నిబంధనలు & గోప్యతా విధానానికి అంగీకరిస్తున్నారు.',
    loginFailedTitle: 'లాగిన్ విఫలమైంది',
    loginSuccessTitle: 'లాగిన్ విజయవంతమైంది',
    loginSuccessDetail: 'మళ్ళీ స్వాగతం.',
    errorInvalidEmail: 'సరైన ఇమెయిల్ చిరునామాను నమోదు చేయండి',
    errorPasswordMin: 'పాస్‌వర్డ్ కనీసం 8 అక్షరాలు ఉండాలి',
  },
  hi: {
    brandName: 'गुडवल्लम्मा मंदिर',
    brandSubtitle: 'प्रशासन पोर्टल',
    languageLabel: 'भाषा',
    eyebrow: '|| ॐ श्री गुडवल्लम्मा देवी नमः ||',
    heroTitleLine1: 'मंदिर प्रशासन,',
    heroTitleHighlight: 'अब आसान.',
    heroTagline:
      'दर्शन शेड्यूल, सेवा, स्टाफ रिकॉर्ड और ट्रस्ट कार्यों को प्रबंधित करने के लिए साइन इन करें — सब कुछ एक सुरक्षित पोर्टल में।',
    chipSecure: 'सुरक्षित स्टाफ साइन-इन',
    chipSupport: '24×7 हेल्पडेस्क सहायता',
    tabLogin: 'स्टाफ लॉगिन',
    emailLabel: 'ईमेल',
    emailPlaceholder: 'you@example.com',
    passwordLabel: 'पासवर्ड',
    passwordPlaceholder: 'अपना पासवर्ड दर्ज करें',
    rememberMe: 'मुझे याद रखें',
    forgotPassword: 'पासवर्ड भूल गए?',
    signIn: 'साइन इन',
    signingIn: 'साइन इन हो रहा है...',
    devoteeCross: 'क्या आप भक्त हैं? भक्त पोर्टल में यहां साइन इन करें',
    termsNote: 'जारी रखकर आप देवस्थानम ट्रस्ट की सेवा शर्तों और गोपनीयता नीति से सहमत होते हैं।',
    loginFailedTitle: 'लॉगिन विफल',
    loginSuccessTitle: 'लॉगिन सफल',
    loginSuccessDetail: 'वापसी पर स्वागत है.',
    errorInvalidEmail: 'एक वैध ईमेल पता दर्ज करें',
    errorPasswordMin: 'पासवर्ड कम से कम 8 अक्षरों का होना चाहिए',
  },
}
