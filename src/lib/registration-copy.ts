import type { Language } from '@/lib/language';

export type LocaleText = Record<Language, string>;
export type RegistrationOption = { value: string; label: LocaleText };
export type RegistrationFieldDefinition = {
  name: string;
  label: LocaleText;
  type?: string;
  options?: RegistrationOption[];
  required?: boolean;
  full?: boolean;
  placeholder?: LocaleText;
  badge?: string;
  maxWords?: number;
};

const text = (bn: string, en: string): LocaleText => ({ bn, en });
const option = (value: string, bn: string, en: string): RegistrationOption => ({
  value,
  label: text(bn, en),
});
const selectPrompt = option('', 'নির্বাচন করুন', 'Select an option');

const divisionOptions = [
  selectPrompt,
  option('dhaka',      'ঢাকা',        'Dhaka'),
  option('chattogram', 'চট্টগ্রাম',   'Chattogram'),
  option('rajshahi',   'রাজশাহী',     'Rajshahi'),
  option('khulna',     'খুলনা',       'Khulna'),
  option('barishal',   'বরিশাল',     'Barishal'),
  option('sylhet',     'সিলেট',       'Sylhet'),
  option('rangpur',    'রংপুর',      'Rangpur'),
  option('mymensingh', 'ময়মনসিংহ',   'Mymensingh'),
];
const yesNoOptions = [selectPrompt, option('yes', 'হ্যাঁ', 'Yes'), option('no', 'না', 'No')];
const siblingRelationOptions = [selectPrompt, option('brother', 'ভাই', 'Brother'), option('sister', 'বোন', 'Sister')];
const siblingMaritalStatusOptions = [selectPrompt, option('never-married', 'কখনো বিয়ে করেননি', 'Never Married'), option('married', 'বিবাহিত', 'Married'), option('divorced', 'বিচ্ছেদ', 'Divorced'), option('widowed', 'বিধবা / বিধুর', 'Widowed')];

export const registrationSections: {
  title: LocaleText;
  subtitle: LocaleText;
  fields: RegistrationFieldDefinition[];
}[] = [
  {
    title: text('ব্যক্তিগত ও যোগাযোগ', 'Personal & contact'),
    subtitle: text('নিজের পরিচয়, যোগাযোগ এবং অবস্থানের তথ্য দিন.', 'Share your identity, contact, and location details.'),
    fields: [
      { name: 'fullName', label: text('পূর্ণ নাম', 'Full name'), required: true, placeholder: text('আপনার নাম লিখুন', 'Enter your name') },
      { name: 'surname', label: text('পদবি / শেষ নাম', 'Surname') },
      { name: 'gender', label: text('লিঙ্গ', 'Gender'), type: 'select', required: true, options: [selectPrompt, option('man', 'পুরুষ', 'Man'), option('woman', 'নারী', 'Woman'), option('other', 'অন্যান্য / বলতে অনিচ্ছুক', 'Other / prefer not to say')] },
      { name: 'birthDate', label: text('জন্মতারিখ', 'Date of birth'), type: 'date', required: true },
      { name: 'bloodGroup', label: text('রক্তের গ্রুপ', 'Blood group'), type: 'select', options: [option('', 'জানা নেই', 'Not known'), ...['A+', 'A−', 'B+', 'B−', 'AB+', 'AB−', 'O+', 'O−'].map((group) => option(group, group, group))] },
      { name: 'religion', label: text('ধর্ম', 'Religion'), required: true, placeholder: text('যেমন: ইসলাম(সুন্নী)', 'e.g. Islam(Sunni)') },
      { name: 'nationality', label: text('জাতীয়তা', 'Nationality'), required: true, placeholder: text('যেমন: বাংলাদেশী', 'e.g. Bangladeshi') },
      { name: 'skinColor', label: text('চামড়ার রং', 'Skin Color'), type: 'select', options: [selectPrompt, option('light-fair', 'লাইট ফেয়ার', 'Light Fair'), option('fair', 'ফেয়ার', 'Fair'), option('medium', 'মিডিয়াম', 'Medium'), option('wheatish', 'গমবর্ণী', 'Wheatish'), option('dark', 'ডার্ক', 'Dark')] },
      { name: 'maritalStatus', label: text('বিবাহের অবস্থান', 'Marital Status'), type: 'select', options: [selectPrompt, option('never-married', 'কখনো বিয়ে করেননি', 'Never Married'), option('married', 'বিবাহিত', 'Married'), option('divorced', 'বিচ্ছেদ', 'Divorced'), option('widowed', 'বিধবা / বিধুর', 'Widowed')] },
      { name: 'height', label: text('উচ্চতা', 'Height'), placeholder: text('যেমন: ৫′৭″', 'e.g. 5\'7"') },
      { name: 'weight', label: text('ওজন (কেজি)', 'Weight (kg)'), placeholder: text('যেমন: ৭০', 'e.g. 70') },
      { name: 'children', label: text('সন্তান', 'Children'), type: 'select', options: [selectPrompt, option('none', 'কোনো নেই', 'None'), option('one', '১ জন', '1'), option('two', '২ জন', '2'), option('three', '৩ জন', '3'), option('four-plus', '৪ বা তার বেশি', '4+')] },
      { name: 'lastEducationLevel', label: text('শেষ শিক্ষাগত যোগ্যতা', 'Last Education Level'), type: 'select', options: [selectPrompt, option('phd', 'পিএইচডি', 'PhD'), option('masters', 'মাস্টার্স', "Master's"), option('bachelors', 'ব্যাচেলর্স', "Bachelor's"), option('hsc', 'এইচএসসি', 'HSC / Intermediate'), option('ssc', 'এসএসসি', 'SSC / Secondary')] },
      { name: 'educationInstituteName', label: text('শিক্ষা প্রতিষ্ঠানের নাম', 'Education Institute Name'), placeholder: text('যেমন: ঢাকা বিশ্ববিদ্যালয়', 'e.g. University of Dhaka') },
      { name: 'phone', label: text('মোবাইল নম্বর (WhatsApp)', 'Phone number (WhatsApp)'), type: 'tel', required: true, badge: 'PRIVATE', placeholder: text('যেমন: ০১৭১২৩৪৫৬৭৮৯', 'e.g. +880 1XXXXXXXXX') },
      { name: 'email', label: text('ইমেইল', 'Email'), type: 'email', badge: 'PRIVATE', placeholder: text('আপনার ইমেইল ঠিকানা', 'Your email address') },
      { name: 'guardianName', label: text('অভিভাবকের নাম', 'Guardian’s Name'), badge: 'PRIVATE', placeholder: text('অভিভাবকের পুরো নাম লিখুন', "Enter guardian's full name") },
      { name: 'guardianRelation', label: text('অভিভাবকের সাথে সম্পর্ক', 'Relationship to Guardian'), badge: 'PRIVATE', type: 'select', options: [selectPrompt, option('father', 'পিতা', 'Father'), option('mother', 'মাতা', 'Mother'), option('brother', 'ভাই', 'Brother'), option('sister', 'বোন', 'Sister'), option('other', 'অন্যান্য', 'Other')] },
      { name: 'guardianPhone', label: text('অভিভাবকের WhatsApp নম্বর', "Guardian's WhatsApp Number"), badge: 'PRIVATE', type: 'tel', placeholder: text('যেমন: ০১৭১২৩৪৫৬৭৮৯', 'e.g. +880 1XXXXXXXXX') },
      { name: 'guardianAge', label: text('অভিভাবকের বয়স', "Guardian's Age"), badge: 'PRIVATE', type: 'number', placeholder: text('যেমন: ৫৫', 'e.g. 55') },
      { name: 'country', label: text('দেশ', 'Country'), required: true, placeholder: text('দেশের নাম', 'Country name') },
      { name: 'city', label: text('শহর / জেলা', 'City / district'), required: true, placeholder: text('শহর বা জেলার নাম', 'City or district') },
      { name: 'presentHouseRoad',  label: text('বাড়ি / রাস্তা', 'House / Road'), badge: 'PRIVATE', placeholder: text('বাড়ি নম্বর ও রাস্তার নাম', 'House no. and road name') },
      { name: 'presentThana',      label: text('থানা / উপজেলা', 'Thana / Upazila'), badge: 'PRIVATE', placeholder: text('থানার নাম', 'Thana name') },
      { name: 'presentDistrict',   label: text('জেলা', 'District'), badge: 'PRIVATE', placeholder: text('জেলার নাম', 'District name') },
      { name: 'presentDivision',   label: text('বিভাগ', 'Division'), badge: 'PRIVATE', type: 'select', options: divisionOptions },
      { name: 'permanentVillage',  label: text('গ্রাম', 'Village'), badge: 'PRIVATE', placeholder: text('গ্রামের নাম', 'Village name') },
      { name: 'permanentThana',    label: text('থানা / উপজেলা', 'Thana / Upazila'), badge: 'PRIVATE', placeholder: text('থানার নাম', 'Thana name') },
      { name: 'permanentDistrict', label: text('জেলা', 'District'), badge: 'PRIVATE', placeholder: text('জেলার নাম', 'District name') },
      { name: 'permanentDivision', label: text('বিভাগ', 'Division'), badge: 'PRIVATE', type: 'select', options: divisionOptions },
      { name: 'profession', label: text('পেশা', 'Profession') },
      { name: 'monthlySalary', label: text('মাসিক আয়', 'Monthly Salary / Income'), badge: 'PRIVATE', placeholder: text('যেমন: ৫০,০০০', 'e.g. 50,000') },
      { name: 'professionalDetails', label: text('পেশাগত বিবরণ', 'Professional details'), full: true },
      { name: 'workInstituteName', label: text('কामের প্রতিষ্ঠানের নাম', 'Work Institute Name'), badge: 'PRIVATE', placeholder: text('যেমন: গুগল বা ফ্রিল্যান্স', 'e.g. Google or Freelance') },
      { name: 'workStationCategory', label: text('কামের স্টেশন ক্যাটাগরি', 'Work Station Category'), placeholder: text('যেমন: হাসপাতাল, ব্যাংক', 'e.g. Hospital, Bank') },
    ],
  },
  {
    title: text('পারিবারিক পরিচিতি', 'Family background'),
    subtitle: text('আপনার পরিবারের প্রাসঙ্গিক তথ্য শেয়ার করুন।', 'Share relevant details about your family.'),
    fields: [
      { name: 'fatherName', label: text('পিতার নাম', 'Father’s name'), badge: 'PRIVATE', placeholder: text('মোঃ আবদুর রহিম / মৃত মোঃ আবদুর রহিম', 'Md. Abdur Rahim / Late Md. Abdur Rahim') },
      { name: 'fatherOccupation', label: text('পিতার পেশা', 'Father’s occupation') },
      { name: 'fatherPhone', label: text('পিতার ফোন নম্বর', "Father's Phone Number"), badge: 'PRIVATE', type: 'tel', placeholder: text('যেমন: ০১৭১২৩৪৫৬৭৮৯', 'e.g. +880 1XXXXXXXXX') },
      { name: 'motherName', label: text('মাতার নাম', 'Mother’s name'), badge: 'PRIVATE', placeholder: text('রহিমা / মৃত রহিমা', 'Rahima / Late Rahima') },
      { name: 'motherOccupation', label: text('মাতার পেশা', 'Mother’s occupation') },
      { name: 'motherPhone', label: text('মাতার ফোন নম্বর', "Mother's Phone Number"), badge: 'PRIVATE', type: 'tel', placeholder: text('যেমন: ০১৭১২৩৪৫৬৭৮৯', 'e.g. +880 1XXXXXXXXX') },
      { name: 'familyBackground', label: text('পারিবারিক পরিচিতি', 'Family details'), full: true },
    ],
  },
  {
    title: text('পছন্দ ও জীবনধারা', 'Preferences & lifestyle'),
    subtitle: text('আপনার অগ্রাধিকারগুলো সম্পর্কে জানান।', 'Tell us what matters to you.'),
    fields: [
      { name: 'preferredAge', label: text('পছন্দের বয়সসীমা', 'Preferred age range'), required: true, placeholder: text('যেমন: ২৫–৩২', 'e.g. 25–32') },
      { name: 'preferredLocation', label: text('পছন্দের অবস্থান', 'Preferred location') },
      { name: 'educationPreference', label: text('শিক্ষাগত পছন্দ', 'Education preference') },
      { name: 'occupationPreference', label: text('পেশাগত পছন্দ', 'Occupation preference') },
      { name: 'lifestyle', label: text('জীবনধারা সম্পর্কে', 'Lifestyle'), type: 'select', options: [selectPrompt, option('family-oriented', 'পরিবারকেন্দ্রিক', 'Family-oriented'), option('balance', 'কর্মজীবন ও পরিবারে ভারসাম্য', 'Balance between work and family'), option('open-to-discussion', 'আলোচনা করতে আগ্রহী', 'Open to discussion')] },
      { name: 'relocation', label: text('স্থান পরিবর্তনে আগ্রহী?', 'Open to relocating?'), type: 'select', options: [selectPrompt, option('yes', 'হ্যাঁ', 'Yes'), option('no', 'না', 'No'), option('discuss', 'আলোচনা সাপেক্ষে', 'Open to discussion')] },
      { name: 'preferences', label: text('অন্যান্য পছন্দ বা গুরুত্বপূর্ণ বিষয়', 'Other preferences or important details'), full: true, type: 'textarea' },
      { name: 'videoCallOverseas', label: text('বিদেশে ভিডিও কলের জন্য উপলব্ধ?', 'Available for Video Call (Overseas)?'), type: 'select', options: yesNoOptions },
      { name: 'committedToFitness', label: text('ফিটনেসের প্রতি প্রতিবদ্ধ?', 'Committed to Fitness?'), type: 'select', options: yesNoOptions },
      { name: 'healthConditions', label: text('শারীরিক বা মানসিক স্বাস্থ্য সমস্যা', 'Physical or Mental Health Conditions'), full: true, type: 'textarea', placeholder: text('আপনার কোনো শারীরিক বা মানসিক স্বাস্থ্য সমস্যা আছে বলুন', 'Please state if you have any physical or mental health conditions...') },
      { name: 'readyForMarriage3Months', label: text('৩ মাসের মধ্যে বিয়েতে প্রস্তুত?', 'Ready for Marriage within 3 months?'), type: 'select', options: yesNoOptions },
      { name: 'praySalatRegularly', label: text('নিয়মিত সালাত পড়েন?', 'Pray Salat regularly?'), type: 'select', options: yesNoOptions },
      { name: 'wearNiqabHijab', label: text('নিকাব / হিজাব পরেন?', 'Wear Niqab/Hijab?'), type: 'select', options: yesNoOptions },
      { name: 'proceedWithFamily', label: text('আগ্রহী হলে পরিবারের সাথে এগিয়ে যেতে ইচ্ছুক?', 'Willing to proceed with family if interested?'), type: 'select', options: yesNoOptions },
    ],
  },
  {
    title: text('নিজের সম্পর্কে', 'About yourself'),
    subtitle: text('আপনার গল্প ও প্রত্যাশা নিজের ভাষায় লিখুন।', 'Describe yourself and your hopes in your own words.'),
    fields: [
      { name: 'aboutSelf', label: text('নিজের পরিচিতি ও প্রত্যাশা', 'About yourself & expectations'), required: true, full: true, type: 'textarea', maxWords: 100, placeholder: text('আপনার ব্যক্তিত্ব, আগ্রহ, দৃষ্টিভঙ্গি এবং জীবনসঙ্গী থেকে প্রত্যাশা লিখুন', 'Share your personality, interests, outlook, and what you hope for in a life partner') },
    ],
  },
  {
    title: text('সদস্যের বিবরণ', 'Member details'),
    subtitle: text('নিজের জন্য, নাকি পরিবারের কারও হয়ে রেজিস্ট্রেশন করছেন?', 'Are you registering for yourself or for a family member?'),
    fields: [
      { name: 'registeringFor', label: text('রেজিস্ট্রেশন কার জন্য?', 'Who is this registration for?'), required: true, type: 'select', options: [selectPrompt, option('self', 'নিজের জন্য', 'Myself'), option('family', 'পরিবারের সদস্যের জন্য', 'A family member')] },
    ],
  },
  {
    title: text('নথি নির্বাচন ও পর্যালোচনা', 'Documents & review'),
    subtitle: text('নির্বাচিত নথিগুলো দেখে নিন এবং প্রয়োজনে সরিয়ে ফেলুন।', 'Review your selected documents and remove any you no longer want.'),
    fields: [],
  },
];

export const memberFields: RegistrationFieldDefinition[] = [
  { name: 'memberName', label: text('সদস্যের পূর্ণ নাম', 'Member’s full name'), required: true },
  { name: 'memberRelation', label: text('আপনার সাথে সম্পর্ক', 'Relationship to you'), required: true },
  { name: 'memberPhone', label: text('সদস্যের যোগাযোগ নম্বর', 'Member’s contact number'), type: 'tel' },
];

export const siblingFields: RegistrationFieldDefinition[] = [
  { name: 'siblingRelation', label: text('ভাই-বোনের সম্পর্ক', 'Sibling Relation'), type: 'select', options: siblingRelationOptions },
  { name: 'siblingName', label: text('ভাই-বোনের নাম', "Sibling's Name"), badge: 'PRIVATE', placeholder: text('নাম লিখুন', 'Enter name') },
  { name: 'siblingOccupation', label: text('পেশা', 'Occupation'), placeholder: text('যেমন: ডাক্টর, ইঞ্জিনিয়ার', 'e.g. Doctor, Engineer') },
  { name: 'siblingMaritalStatus', label: text('বিবাহের অবস্থান', 'Marital Status'), type: 'select', options: siblingMaritalStatusOptions },
  { name: 'spouseOccupation', label: text('স্বামী/স্ত্রীর পেশা', 'Spouse Occupation'), placeholder: text('যেমন: ডাক্টর, ইঞ্জিনিয়ার', 'e.g. Doctor, Engineer') },
];

export const requiredByStep: Record<number, string[]> = {
  0: ['fullName', 'gender', 'birthDate', 'phone', 'country', 'city'],
  3: ['aboutSelf'],
  4: ['registeringFor'],
};

export const registrationLabels = {
  bn: {
    brand: 'NBN Match Making Event',
    home: 'মূল পাতায় ফিরুন',
    homeAria: 'NBN হোম',
    title: 'আপনার পরিচয়ের শুরু',
    intro: 'প্রয়োজনীয় তথ্য দিয়ে ধাপে ধাপে ফর্মটি পূরণ করুন।',
    progressTitle: 'ধাপে ধাপে',
    step: 'ধাপ',
    requiredError: 'এই তথ্যটি পূরণ করা আবশ্যক।',
    phoneError: 'একটি সঠিক ফোন নম্বর লিখুন।',
    emailError: 'একটি সঠিক ইমেইল ঠিকানা লিখুন।',
    aboutSelfTooLongError: 'শব্দ সীমা অতিক্রম করছেন (সর্বোচ্চ ১০০ শব্দ)।',
    chooseDocuments: 'নথি নির্বাচন করুন',
    optionalDemo: '(ঐচ্ছিক)',
    uploadInstructions: 'শুধু JPG, PNG বা PDF · প্রতি ফাইল সর্বোচ্চ ৫ MB।',
    fileInputLabel: 'নথি নির্বাচন করুন',
    fileTypeError: 'JPG, PNG বা PDF ফাইল দিন।',
    fileSizeError: 'ফাইল ৫ MB-এর মধ্যে হতে হবে।',
    removeFile: 'সরান',
    filePreview: 'প্রিভিউ',
    reviewTitle: 'আপনার তথ্য পর্যালোচনা',
    emptyReview: 'এখনো কোনো তথ্য যোগ করা হয়নি। আগের ধাপে ফিরে তথ্য যোগ করতে পারেন।',
    previous: 'আগের ধাপ',
    continue: 'পরের ধাপ',
    submit: 'রেজিস্ট্রেশন জমা দিন',
    titleSuffix: 'রেজিস্ট্রেশন',
    memberForError: 'পরিবারের সদস্যের জন্য',
    requiredAria: 'আবশ্যক',
    chooseFile: 'ফাইল নির্বাচন করুন',
    loadingEvent: 'লোড হচ্ছে...',
    eventLoadError: 'ইভেন্টের তথ্য আনা যায়নি।',
    noOpenEvent: 'এই মুহূর্তে কোনো ইভেন্ট রেজিস্ট্রেশনের জন্য খোলা নেই। কিছুক্ষণ পর আবার দেখুন।',
    eventCodeLabel: 'ইভেন্ট কোড:',
    priceLabel: 'মূল্য:',
    discountPriceLabel: 'ছাড়িত মূল্য:',
    siblingsHeading: 'ভাই ও বোন',
    addSibling: 'ভাই বা বোন যোগ করুন',
    removeSibling: 'ভাই বা বোন সরান',
    siblingCardLabel: 'ভাই/বোন',
    photoLabel: 'ছবি',
    idCardLabel: 'জাতীয় পরিচয়পত্র',
    paymentDetails: 'পেমেন্টের বিবরণ',
    paymentMethodLabel: 'পেমেন্ট পদ্ধতি',
    selectOption: 'নির্বাচন করুন',
    transactionIdLabel: 'লেনদেন আইডি',
    transactionIdPlaceholder: 'লেনদেন আইডি লিখুন',
    senderNumberLabel: 'প্রেরকের নম্বর',
    senderNumberPlaceholder: 'প্রেরকের মোবাইল নম্বর',
    consentText: 'আমি সম্মতি দিচ্ছি যে NBN আমার জাতীয় পরিচয়পত্র ও ব্যক্তিগত তথ্য নিরাপদভাবে সংরক্ষণ করবে এবং ম্যাচমেকিংয়ের জন্য শুধুমাত্র অ্যাডমিনের মাধ্যমে ব্যবহার করবে।',
    consentError: 'এই সম্মতি আবশ্যক।',
    privateBucketNote: 'আপনার ফাইল একটি প্রাইভেট বাকেটে আপলোড হয়; অ্যাডমিনরা শুধুমাত্র ৬০ সেকেন্ডে মেয়াদোত্তীর্ণ হওয়া সাইন করা লিংকের মাধ্যমে দেখতে পারবেন।',
    submitting: 'জমা হচ্ছে...',
    registrationClosedError: 'রেজিস্ট্রেশন এখন খোলা নেই।',
    paymentMethodError: 'অনুগ্রহ করে একটি পেমেন্ট পদ্ধতি নির্বাচন করুন।',
    transactionIdError: 'লেনদেন আইডি আবশ্যক।',
    senderNumberError: 'প্রেরকের নম্বর আবশ্যক।',
    ageRangeLabel: 'বয়সসীমা',
    ageRangeError: 'দুঃখিত, আপনার বয়স এই ইভেন্টের নির্ধারিত বয়সসীমার মধ্যে পড়ে না।',
    presentAddressHeading: 'বর্তমান ঠিকানা',
    permanentAddressHeading: 'স্থায়ী ঠিকানা',
    overseasFeeLabel: 'বিদেশে ভিডিও কল ফি:',
    eventClosedError: 'দুঃখিত, এই ইভেন্টের রেজিস্ট্রেশন বন্ধ হয়ে গেছে।',
    eventFullError: 'দুঃখিত, এই ইভেন্টে সর্বোচ্চ অংশগ্রহণকারী নির্ধারিত সংখ্যা পূর্ণ হয়ে গেছে।',
    duplicateTransactionError: 'এই ট্রানজেকশন আইডি দিয়ে আগেই রেজিস্ট্রেশন হয়েছে। আপনি যদি আগে সফলভাবে জমা দিয়ে থাকেন, তাহলে আর জমা দেওয়ার প্রয়োজন নেই। অন্যথায় ভিন্ন ট্রানজেকশন আইডি ব্যবহার করুন।',
    submitFailedError: 'রেজিস্ট্রেশন জমা দেওয়া যায়নি। কিছুক্ষণ পর আবার চেষ্টা করুন।',
    submittedTitle: 'রেজিস্ট্রেশন সম্পন্ন',
    submittedHeading: 'ধন্যবাদ! আপনার রেজিস্ট্রেশন জমা হয়েছে।',
    submittedBody: 'আপনার তথ্য পর্যালোচনা করে আমরা আপনার সাথে যোগাযোগ করব।',
  },
  en: {
    brand: 'NBN Match Making Event',
    home: 'Back to home',
    homeAria: 'NBN home',
    title: 'Start with your introduction',
    intro: 'Fill in the form step by step with your details.',
    progressTitle: 'Your steps',
    step: 'Step',
    requiredError: 'This field is required.',
    phoneError: 'Enter a valid phone number.',
    emailError: 'Enter a valid email address.',
    aboutSelfTooLongError: 'Word limit exceeded (maximum 100 words).',
    chooseDocuments: 'Choose documents',
    optionalDemo: '(optional)',
    uploadInstructions: 'JPG, PNG, or PDF only · Up to 5 MB each.',
    fileInputLabel: 'Choose documents',
    fileTypeError: 'Please choose a JPG, PNG, or PDF file.',
    fileSizeError: 'Each file must be 5 MB or smaller.',
    removeFile: 'Remove',
    filePreview: 'preview',
    reviewTitle: 'Review your information',
    emptyReview: 'No information added yet. Go back to add details.',
    previous: 'Previous step',
    continue: 'Continue',
    submit: 'Submit registration',
    titleSuffix: 'Registration',
    memberForError: 'A family member',
    requiredAria: 'Required',
    chooseFile: 'Choose file',
    loadingEvent: 'Loading event...',
    eventLoadError: 'Failed to load event.',
    noOpenEvent: 'No event is open for registration right now. Please check back soon.',
    eventCodeLabel: 'Event code:',
    priceLabel: 'Price:',
    discountPriceLabel: 'Discounted price:',
    siblingsHeading: 'Siblings',
    addSibling: 'Add sibling',
    removeSibling: 'Remove sibling',
    siblingCardLabel: 'SIBLING',
    photoLabel: 'Photo',
    idCardLabel: 'ID Card',
    paymentDetails: 'Payment Details',
    paymentMethodLabel: 'Payment Method',
    selectOption: 'Select an option',
    transactionIdLabel: 'Transaction ID',
    transactionIdPlaceholder: 'Enter transaction ID',
    senderNumberLabel: 'Sender Number',
    senderNumberPlaceholder: 'Sender mobile number',
    consentText: 'I consent to NBN securely storing my ID card and personal details, to be used only through the admin for matchmaking purposes.',
    consentError: 'This consent is required.',
    privateBucketNote: 'Your files are uploaded to a private bucket; admins can view them only via signed URLs that expire in 60 seconds.',
    submitting: 'Submitting...',
    registrationClosedError: 'Registration is not currently open.',
    paymentMethodError: 'Please select a payment method.',
    transactionIdError: 'Transaction ID is required.',
    senderNumberError: 'Sender number is required.',
    ageRangeLabel: 'Age range',
    ageRangeError: 'Sorry, your age does not fall within the age range for this event.',
    presentAddressHeading: 'Present address',
    permanentAddressHeading: 'Permanent address',
    overseasFeeLabel: 'Overseas video call fee:',
    eventClosedError: 'Sorry, registration for this event is closed.',
    eventFullError: 'Sorry, this event has reached its maximum number of participants.',
    duplicateTransactionError: 'A registration with this transaction ID already exists. If you already submitted successfully, no further action is needed. Otherwise use a different transaction ID.',
    submitFailedError: 'Could not submit your registration. Please try again later.',
    submittedTitle: 'Registration complete',
    submittedHeading: 'Thank you! Your registration has been submitted.',
    submittedBody: 'We will contact you after reviewing your details.',
  },
} satisfies Record<Language, Record<string, string>>;

export function getRegistrationFieldLabel(name: string, language: Language) {
  const field = [...registrationSections.flatMap((section) => section.fields), ...memberFields]
    .find((candidate) => candidate.name === name);
  return field?.label[language] ?? name;
}

export function getRegistrationValueLabel(name: string, value: string, language: Language) {
  const field = [...registrationSections.flatMap((section) => section.fields), ...memberFields]
    .find((candidate) => candidate.name === name);
  return field?.options?.find((candidate) => candidate.value === value)?.label[language] ?? value;
}


