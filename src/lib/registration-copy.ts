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
};

const text = (bn: string, en: string): LocaleText => ({ bn, en });
const option = (value: string, bn: string, en: string): RegistrationOption => ({
  value,
  label: text(bn, en),
});
const selectPrompt = option('', 'নির্বাচন করুন', 'Select an option');
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
      { name: 'religion', label: text('ধর্ম', 'Religion'), placeholder: text('যেমন: ইসলাম(সুন্নী)', 'e.g. Islam(Sunni)') },
      { name: 'nationality', label: text('জাতیت্ব', 'Nationality'), placeholder: text('যেমন: বাংলাদেশী', 'e.g. Bangladeshi') },
      { name: 'skinColor', label: text('চামড়ার রং', 'Skin Color'), type: 'select', options: [selectPrompt, option('light-fair', 'লাইট ফেয়ার', 'Light Fair'), option('fair', 'ফেয়ার', 'Fair'), option('medium', 'মিডিয়াম', 'Medium'), option('wheatish', 'গমবর্ণী', 'Wheatish'), option('dark', 'ডার্ক', 'Dark')] },
      { name: 'maritalStatus', label: text('বিবাহের অবস্থান', 'Marital Status'), type: 'select', options: [selectPrompt, option('never-married', 'কখনো বিয়ে করেননি', 'Never Married'), option('married', 'বিবাহিত', 'Married'), option('divorced', 'বিচ্ছেদ', 'Divorced'), option('widowed', 'বিধবা / বিধুর', 'Widowed')] },
      { name: 'height', label: text('উচ্চতা', 'Height'), placeholder: text('যেমন: ৫′৭″', 'e.g. 5\'7"') },
      { name: 'weight', label: text('ওজন (kg)', 'Weight (kg)'), placeholder: text('যেমন: ৭০', 'e.g. 70') },
      { name: 'children', label: text('সন্তান', 'Children'), type: 'select', options: [selectPrompt, option('none', 'কোনো নেই', 'None'), option('one', '১ জন', '1'), option('two', '২ জন', '2'), option('three', '৩ জন', '3'), option('four-plus', '৪ বা তার বেশি', '4+')] },
      { name: 'lastEducationLevel', label: text('শেষ শিক্ষাগত যোগ্যতা', 'Last Education Level'), type: 'select', options: [selectPrompt, option('phd', 'পিএইচডি', 'PhD'), option('masters', 'মাস্টার্স', "Master's"), option('bachelors', 'ব্যাচেলর্স', "Bachelor's"), option('hsc', 'এইচএসসি', 'HSC / Intermediate'), option('ssc', 'এসএসসি', 'SSC / Secondary')] },
      { name: 'educationInstituteName', label: text('শিক্ষা প্রতিষ্ঠানের নাম', 'Education Institute Name'), placeholder: text('যেমন: ঢাকা বিশ্ববিদ্যালয়', 'e.g. University of Dhaka') },
      { name: 'phone', label: text('মোবাইল নম্বর', 'Phone number'), type: 'tel', required: true, badge: 'PRIVATE', placeholder: text('যেমন: 01XXXXXXXXX', 'e.g. +880 1XXXXXXXXX') },
      { name: 'email', label: text('ইমেইল', 'Email'), type: 'email', badge: 'PRIVATE', placeholder: text('আপনার ইমেইল ঠিকানা', 'Your email address') },
      { name: 'country', label: text('দেশ', 'Country'), required: true, placeholder: text('দেশের নাম', 'Country name') },
      { name: 'city', label: text('শহর / জেলা', 'City / district'), required: true, placeholder: text('শহর বা জেলার নাম', 'City or district') },
      { name: 'presentAddress', label: text('বর্তমান ঠিকানা', 'Present address'), full: true, badge: 'PRIVATE' },
      { name: 'permanentAddress', label: text('স্থায়ী ঠিকানা', 'Permanent address'), full: true, badge: 'PRIVATE' },
      { name: 'education', label: text('শিক্ষাগত যোগ্যতা', 'Education') },
      { name: 'profession', label: text('পেশা / পেশা', 'Profession') },
      { name: 'occupation', label: text('পেশা', 'Occupation') },
      { name: 'monthlySalary', label: text('মাসিক বেতন', 'Monthly Salary'), badge: 'PRIVATE', placeholder: text('যেমন: ৫০,০০০', 'e.g. 50,000') },
      { name: 'professionalDetails', label: text('পেশাগত বিবরণ', 'Professional details'), full: true },
      { name: 'workInstituteName', label: text('কामের প্রতিষ্ঠানের নাম', 'Work Institute Name'), badge: 'PRIVATE', placeholder: text('যেমন: গুগল বা ফ্রিল্যান্স', 'e.g. Google or Freelance') },
      { name: 'workStationCategory', label: text('কামের স্টেশন ক্যাটাগরি', 'Work Station Category'), placeholder: text('যেমন: হাসপাতাল, ব্যাংক', 'e.g. Hospital, Bank') },
    ],
  },
  {
    title: text('পারিবারিক পরিচিতি', 'Family background'),
    subtitle: text('আপনার পরিবারের প্রাসঙ্গিক তথ্য শেয়ার করুন।', 'Share relevant details about your family.'),
    fields: [
      { name: 'fatherName', label: text('পিতার নাম', 'Father’s name'), badge: 'PRIVATE' },
      { name: 'fatherOccupation', label: text('পিতার পেশা', 'Father’s occupation') },
      { name: 'motherName', label: text('মাতার নাম', 'Mother’s name'), badge: 'PRIVATE' },
      { name: 'motherOccupation', label: text('মাতার পেশা', 'Mother’s occupation') },
      { name: 'familyBackground', label: text('পারিবারিক পরিচিতি', 'Family details'), full: true },
    ],
  },
  {
    title: text('পছন্দ ও জীবনধারা', 'Preferences & lifestyle'),
    subtitle: text('আপনার অগ্রাধিকারগুলো সম্পর্কে জানান।', 'Tell us what matters to you.'),
    fields: [
      { name: 'preferredAge', label: text('পছন্দের বয়সসীমা', 'Preferred age range'), placeholder: text('যেমন: ২৫–৩২', 'e.g. 25–32') },
      { name: 'preferredLocation', label: text('পছন্দের অবস্থান', 'Preferred location') },
      { name: 'educationPreference', label: text('শিক্ষাগত পছন্দ', 'Education preference') },
      { name: 'occupationPreference', label: text('পেশাগত পছন্দ', 'Occupation preference') },
      { name: 'lifestyle', label: text('জীবনধারা সম্পর্কে', 'Lifestyle'), type: 'select', options: [selectPrompt, option('family-oriented', 'পরিবারকেন্দ্রিক', 'Family-oriented'), option('balance', 'কর্মজীবন ও পরিবারে ভারসাম্য', 'Balance between work and family'), option('open-to-discussion', 'আলোচনা করতে আগ্রহী', 'Open to discussion')] },
      { name: 'relocation', label: text('স্থান পরিবর্তনে আগ্রহী?', 'Open to relocating?'), type: 'select', options: [selectPrompt, option('yes', 'হ্যাঁ', 'Yes'), option('no', 'না', 'No'), option('discuss', 'আলোচনা সাপেক্ষে', 'Open to discussion')] },
      { name: 'preferences', label: text('অন্যান্য পছন্দ বা গুরুত্বপূর্ণ বিষয়', 'Other preferences or important details'), full: true, type: 'textarea' },
      { name: 'videoCallOverseas', label: text('বিদেশে ভিডিও কলের জন্য উপলব্ধ?', 'Available for Video Call (Overseas)?'), type: 'select', options: yesNoOptions },
      { name: 'committedToFitness', label: text('ফিটনেসের প্রতি প্রতিবদ্ধ?', 'Committed to Fitness?'), type: 'select', options: yesNoOptions },
      { name: 'readyForMarriage3Months', label: text('৩ মাসের মধ্যে বিয়েতে প্রস্তুত?', 'Ready for Marriage within 3 months?'), type: 'select', options: yesNoOptions },
      { name: 'praySalatRegularly', label: text('নিয়মিত সালাত পড়েন?', 'Pray Salat regularly?'), type: 'select', options: yesNoOptions },
      { name: 'wearNiqabHijab', label: text('নقاب / হিজাব পরেন?', 'Wear Niqab/Hijab?'), type: 'select', options: yesNoOptions },
      { name: 'proceedWithFamily', label: text('আগ্রহী হলে পরিবারের সাথে এগিয়ে যেতে ইচ্ছুক?', 'Willing to proceed with family if interested?'), type: 'select', options: yesNoOptions },
    ],
  },
  {
    title: text('নিজের সম্পর্কে', 'About yourself'),
    subtitle: text('আপনার গল্প ও প্রত্যাশা নিজের ভাষায় লিখুন।', 'Describe yourself and your hopes in your own words.'),
    fields: [
      { name: 'aboutSelf', label: text('নিজের পরিচিতি', 'About you'), required: true, full: true, type: 'textarea', placeholder: text('আপনার ব্যক্তিত্ব, আগ্রহ ও জীবনের দৃষ্টিভঙ্গি লিখুন', 'Share your personality, interests, and outlook on life') },
      { name: 'expectations', label: text('জীবনসঙ্গীর কাছে প্রত্যাশা', 'What you hope for in a life partner'), full: true, type: 'textarea' },
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
  { name: 'siblingRelation', label: text('সibling সম্পর্ক', 'Sibling Relation'), type: 'select', options: siblingRelationOptions },
  { name: 'siblingName', label: text('সibling নাম', "Sibling's Name"), badge: 'PRIVATE', placeholder: text('নাম লিখুন', 'Enter name') },
  { name: 'siblingOccupation', label: text('পেশা', 'Occupation'), placeholder: text('যেমন: ডাক্টর, ইঞ্জিনিয়ার', 'e.g. Doctor, Engineer') },
  { name: 'siblingMaritalStatus', label: text('বিবাহের helyzet', 'Marital Status'), type: 'select', options: siblingMaritalStatusOptions },
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
