import type { DevoteeLanguageCode } from './devoteeTranslations'

export type SevaCategory = 'paroksha' | 'pratyaksha' | 'saswata'

export interface SevaCatalogItem {
  id: string
  category: SevaCategory
  name: string
  timing: string
  price: number
}

export interface AccommodationCatalogItem {
  id: string
  name: string
  detail: string
  pricePerNight: number
}

export interface PrasadamCatalogItem {
  id: string
  name: string
  price: number
}

export interface FacilityCatalogItem {
  id: string
  name: string
  description: string
}

export const sevaCatalog: Record<DevoteeLanguageCode, SevaCatalogItem[]> = {
  en: [
    { id: 'suprabhatam', category: 'pratyaksha', name: 'Suprabhata Seva', timing: '4:30 AM daily', price: 120 },
    { id: 'archana', category: 'pratyaksha', name: 'Archana', timing: '7:00 – 10:00 AM daily', price: 50 },
    { id: 'kalyanotsavam', category: 'pratyaksha', name: 'Kalyanotsavam', timing: '8:00 AM daily', price: 1000 },
    { id: 'sahasranamam', category: 'paroksha', name: 'Sahasranama Archana', timing: '9:00 AM daily', price: 250 },
    { id: 'abhishekam', category: 'paroksha', name: 'Abhishekam (Paroksha)', timing: '5:00 AM (Wed & Sat)', price: 500 },
    { id: 'vastralankarana', category: 'paroksha', name: 'Vastralankarana Seva', timing: '6:00 AM (Sun)', price: 750 },
    { id: 'nitya-deeparadhana', category: 'saswata', name: 'Nitya Deeparadhana Saswata Seva', timing: 'Daily, in perpetuity', price: 5000 },
    { id: 'vardhanti', category: 'saswata', name: 'Vardhanti (Birthday) Saswata Seva', timing: 'Annually, on your birth star day', price: 10000 },
    { id: 'kalyanotsava-saswata', category: 'saswata', name: 'Kalyanotsava Saswata Seva', timing: 'Annually, in perpetuity', price: 25000 },
  ],
  te: [
    { id: 'suprabhatam', category: 'pratyaksha', name: 'సుప్రభాత సేవ', timing: 'ప్రతిరోజు ఉదయం 4:30', price: 120 },
    { id: 'archana', category: 'pratyaksha', name: 'అర్చన', timing: 'ప్రతిరోజు ఉదయం 7:00 – 10:00', price: 50 },
    { id: 'kalyanotsavam', category: 'pratyaksha', name: 'కళ్యాణోత్సవం', timing: 'ప్రతిరోజు ఉదయం 8:00', price: 1000 },
    { id: 'sahasranamam', category: 'paroksha', name: 'సహస్రనామ అర్చన', timing: 'ప్రతిరోజు ఉదయం 9:00', price: 250 },
    { id: 'abhishekam', category: 'paroksha', name: 'అభిషేకం (పరోక్ష)', timing: 'ఉదయం 5:00 (బుధ & శని)', price: 500 },
    { id: 'vastralankarana', category: 'paroksha', name: 'వస్త్రాలంకరణ సేవ', timing: 'ఉదయం 6:00 (ఆది)', price: 750 },
    { id: 'nitya-deeparadhana', category: 'saswata', name: 'నిత్య దీపారాధన శాశ్వత సేవ', timing: 'ప్రతిరోజు, శాశ్వతంగా', price: 5000 },
    { id: 'vardhanti', category: 'saswata', name: 'వర్ధంతి (జన్మదిన) శాశ్వత సేవ', timing: 'ప్రతి సంవత్సరం, మీ జన్మ నక్షత్రం రోజున', price: 10000 },
    { id: 'kalyanotsava-saswata', category: 'saswata', name: 'కళ్యాణోత్సవ శాశ్వత సేవ', timing: 'ప్రతి సంవత్సరం, శాశ్వతంగా', price: 25000 },
  ],
  hi: [
    { id: 'suprabhatam', category: 'pratyaksha', name: 'सुप्रभात सेवा', timing: 'प्रतिदिन सुबह 4:30', price: 120 },
    { id: 'archana', category: 'pratyaksha', name: 'अर्चना', timing: 'प्रतिदिन सुबह 7:00 – 10:00', price: 50 },
    { id: 'kalyanotsavam', category: 'pratyaksha', name: 'कल्याणोत्सवम', timing: 'प्रतिदिन सुबह 8:00', price: 1000 },
    { id: 'sahasranamam', category: 'paroksha', name: 'सहस्रनाम अर्चना', timing: 'प्रतिदिन सुबह 9:00', price: 250 },
    { id: 'abhishekam', category: 'paroksha', name: 'अभिषेकम (परोक्ष)', timing: 'सुबह 5:00 (बुध व शनि)', price: 500 },
    { id: 'vastralankarana', category: 'paroksha', name: 'वस्त्रालंकरण सेवा', timing: 'सुबह 6:00 (रवि)', price: 750 },
    { id: 'nitya-deeparadhana', category: 'saswata', name: 'नित्य दीपाराधना शाश्वत सेवा', timing: 'प्रतिदिन, स्थायी रूप से', price: 5000 },
    { id: 'vardhanti', category: 'saswata', name: 'वर्धंती (जन्मदिन) शाश्वत सेवा', timing: 'प्रति वर्ष, आपके जन्म नक्षत्र के दिन', price: 10000 },
    { id: 'kalyanotsava-saswata', category: 'saswata', name: 'कल्याणोत्सव शाश्वत सेवा', timing: 'प्रति वर्ष, स्थायी रूप से', price: 25000 },
  ],
}

export const accommodationCatalog: Record<DevoteeLanguageCode, AccommodationCatalogItem[]> = {
  en: [
    { id: 'choultry', name: 'Devotee Choultry', detail: 'Shared hall · Donation based', pricePerNight: 0 },
    { id: 'non-ac', name: 'Non-AC Room', detail: '2 beds · Attached bath', pricePerNight: 500 },
    { id: 'ac-cottage', name: 'AC Cottage', detail: '2 beds · Premium amenities', pricePerNight: 1800 },
    { id: 'dormitory', name: 'Dormitory Bed', detail: 'Single bed · Common facility', pricePerNight: 100 },
  ],
  te: [
    { id: 'choultry', name: 'భక్తుల చౌల్ట్రీ', detail: 'ఉమ్మడి హాలు · విరాళం ఆధారంగా', pricePerNight: 0 },
    { id: 'non-ac', name: 'నాన్-ఏసీ గది', detail: '2 పడకలు · అనుబంధ బాత్రూమ్', pricePerNight: 500 },
    { id: 'ac-cottage', name: 'ఏసీ కాటేజీ', detail: '2 పడకలు · ప్రీమియం సౌకర్యాలు', pricePerNight: 1800 },
    { id: 'dormitory', name: 'డార్మిటరీ బెడ్', detail: 'ఒంటి పడక · సాధారణ సదుపాయం', pricePerNight: 100 },
  ],
  hi: [
    { id: 'choultry', name: 'भक्त चौल्ट्री', detail: 'साझा हॉल · दान आधारित', pricePerNight: 0 },
    { id: 'non-ac', name: 'नॉन-एसी रूम', detail: '2 बेड · अटैच्ड बाथरूम', pricePerNight: 500 },
    { id: 'ac-cottage', name: 'एसी कॉटेज', detail: '2 बेड · प्रीमियम सुविधाएं', pricePerNight: 1800 },
    { id: 'dormitory', name: 'डॉर्मिटरी बेड', detail: 'एक बेड · सामान्य सुविधा', pricePerNight: 100 },
  ],
}

export const prasadamCatalog: Record<DevoteeLanguageCode, PrasadamCatalogItem[]> = {
  en: [
    { id: 'laddu-2', name: 'Laddu (Box of 2)', price: 50 },
    { id: 'laddu-5', name: 'Laddu (Box of 5)', price: 120 },
    { id: 'pulihora', name: 'Pulihora Packet', price: 40 },
    { id: 'payasam', name: 'Payasam Cup', price: 60 },
  ],
  te: [
    { id: 'laddu-2', name: 'లడ్డూ (2 బాక్స్)', price: 50 },
    { id: 'laddu-5', name: 'లడ్డూ (5 బాక్స్)', price: 120 },
    { id: 'pulihora', name: 'పులిహోర పాకెట్', price: 40 },
    { id: 'payasam', name: 'పాయసం కప్పు', price: 60 },
  ],
  hi: [
    { id: 'laddu-2', name: 'लड्डू (2 का बॉक्स)', price: 50 },
    { id: 'laddu-5', name: 'लड्डू (5 का बॉक्स)', price: 120 },
    { id: 'pulihora', name: 'पुलिहोरा पैकेट', price: 40 },
    { id: 'payasam', name: 'पायसम कप', price: 60 },
  ],
}

export const facilityCatalog: Record<DevoteeLanguageCode, FacilityCatalogItem[]> = {
  en: [
    { id: 'cloak', name: 'Cloak Room & Locker', description: 'Safe storage for footwear & belongings' },
    { id: 'wheelchair', name: 'Wheelchair & Palki Seva', description: 'Free assistance for elderly & disabled devotees' },
    { id: 'annadanam', name: 'Annadanam', description: 'Free meals served daily 11 AM – 3 PM' },
    { id: 'medical', name: 'Medical Aid Center', description: '24/7 first-aid & emergency care' },
    { id: 'parking', name: 'Parking & E-Buggy', description: 'Vehicle parking with free e-buggy shuttle' },
    { id: 'helpdesk', name: 'Multilingual Help Desk', description: 'Assistance in Telugu, Hindi & English' },
    { id: 'lostfound', name: 'Lost & Found', description: 'Report or claim misplaced items' },
    { id: 'restrooms', name: 'Rest Rooms & Dormitory', description: 'Clean rest areas for pilgrims' },
    { id: 'wifi', name: 'Free Wi-Fi Zones', description: 'Connectivity across the temple complex' },
    { id: 'cctv', name: 'CCTV & Safety Grid', description: 'Round the clock surveillance & security' },
    { id: 'senior', name: 'Senior Citizen Priority', description: 'Dedicated fast-track darshan queue' },
    { id: 'footwear', name: 'Footwear Counter', description: 'Free footwear stand at all entry gates' },
  ],
  te: [
    { id: 'cloak', name: 'క్లోక్ రూమ్ & లాకర్', description: 'పాదరక్షలు & వస్తువుల భద్రమైన నిల్వ' },
    { id: 'wheelchair', name: 'వీల్‌చైర్ & పల్కీ సేవ', description: 'వృద్ధులు & దివ్యాంగుల భక్తులకు ఉచిత సహాయం' },
    { id: 'annadanam', name: 'అన్నదానం', description: 'ప్రతిరోజు ఉదయం 11 – మధ్యాహ్నం 3 వరకు ఉచిత భోజనం' },
    { id: 'medical', name: 'వైద్య సహాయ కేంద్రం', description: '24/7 ప్రథమ చికిత్స & అత్యవసర సంరక్షణ' },
    { id: 'parking', name: 'పార్కింగ్ & ఈ-బగ్గీ', description: 'ఉచిత ఈ-బగ్గీ షటిల్‌తో వాహన పార్కింగ్' },
    { id: 'helpdesk', name: 'బహుభాషా హెల్ప్ డెస్క్', description: 'తెలుగు, హిందీ & ఇంగ్లీష్‌లలో సహాయం' },
    { id: 'lostfound', name: 'పోయిన వస్తువులు', description: 'తప్పిపోయిన వస్తువులను నివేదించండి లేదా క్లెయిమ్ చేయండి' },
    { id: 'restrooms', name: 'రెస్ట్ రూమ్‌లు & డార్మిటరీ', description: 'యాత్రికుల కోసం పరిశుభ్రమైన విశ్రాంతి ప్రాంతాలు' },
    { id: 'wifi', name: 'ఉచిత వై-ఫై జోన్‌లు', description: 'ఆలయ ప్రాంగణం అంతటా కనెక్టివిటీ' },
    { id: 'cctv', name: 'సీసీటీవీ & భద్రతా గ్రిడ్', description: 'రౌండ్ ది క్లాక్ నిఘా & సెక్యూరిటీ' },
    { id: 'senior', name: 'వృద్ధుల ప్రాధాన్యత', description: 'ప్రత్యేక ఫాస్ట్-ట్రాక్ దర్శన క్యూ' },
    { id: 'footwear', name: 'పాదరక్షల కౌంటర్', description: 'అన్ని ప్రవేశ ద్వారాల వద్ద ఉచిత పాదరక్షల స్టాండ్' },
  ],
  hi: [
    { id: 'cloak', name: 'क्लोक रूम और लॉकर', description: 'जूते-चप्पल और सामान के लिए सुरक्षित भंडारण' },
    { id: 'wheelchair', name: 'व्हीलचेयर और पालकी सेवा', description: 'वृद्ध और दिव्यांग भक्तों के लिए मुफ़्त सहायता' },
    { id: 'annadanam', name: 'अन्नदानम', description: 'प्रतिदिन सुबह 11 से दोपहर 3 बजे तक मुफ़्त भोजन' },
    { id: 'medical', name: 'मेडिकल सहायता केंद्र', description: '24/7 प्राथमिक चिकित्सा और आपातकालीन सेवा' },
    { id: 'parking', name: 'पार्किंग और ई-बग्गी', description: 'मुफ़्त ई-बग्गी शटल के साथ वाहन पार्किंग' },
    { id: 'helpdesk', name: 'बहुभाषी हेल्प डेस्क', description: 'तेलुगु, हिंदी और अंग्रेज़ी में सहायता' },
    { id: 'lostfound', name: 'खोया-पाया', description: 'खोई हुई वस्तुओं की रिपोर्ट करें या दावा करें' },
    { id: 'restrooms', name: 'रेस्ट रूम और डॉर्मिटरी', description: 'तीर्थयात्रियों के लिए स्वच्छ विश्राम क्षेत्र' },
    { id: 'wifi', name: 'मुफ़्त वाई-फाई ज़ोन', description: 'मंदिर परिसर में कनेक्टिविटी' },
    { id: 'cctv', name: 'सीसीटीवी और सुरक्षा ग्रिड', description: 'चौबीसों घंटे निगरानी और सुरक्षा' },
    { id: 'senior', name: 'वरिष्ठ नागरिक प्राथमिकता', description: 'समर्पित फ़ास्ट-ट्रैक दर्शन कतार' },
    { id: 'footwear', name: 'जूता काउंटर', description: 'सभी प्रवेश द्वारों पर मुफ़्त जूता स्टैंड' },
  ],
}
