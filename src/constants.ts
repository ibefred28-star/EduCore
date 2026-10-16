import { AppData, Branding, Config } from './types';

export const DEFAULT_BRANDING: Branding = {
  schoolName: 'EduCore School',
  motto: 'Excellence Through Learning',
  address: '123 Education St, Lagos',
  phone: '',
  principal: 'Dr. A. Bello',
  primary: '#1e3a8a',
  secondary: '#f59e0b',
  accent: '#10b981',
  logo: ''
};

export const DEFAULT_CONFIG: Config = {
  ca1: 20,
  ca2: 20,
  exam: 60,
  violationLimit: 3,
  grades: [
    { min: 75, grade: 'A', remark: 'Excellent' },
    { min: 65, grade: 'B', remark: 'Very Good' },
    { min: 55, grade: 'C', remark: 'Good' },
    { min: 45, grade: 'D', remark: 'Fair' },
    { min: 40, grade: 'E', remark: 'Pass' },
    { min: 0, grade: 'F', remark: 'Fail' }
  ]
};

export const EMPTY_SCHOOL_DATA: AppData = {
  students: [],
  teachers: [],
  admins: [],
  subjects: ['Mathematics', 'English Language', 'Basic Science & Technology'],
  exams: [],
  results: [],
  attendance: [],
  questions: [],
  assessments: [],
  learningResources: []
};

export const DEFAULT_LEARNING_RESOURCES = [
  {
    id: 'res-heart-circulatory',
    title: 'The Anatomy of the Human Heart and Circulatory System',
    description: 'Comprehensive diagram and physiological breakdown of systemic and pulmonary circulation.',
    type: 'diagram' as const,
    subject: 'Basic Science',
    targetClass: 'All',
    topic: 'Human Anatomy & Physiology',
    tags: ['Biology', 'Circulation', 'Heart', 'Organ Systems'],
    content: `The human circulatory system is an intricate biological network responsible for transporting oxygen, nutrients, hormones, and cellular waste products throughout the body.

At the centre of this remarkable system sits the heart, a muscular double pump operating continuously throughout an individual's lifetime. The heart is divided into four distinct chambers: the right atrium, the right ventricle, the left atrium, and the left ventricle.

Deoxygenated blood returns from the body tissues via the superior and inferior vena cava into the right atrium. It then passes through the tricuspid valve into the right ventricle, which pumps it through the pulmonary artery directly to the lungs for gaseous exchange.

Inside the lungs, red blood cells release carbon dioxide and bind with fresh oxygen. This revitalised, oxygenated blood returns via the pulmonary veins into the left atrium. It travels through the bicuspid mitral valve into the powerful left ventricle, whose thick muscular wall propels the blood under high pressure through the aorta into systemic circulation.

Key points to remember for your examinations:
First, arteries carry blood away from the heart, typically high in oxygen, with the sole exception of the pulmonary artery.
Second, veins carry blood towards the heart, generally lower in oxygen, with the exception of the pulmonary veins.
Third, microscopic capillaries allow direct exchange of oxygen and nutrients with individual body cells.`,
    fileUrl: 'https://images.unsplash.com/photo-1530026405186-ed1f139313f8?auto=format&fit=crop&w=1200&q=80',
    fileName: 'heart_anatomy_diagram.png',
    fileSize: 425000,
    mimeType: 'image/png',
    createdBy: 'Mr. Okafor',
    teacherId: 'teacher1',
    teacherName: 'Mr. Okafor',
    createdAt: '2026-10-10T08:30:00.000Z'
  },
  {
    id: 'res-photosynthesis-guide',
    title: 'Photosynthesis & Plant Respiration Master Study Guide',
    description: 'Detailed study text examining chloroplast structures, light reactions, and the Calvin cycle.',
    type: 'document' as const,
    subject: 'Basic Science',
    targetClass: 'Primary 5',
    topic: 'Plant Biology & Energy',
    tags: ['Photosynthesis', 'Botany', 'Biochemistry'],
    content: `Photosynthesis is the fundamental biochemical process by which green plants, algae, and photosynthetic bacteria convert light energy into stable chemical energy stored in glucose molecules.

In terrestrial vascular plants, this miraculous chemical synthesis occurs primarily within the palisade mesophyll cells of green leaves. Within these cells are specialized microscopic organelles known as chloroplasts.

Chloroplasts contain disc-like structures called thylakoids, stacked neatly into granum columns. The green photosynthetic pigment chlorophyll is embedded within these thylakoid membranes. Chlorophyll absorbs solar radiation, specifically photons in the blue and red bands of the visible light spectrum, while reflecting green light, which accounts for the distinctive coloration of foliage.

The overall chemical equation for photosynthesis is summarized as follows:
Six molecules of carbon dioxide react with six molecules of water, powered by sunlight absorbed by chlorophyll, to produce one molecule of glucose and six molecules of breathable oxygen gas.

Plants utilize the resulting glucose for immediate energy via cellular respiration, or polymerize it into starch for long-term botanical storage. The byproduct oxygen is released through tiny leaf pores called stomata, sustaining aerobic respiration for all terrestrial and marine life.`,
    fileName: 'photosynthesis_master_guide.pdf',
    fileSize: 312000,
    mimeType: 'application/pdf',
    createdBy: 'Mr. Okafor',
    teacherId: 'teacher1',
    teacherName: 'Mr. Okafor',
    createdAt: '2026-10-11T09:15:00.000Z'
  },
  {
    id: 'res-algebra-foundations',
    title: 'Algebraic Foundations: Linear Equations and Balancing Principles',
    description: 'Essential textbook chapter covering one-variable equations, inverse operations, and problem solving.',
    type: 'book' as const,
    subject: 'Math',
    targetClass: 'Primary 5',
    topic: 'Algebra & Linear Equations',
    tags: ['Mathematics', 'Algebra', 'Linear Equations'],
    content: `Welcome to Chapter Four: The Golden Principles of Algebraic Manipulation.

In mathematics, an equation represents a statement of exact numerical equality between two expressions. You can visualize an algebraic equation as a classical mechanical balance scale. When both pans hold equal weights, the scale rests in perfect horizontal equilibrium.

The Golden Rule of Algebra states:
Whatever mathematical operation you apply to one side of an equation, you must perform identically to the opposing side in order to preserve balance.

Let us examine a practical example:
Solve for x in the equation: Three x plus seven equals twenty-two.

Step One: Eliminate the constant term added to x by applying inverse operations. We subtract seven from both sides of the equation.
Three x plus seven minus seven equals twenty-two minus seven.
This simplifies cleanly to: Three x equals fifteen.

Step Two: Isolate the unknown variable x by dividing both sides by the coefficient three.
Three x divided by three equals fifteen divided by three.
Hence, x equals five.

Step Three: Verify your conclusion through substitution.
Three multiplied by five is fifteen. Adding seven gives twenty-two. The equality holds true, confirming our solution is correct.`,
    fileName: 'algebra_chapter_4.pdf',
    fileSize: 580000,
    mimeType: 'application/pdf',
    createdBy: 'Mr. Okafor',
    teacherId: 'teacher1',
    teacherName: 'Mr. Okafor',
    createdAt: '2026-10-12T11:00:00.000Z'
  },
  {
    id: 'res-benin-kingdom-history',
    title: 'Heritage & Governance of the Ancient Benin Kingdom',
    description: 'Historical overview of pre-colonial West African civilization, Oba leadership, and brass casting guilds.',
    type: 'notes' as const,
    subject: 'Nigerian History',
    targetClass: 'Primary 5',
    topic: 'Pre-Colonial Kingdoms',
    tags: ['History', 'Benin Kingdom', 'Culture', 'Nigeria'],
    content: `The ancient Kingdom of Benin, situated in present-day southern Nigeria, stands as one of the most sophisticated, prosperous, and culturally advanced civilisations of pre-colonial Africa.

Founded around the eleventh century, the kingdom transitioned from the reign of the Ogiso rulers to the dynasty of the Oba, established by Prince Oranmiyan of Ife. The Oba was revered not merely as a political sovereign, but as a spiritual custodian of the Edo people.

Under visionary rulers such as Oba Ewuare the Great in the fifteenth century, Benin underwent dramatic urban expansion. The kingdom constructed the renowned Benin Moat, a massive network of earthen ramparts and defensive trenches that historians consider one of the largest earth-moving feats in pre-industrial civilization.

Artistically, the royal court established specialised hereditary craft guilds. Master artisans created magnificent bronze, brass, and terracotta sculptures through the lost-wax casting technique. These historic works, known globally as the Benin Bronzes, documented royal ceremonies, warfare, international trade with Portuguese merchants, and diplomatic treaties with astonishing visual elegance.`,
    createdBy: 'Mr. Okafor',
    teacherId: 'teacher1',
    teacherName: 'Mr. Okafor',
    createdAt: '2026-10-13T14:20:00.000Z'
  },
  {
    id: 'res-british-council-english',
    title: 'British Council English Grammar & Pronunciation Portal',
    description: 'Interactive portal with British English grammar modules, formal pronunciation, and listening exercises.',
    type: 'link' as const,
    subject: 'English',
    targetClass: 'All',
    topic: 'Grammar & Spoken English',
    tags: ['English Language', 'Grammar', 'Phonics', 'British Council'],
    linkUrl: 'https://learnenglish.britishcouncil.org/grammar',
    content: `The British Council Grammar portal provides structured lessons on formal British English syntax, phonetics, and standard grammatical rules.

Key topics covered include:
First: Distinguishing between active and passive voice in formal written prose.
Second: Mastering conditional clauses and subjunctive constructions.
Third: British English spelling standards, such as honour, colour, and centre, alongside Received Pronunciation vowel sounds.
Fourth: Modal auxiliary verbs used for expressing obligation, permission, and polite requests.

Pupils are encouraged to practice reading every lesson aloud in crisp British English to enhance spoken diction, public speaking fluency, and comprehension.`,
    createdBy: 'Mr. Okafor',
    teacherId: 'teacher1',
    teacherName: 'Mr. Okafor',
    createdAt: '2026-10-14T10:00:00.000Z'
  }
];

export const DEFAULT_DATA: AppData = {
  learningResources: DEFAULT_LEARNING_RESOURCES,
  students: [
    { id: 'STU001', name: 'Aisha Bello', class: 'Primary 5', password: 'pass', photo: '' },
    { id: 'STU002', name: 'Chukwudi Eze', class: 'Primary 5', password: 'pass', photo: '' },
    { id: 'STU003', name: 'Fatima Ibrahim', class: 'Primary 5', password: 'pass', photo: '' },
    { id: 'STU004', name: 'Emmanuel Adeyemi', class: 'Primary 5', password: 'pass', photo: '' },
    { id: 'STU005', name: 'Zainab Danjuma', class: 'Primary 5', password: 'pass', photo: '' },
    { id: 'STU006', name: 'David Adeleke', class: 'JSS2', password: 'pass', photo: '' }
  ],
  teachers: [
    { id: 'teacher1', name: 'Mr. Okafor', password: 'pass', subjects: ['Math', 'English', 'Basic Science', 'Nigerian History'], classes: ['Primary 5'] },
    { id: 'teacher2', name: 'Mrs. Adewale', password: 'pass', subjects: ['Math'], classes: ['JSS2'] }
  ],
  admins: [{ id: 'admin', name: 'Administrator', password: 'admin' }],
  subjects: ['Math', 'English', 'Basic Science', 'Nigerian History'],
  exams: [
    {
      id: 'EXAM1',
      title: 'Primary 5 Mathematics Assessment',
      subject: 'Math',
      type: 'CA 1',
      duration: 30,
      attempts: 1,
      status: 'active',
      targetClasses: ['Primary 5'],
      createdBy: 'teacher1',
      questions: [
        { type: 'mcq', q: 'What is 15 + 27?', options: ['32', '42', '52', '40'], ans: 1 },
        { type: 'mcq', q: 'What is 8 x 7?', options: ['54', '56', '64', '48'], ans: 1 }
      ]
    },
    {
      id: 'EXAM_JSS2',
      title: 'JSS2 Mathematics Test',
      subject: 'Math',
      type: 'CA 1',
      duration: 30,
      attempts: 1,
      status: 'active',
      targetClasses: ['JSS2'],
      createdBy: 'teacher2',
      questions: [
        { type: 'mcq', q: 'Solve for x: 2x + 4 = 10', options: ['2', '3', '4', '5'], ans: 1, topic: 'Algebra', marks: 2 }
      ]
    },
    {
      id: 'EXAM_ENG1',
      title: 'Primary 5 English Language Assessment',
      subject: 'English',
      type: 'CA 1',
      duration: 30,
      attempts: 1,
      status: 'active',
      targetClasses: ['Primary 5'],
      createdBy: 'teacher1',
      questions: [
        { type: 'true_false', q: 'An adjective is a word that describes or qualifies a noun.', ans: true, topic: 'Grammar', marks: 1 },
        { type: 'fill_blank', q: 'The synonym for "gigantic" starting with the letter "h" is ________.', answer: 'huge', answers: ['huge', 'humongous'], topic: 'Vocabulary', marks: 1 }
      ]
    },
    {
      id: 'EXAM_SCI1',
      title: 'Primary 5 Basic Science Test',
      subject: 'Basic Science',
      type: 'CA 1',
      duration: 30,
      attempts: 1,
      status: 'active',
      targetClasses: ['Primary 5'],
      createdBy: 'teacher1',
      questions: [
        { type: 'diagram', q: 'Which organelle shown in the diagram is the site of cellular respiration and energy production?', image: 'https://images.unsplash.com/photo-1530595467537-0b5996c41f2d?w=800&auto=format&fit=crop&q=80', options: ['Mitochondria', 'Chloroplast', 'Nucleus', 'Endoplasmic Reticulum'], ans: 0, topic: 'Cell Biology', marks: 2 },
        { type: 'mcq', q: 'Which of the following is a renewable source of energy?', options: ['Coal', 'Petroleum', 'Solar energy', 'Natural Gas'], ans: 2, topic: 'Energy', marks: 1 }
      ]
    }
  ],
  results: [
    { id: 'RES1', studentId: 'STU001', examId: 'EXAM1', subject: 'Math', type: 'CA 1', raw: 2, rawMax: 2, scaled: 20, max: 20, violations: 0, answers: { 0: 1, 1: 1 }, attempt: 1, attemptsAllowed: 1, submittedAt: '2026-09-18T10:00:00Z' },
    { id: 'RES2', studentId: 'STU002', examId: 'EXAM1', subject: 'Math', type: 'CA 1', raw: 1, rawMax: 2, scaled: 15, max: 20, violations: 0, answers: { 0: 1, 1: 0 }, attempt: 1, attemptsAllowed: 1, submittedAt: '2026-09-18T10:00:00Z' },
    { id: 'RES3', studentId: 'STU003', examId: 'EXAM1', subject: 'Math', type: 'CA 1', raw: 2, rawMax: 2, scaled: 20, max: 20, violations: 0, answers: { 0: 1, 1: 1 }, attempt: 1, attemptsAllowed: 1, submittedAt: '2026-09-18T10:00:00Z' },
    { id: 'RES4', studentId: 'STU004', examId: 'EXAM1', subject: 'Math', type: 'CA 1', raw: 1, rawMax: 2, scaled: 12, max: 20, violations: 0, answers: { 0: 1, 1: 0 }, attempt: 1, attemptsAllowed: 1, submittedAt: '2026-09-18T10:00:00Z' },
    { id: 'RES5', studentId: 'STU005', examId: 'EXAM1', subject: 'Math', type: 'CA 1', raw: 2, rawMax: 2, scaled: 19, max: 20, violations: 0, answers: { 0: 1, 1: 1 }, attempt: 1, attemptsAllowed: 1, submittedAt: '2026-09-18T10:00:00Z' },
    { id: 'RES6', studentId: 'STU006', examId: 'EXAM_JSS2', subject: 'Math', type: 'CA 1', raw: 1, rawMax: 1, scaled: 18, max: 20, violations: 0, answers: { 0: 1 }, attempt: 1, attemptsAllowed: 1, submittedAt: '2026-09-18T10:00:00Z' },
    
    { id: 'RES7', studentId: 'STU001', examId: 'EXAM_ENG1', subject: 'English', type: 'CA 1', raw: 2, rawMax: 2, scaled: 19, max: 20, violations: 0, answers: { 0: true, 1: 'huge' }, attempt: 1, attemptsAllowed: 1, submittedAt: '2026-09-22T09:30:00Z' },
    { id: 'RES8', studentId: 'STU002', examId: 'EXAM_ENG1', subject: 'English', type: 'CA 1', raw: 2, rawMax: 2, scaled: 18, max: 20, violations: 0, answers: { 0: true, 1: 'huge' }, attempt: 1, attemptsAllowed: 1, submittedAt: '2026-09-22T09:30:00Z' },
    { id: 'RES9', studentId: 'STU003', examId: 'EXAM_ENG1', subject: 'English', type: 'CA 1', raw: 2, rawMax: 2, scaled: 20, max: 20, violations: 0, answers: { 0: true, 1: 'huge' }, attempt: 1, attemptsAllowed: 1, submittedAt: '2026-09-22T09:30:00Z' },
    { id: 'RES10', studentId: 'STU004', examId: 'EXAM_ENG1', subject: 'English', type: 'CA 1', raw: 1, rawMax: 2, scaled: 10, max: 20, violations: 0, answers: { 0: false, 1: 'huge' }, attempt: 1, attemptsAllowed: 1, submittedAt: '2026-09-22T09:30:00Z' },
    { id: 'RES11', studentId: 'STU005', examId: 'EXAM_ENG1', subject: 'English', type: 'CA 1', raw: 2, rawMax: 2, scaled: 19, max: 20, violations: 0, answers: { 0: true, 1: 'humongous' }, attempt: 1, attemptsAllowed: 1, submittedAt: '2026-09-22T09:30:00Z' },

    { id: 'RES12', studentId: 'STU001', examId: 'EXAM_SCI1', subject: 'Basic Science', type: 'CA 1', raw: 2, rawMax: 2, scaled: 18, max: 20, violations: 0, answers: { 0: 0, 1: 2 }, attempt: 1, attemptsAllowed: 1, submittedAt: '2026-09-26T11:15:00Z' },
    { id: 'RES13', studentId: 'STU002', examId: 'EXAM_SCI1', subject: 'Basic Science', type: 'CA 1', raw: 1, rawMax: 2, scaled: 14, max: 20, violations: 0, answers: { 0: 1, 1: 2 }, attempt: 1, attemptsAllowed: 1, submittedAt: '2026-09-26T11:15:00Z' },
    { id: 'RES14', studentId: 'STU003', examId: 'EXAM_SCI1', subject: 'Basic Science', type: 'CA 1', raw: 2, rawMax: 2, scaled: 20, max: 20, violations: 0, answers: { 0: 0, 1: 2 }, attempt: 1, attemptsAllowed: 1, submittedAt: '2026-09-26T11:15:00Z' },
    { id: 'RES15', studentId: 'STU004', examId: 'EXAM_SCI1', subject: 'Basic Science', type: 'CA 1', raw: 1, rawMax: 2, scaled: 9, max: 20, violations: 0, answers: { 0: 1, 1: 0 }, attempt: 1, attemptsAllowed: 1, submittedAt: '2026-09-26T11:15:00Z' },
    { id: 'RES16', studentId: 'STU005', examId: 'EXAM_SCI1', subject: 'Basic Science', type: 'CA 1', raw: 2, rawMax: 2, scaled: 19, max: 20, violations: 0, answers: { 0: 0, 1: 2 }, attempt: 1, attemptsAllowed: 1, submittedAt: '2026-09-26T11:15:00Z' },

    // CA 2 Assessment Results
    { id: 'RES_CA2_1', studentId: 'STU001', examId: 'EXAM_CA2_M', subject: 'Math', type: 'CA 2', raw: 2, rawMax: 2, scaled: 19, max: 20, violations: 0, answers: {}, attempt: 1, attemptsAllowed: 1, submittedAt: '2026-10-02T10:00:00Z' },
    { id: 'RES_CA2_2', studentId: 'STU001', examId: 'EXAM_CA2_E', subject: 'English', type: 'CA 2', raw: 2, rawMax: 2, scaled: 18, max: 20, violations: 0, answers: {}, attempt: 1, attemptsAllowed: 1, submittedAt: '2026-10-04T09:30:00Z' },
    { id: 'RES_CA2_3', studentId: 'STU001', examId: 'EXAM_CA2_S', subject: 'Basic Science', type: 'CA 2', raw: 2, rawMax: 2, scaled: 17, max: 20, violations: 0, answers: {}, attempt: 1, attemptsAllowed: 1, submittedAt: '2026-10-06T11:15:00Z' },
    { id: 'RES_CA2_4', studentId: 'STU002', examId: 'EXAM_CA2_M', subject: 'Math', type: 'CA 2', raw: 1, rawMax: 2, scaled: 16, max: 20, violations: 0, answers: {}, attempt: 1, attemptsAllowed: 1, submittedAt: '2026-10-02T10:00:00Z' },
    { id: 'RES_CA2_5', studentId: 'STU002', examId: 'EXAM_CA2_E', subject: 'English', type: 'CA 2', raw: 2, rawMax: 2, scaled: 17, max: 20, violations: 0, answers: {}, attempt: 1, attemptsAllowed: 1, submittedAt: '2026-10-04T09:30:00Z' },
    { id: 'RES_CA2_6', studentId: 'STU002', examId: 'EXAM_CA2_S', subject: 'Basic Science', type: 'CA 2', raw: 1, rawMax: 2, scaled: 15, max: 20, violations: 0, answers: {}, attempt: 1, attemptsAllowed: 1, submittedAt: '2026-10-06T11:15:00Z' },
    { id: 'RES_CA2_7', studentId: 'STU003', examId: 'EXAM_CA2_M', subject: 'Math', type: 'CA 2', raw: 2, rawMax: 2, scaled: 20, max: 20, violations: 0, answers: {}, attempt: 1, attemptsAllowed: 1, submittedAt: '2026-10-02T10:00:00Z' },
    { id: 'RES_CA2_8', studentId: 'STU003', examId: 'EXAM_CA2_E', subject: 'English', type: 'CA 2', raw: 2, rawMax: 2, scaled: 20, max: 20, violations: 0, answers: {}, attempt: 1, attemptsAllowed: 1, submittedAt: '2026-10-04T09:30:00Z' },
    { id: 'RES_CA2_9', studentId: 'STU003', examId: 'EXAM_CA2_S', subject: 'Basic Science', type: 'CA 2', raw: 2, rawMax: 2, scaled: 20, max: 20, violations: 0, answers: {}, attempt: 1, attemptsAllowed: 1, submittedAt: '2026-10-06T11:15:00Z' },

    // Terminal Examination Results
    { id: 'RES_EX1', studentId: 'STU001', examId: 'EXAM_TERM_M', subject: 'Math', type: 'Examination', raw: 55, rawMax: 60, scaled: 55, max: 60, violations: 0, answers: {}, attempt: 1, attemptsAllowed: 1, submittedAt: '2026-10-08T10:00:00Z' },
    { id: 'RES_EX2', studentId: 'STU001', examId: 'EXAM_TERM_E', subject: 'English', type: 'Examination', raw: 54, rawMax: 60, scaled: 54, max: 60, violations: 0, answers: {}, attempt: 1, attemptsAllowed: 1, submittedAt: '2026-10-09T10:00:00Z' },
    { id: 'RES_EX3', studentId: 'STU001', examId: 'EXAM_TERM_S', subject: 'Basic Science', type: 'Examination', raw: 56, rawMax: 60, scaled: 56, max: 60, violations: 0, answers: {}, attempt: 1, attemptsAllowed: 1, submittedAt: '2026-10-10T10:00:00Z' }
  ],
  attendance: [
    { studentId: 'STU001', days: 60, present: 58, absent: 2, percent: 96.67 },
    { studentId: 'STU002', days: 60, present: 57, absent: 3, percent: 95.0 },
    { studentId: 'STU003', days: 60, present: 60, absent: 0, percent: 100.0 },
    { studentId: 'STU004', days: 60, present: 55, absent: 5, percent: 91.67 },
    { studentId: 'STU005', days: 60, present: 59, absent: 1, percent: 98.33 },
    { studentId: 'STU006', days: 60, present: 50, absent: 10, percent: 83.33 }
  ],
  questions: [
    {
      id: 'qb_math_01',
      type: 'mcq',
      q: 'What is 15 + 27?',
      subject: 'Math',
      class: 'Primary 5',
      topic: 'Arithmetic & Operations',
      subtopic: 'Addition',
      difficulty: 'Easy',
      tags: ['Addition', 'Mental Math', 'Core'],
      options: ['32', '42', '52', '40'],
      ans: 1,
      marks: 1,
      explanation: '15 + 27 = 42. Adding 15 and 20 gives 35, plus 7 gives 42.',
      createdBy: 'teacher1',
      createdAt: '2026-09-01T08:00:00.000Z',
      updatedAt: '2026-09-01T08:00:00.000Z',
      status: 'active'
    },
    {
      id: 'qb_math_02',
      type: 'mcq',
      q: 'What is 8 x 7?',
      subject: 'Math',
      class: 'Primary 5',
      topic: 'Arithmetic & Operations',
      subtopic: 'Multiplication',
      difficulty: 'Medium',
      tags: ['Multiplication', 'Times Tables'],
      options: ['54', '56', '64', '48'],
      ans: 1,
      marks: 1,
      explanation: '8 multiplied by 7 is equal to 56.',
      createdBy: 'teacher1',
      createdAt: '2026-09-01T08:15:00.000Z',
      updatedAt: '2026-09-01T08:15:00.000Z',
      status: 'active'
    },
    {
      id: 'qb_math_03',
      type: 'fill_blank',
      q: 'Simplify the fraction 18/24 to its lowest terms (write in the form a/b):',
      subject: 'Math',
      class: 'Primary 5',
      topic: 'Fractions',
      subtopic: 'Simplification',
      difficulty: 'Hard',
      tags: ['Fractions', 'Division', 'Reduction'],
      answer: '3/4',
      answers: ['3/4', '3 / 4', '0.75'],
      marks: 2,
      explanation: 'Divide both 18 and 24 by their greatest common factor, which is 6: 18÷6 = 3, 24÷6 = 4, resulting in 3/4.',
      createdBy: 'teacher1',
      createdAt: '2026-09-02T09:30:00.000Z',
      updatedAt: '2026-09-02T09:30:00.000Z',
      status: 'active'
    },
    {
      id: 'qb_math_04',
      type: 'mcq',
      q: 'Solve for x: 2x + 4 = 10',
      subject: 'Math',
      class: 'JSS2',
      topic: 'Algebra',
      subtopic: 'Linear Equations',
      difficulty: 'Medium',
      tags: ['Algebra', 'Linear Equations', 'Variables'],
      options: ['2', '3', '4', '5'],
      ans: 1,
      marks: 2,
      explanation: 'Subtract 4 from both sides: 2x = 6. Divide both sides by 2: x = 3.',
      createdBy: 'teacher2',
      createdAt: '2026-09-03T11:00:00.000Z',
      updatedAt: '2026-09-03T11:00:00.000Z',
      status: 'active'
    },
    {
      id: 'qb_eng_01',
      type: 'true_false',
      q: 'An adjective is a word that describes or qualifies a noun.',
      subject: 'English',
      class: 'Primary 5',
      topic: 'Grammar',
      subtopic: 'Parts of Speech',
      difficulty: 'Easy',
      tags: ['Grammar', 'Parts of Speech', 'Adjectives'],
      ans: true,
      marks: 1,
      explanation: 'True. Adjectives provide more detail about nouns (e.g. blue sky, fast car).',
      createdBy: 'teacher1',
      createdAt: '2026-09-04T10:00:00.000Z',
      updatedAt: '2026-09-04T10:00:00.000Z',
      status: 'active'
    },
    {
      id: 'qb_eng_02',
      type: 'fill_blank',
      q: 'The synonym for "gigantic" starting with the letter "h" is ________.',
      subject: 'English',
      class: 'Primary 5',
      topic: 'Vocabulary',
      subtopic: 'Synonyms & Antonyms',
      difficulty: 'Medium',
      tags: ['Vocabulary', 'Synonyms', 'Word Power'],
      answer: 'huge',
      answers: ['huge', 'humongous', 'humungous'],
      marks: 1,
      explanation: '"Huge" and "humongous" are standard synonyms for "gigantic".',
      createdBy: 'teacher1',
      createdAt: '2026-09-04T10:30:00.000Z',
      updatedAt: '2026-09-04T10:30:00.000Z',
      status: 'active'
    },
    {
      id: 'qb_sci_01',
      type: 'diagram',
      q: 'Which organelle shown in the diagram is the site of cellular respiration and energy production?',
      subject: 'Basic Science',
      class: 'Primary 5',
      topic: 'Living Things',
      subtopic: 'Cell Biology',
      difficulty: 'Medium',
      tags: ['Cells', 'Biology', 'Organelles'],
      image: 'https://images.unsplash.com/photo-1530595467537-0b5996c41f2d?w=800&auto=format&fit=crop&q=80',
      options: ['Mitochondria', 'Chloroplast', 'Nucleus', 'Endoplasmic Reticulum'],
      ans: 0,
      marks: 2,
      explanation: 'Mitochondria are often called the powerhouses of the cell because they generate most of the chemical energy needed by the cell.',
      createdBy: 'teacher1',
      createdAt: '2026-09-05T14:00:00.000Z',
      updatedAt: '2026-09-05T14:00:00.000Z',
      status: 'active'
    },
    {
      id: 'qb_sci_02',
      type: 'mcq',
      q: 'Which of the following is a renewable source of energy?',
      subject: 'Basic Science',
      class: 'Primary 5',
      topic: 'Energy',
      subtopic: 'Renewable Resources',
      difficulty: 'Easy',
      tags: ['Energy', 'Renewable', 'Environment'],
      options: ['Coal', 'Petroleum', 'Solar energy', 'Natural Gas'],
      ans: 2,
      marks: 1,
      explanation: 'Solar energy comes from the sun and is constantly replenished naturally.',
      createdBy: 'teacher1',
      createdAt: '2026-09-06T09:00:00.000Z',
      updatedAt: '2026-09-06T09:00:00.000Z',
      status: 'active'
    },
    {
      id: 'qb_sci_03',
      type: 'true_false',
      q: 'Sound travels faster in solids than in gases such as air.',
      subject: 'Basic Science',
      class: 'Primary 5',
      topic: 'Energy',
      subtopic: 'Sound Waves',
      difficulty: 'Hard',
      tags: ['Physics', 'Sound', 'Mediums'],
      ans: true,
      marks: 2,
      explanation: 'True. Particles in solids are tightly packed together, allowing sound wave vibrations to transmit much faster than in gases.',
      createdBy: 'teacher1',
      createdAt: '2026-09-07T12:00:00.000Z',
      updatedAt: '2026-09-07T12:00:00.000Z',
      status: 'active'
    }
  ],
  assessments: [
    // STU001 - Aisha Bello (Matches prompt illustrative example: English 16/18, Math 14/17, Basic Science 18/15, Nigerian History 12/16)
    { id: 'stu001_english_ca1_2026_2027_first_term', schoolId: 'demo', studentId: 'STU001', studentName: 'Aisha Bello', classId: 'Primary 5', subjectId: 'English', academicSessionId: '2026/2027', termId: 'First Term', assessmentType: 'CA1', score: 16, maximumScore: 20, status: 'submitted', enteredBy: { id: 'teacher1', name: 'Mr. Okafor', role: 'teacher' }, enteredAt: '2026-09-20T10:00:00.000Z' },
    { id: 'stu001_english_ca2_2026_2027_first_term', schoolId: 'demo', studentId: 'STU001', studentName: 'Aisha Bello', classId: 'Primary 5', subjectId: 'English', academicSessionId: '2026/2027', termId: 'First Term', assessmentType: 'CA2', score: 18, maximumScore: 20, status: 'submitted', enteredBy: { id: 'teacher1', name: 'Mr. Okafor', role: 'teacher' }, enteredAt: '2026-10-04T09:30:00.000Z' },

    { id: 'stu001_math_ca1_2026_2027_first_term', schoolId: 'demo', studentId: 'STU001', studentName: 'Aisha Bello', classId: 'Primary 5', subjectId: 'Math', academicSessionId: '2026/2027', termId: 'First Term', assessmentType: 'CA1', score: 14, maximumScore: 20, status: 'submitted', enteredBy: { id: 'teacher1', name: 'Mr. Okafor', role: 'teacher' }, enteredAt: '2026-09-18T10:00:00.000Z' },
    { id: 'stu001_math_ca2_2026_2027_first_term', schoolId: 'demo', studentId: 'STU001', studentName: 'Aisha Bello', classId: 'Primary 5', subjectId: 'Math', academicSessionId: '2026/2027', termId: 'First Term', assessmentType: 'CA2', score: 17, maximumScore: 20, status: 'submitted', enteredBy: { id: 'teacher1', name: 'Mr. Okafor', role: 'teacher' }, enteredAt: '2026-10-02T10:00:00.000Z' },

    { id: 'stu001_basic_science_ca1_2026_2027_first_term', schoolId: 'demo', studentId: 'STU001', studentName: 'Aisha Bello', classId: 'Primary 5', subjectId: 'Basic Science', academicSessionId: '2026/2027', termId: 'First Term', assessmentType: 'CA1', score: 18, maximumScore: 20, status: 'submitted', enteredBy: { id: 'teacher1', name: 'Mr. Okafor', role: 'teacher' }, enteredAt: '2026-09-26T11:15:00.000Z' },
    { id: 'stu001_basic_science_ca2_2026_2027_first_term', schoolId: 'demo', studentId: 'STU001', studentName: 'Aisha Bello', classId: 'Primary 5', subjectId: 'Basic Science', academicSessionId: '2026/2027', termId: 'First Term', assessmentType: 'CA2', score: 15, maximumScore: 20, status: 'submitted', enteredBy: { id: 'teacher1', name: 'Mr. Okafor', role: 'teacher' }, enteredAt: '2026-10-06T11:15:00.000Z' },

    { id: 'stu001_nigerian_history_ca1_2026_2027_first_term', schoolId: 'demo', studentId: 'STU001', studentName: 'Aisha Bello', classId: 'Primary 5', subjectId: 'Nigerian History', academicSessionId: '2026/2027', termId: 'First Term', assessmentType: 'CA1', score: 12, maximumScore: 20, status: 'submitted', enteredBy: { id: 'teacher1', name: 'Mr. Okafor', role: 'teacher' }, enteredAt: '2026-09-28T09:00:00.000Z' },
    { id: 'stu001_nigerian_history_ca2_2026_2027_first_term', schoolId: 'demo', studentId: 'STU001', studentName: 'Aisha Bello', classId: 'Primary 5', subjectId: 'Nigerian History', academicSessionId: '2026/2027', termId: 'First Term', assessmentType: 'CA2', score: 16, maximumScore: 20, status: 'submitted', enteredBy: { id: 'teacher1', name: 'Mr. Okafor', role: 'teacher' }, enteredAt: '2026-10-07T09:00:00.000Z' },

    // STU002 - Chukwudi Eze
    { id: 'stu002_english_ca1_2026_2027_first_term', schoolId: 'demo', studentId: 'STU002', studentName: 'Chukwudi Eze', classId: 'Primary 5', subjectId: 'English', academicSessionId: '2026/2027', termId: 'First Term', assessmentType: 'CA1', score: 15, maximumScore: 20, status: 'submitted', enteredBy: { id: 'teacher1', name: 'Mr. Okafor', role: 'teacher' }, enteredAt: '2026-09-20T10:00:00.000Z' },
    { id: 'stu002_english_ca2_2026_2027_first_term', schoolId: 'demo', studentId: 'STU002', studentName: 'Chukwudi Eze', classId: 'Primary 5', subjectId: 'English', academicSessionId: '2026/2027', termId: 'First Term', assessmentType: 'CA2', score: 16, maximumScore: 20, status: 'submitted', enteredBy: { id: 'teacher1', name: 'Mr. Okafor', role: 'teacher' }, enteredAt: '2026-10-04T09:30:00.000Z' },
    { id: 'stu002_math_ca1_2026_2027_first_term', schoolId: 'demo', studentId: 'STU002', studentName: 'Chukwudi Eze', classId: 'Primary 5', subjectId: 'Math', academicSessionId: '2026/2027', termId: 'First Term', assessmentType: 'CA1', score: 13, maximumScore: 20, status: 'submitted', enteredBy: { id: 'teacher1', name: 'Mr. Okafor', role: 'teacher' }, enteredAt: '2026-09-18T10:00:00.000Z' },
    { id: 'stu002_math_ca2_2026_2027_first_term', schoolId: 'demo', studentId: 'STU002', studentName: 'Chukwudi Eze', classId: 'Primary 5', subjectId: 'Math', academicSessionId: '2026/2027', termId: 'First Term', assessmentType: 'CA2', score: 15, maximumScore: 20, status: 'submitted', enteredBy: { id: 'teacher1', name: 'Mr. Okafor', role: 'teacher' }, enteredAt: '2026-10-02T10:00:00.000Z' },
    { id: 'stu002_basic_science_ca1_2026_2027_first_term', schoolId: 'demo', studentId: 'STU002', studentName: 'Chukwudi Eze', classId: 'Primary 5', subjectId: 'Basic Science', academicSessionId: '2026/2027', termId: 'First Term', assessmentType: 'CA1', score: 14, maximumScore: 20, status: 'submitted', enteredBy: { id: 'teacher1', name: 'Mr. Okafor', role: 'teacher' }, enteredAt: '2026-09-26T11:15:00.000Z' },
    { id: 'stu002_basic_science_ca2_2026_2027_first_term', schoolId: 'demo', studentId: 'STU002', studentName: 'Chukwudi Eze', classId: 'Primary 5', subjectId: 'Basic Science', academicSessionId: '2026/2027', termId: 'First Term', assessmentType: 'CA2', score: 16, maximumScore: 20, status: 'submitted', enteredBy: { id: 'teacher1', name: 'Mr. Okafor', role: 'teacher' }, enteredAt: '2026-10-06T11:15:00.000Z' },
    { id: 'stu002_nigerian_history_ca1_2026_2027_first_term', schoolId: 'demo', studentId: 'STU002', studentName: 'Chukwudi Eze', classId: 'Primary 5', subjectId: 'Nigerian History', academicSessionId: '2026/2027', termId: 'First Term', assessmentType: 'CA1', score: 14, maximumScore: 20, status: 'submitted', enteredBy: { id: 'teacher1', name: 'Mr. Okafor', role: 'teacher' }, enteredAt: '2026-09-28T09:00:00.000Z' },
    { id: 'stu002_nigerian_history_ca2_2026_2027_first_term', schoolId: 'demo', studentId: 'STU002', studentName: 'Chukwudi Eze', classId: 'Primary 5', subjectId: 'Nigerian History', academicSessionId: '2026/2027', termId: 'First Term', assessmentType: 'CA2', score: 15, maximumScore: 20, status: 'submitted', enteredBy: { id: 'teacher1', name: 'Mr. Okafor', role: 'teacher' }, enteredAt: '2026-10-07T09:00:00.000Z' },

    // STU003 - Fatima Ibrahim (High performer: 19s and 20s)
    { id: 'stu003_english_ca1_2026_2027_first_term', schoolId: 'demo', studentId: 'STU003', studentName: 'Fatima Ibrahim', classId: 'Primary 5', subjectId: 'English', academicSessionId: '2026/2027', termId: 'First Term', assessmentType: 'CA1', score: 19, maximumScore: 20, status: 'submitted', enteredBy: { id: 'teacher1', name: 'Mr. Okafor', role: 'teacher' }, enteredAt: '2026-09-20T10:00:00.000Z' },
    { id: 'stu003_english_ca2_2026_2027_first_term', schoolId: 'demo', studentId: 'STU003', studentName: 'Fatima Ibrahim', classId: 'Primary 5', subjectId: 'English', academicSessionId: '2026/2027', termId: 'First Term', assessmentType: 'CA2', score: 19, maximumScore: 20, status: 'submitted', enteredBy: { id: 'teacher1', name: 'Mr. Okafor', role: 'teacher' }, enteredAt: '2026-10-04T09:30:00.000Z' },
    { id: 'stu003_math_ca1_2026_2027_first_term', schoolId: 'demo', studentId: 'STU003', studentName: 'Fatima Ibrahim', classId: 'Primary 5', subjectId: 'Math', academicSessionId: '2026/2027', termId: 'First Term', assessmentType: 'CA1', score: 20, maximumScore: 20, status: 'submitted', enteredBy: { id: 'teacher1', name: 'Mr. Okafor', role: 'teacher' }, enteredAt: '2026-09-18T10:00:00.000Z' },
    { id: 'stu003_math_ca2_2026_2027_first_term', schoolId: 'demo', studentId: 'STU003', studentName: 'Fatima Ibrahim', classId: 'Primary 5', subjectId: 'Math', academicSessionId: '2026/2027', termId: 'First Term', assessmentType: 'CA2', score: 20, maximumScore: 20, status: 'submitted', enteredBy: { id: 'teacher1', name: 'Mr. Okafor', role: 'teacher' }, enteredAt: '2026-10-02T10:00:00.000Z' },
    { id: 'stu003_basic_science_ca1_2026_2027_first_term', schoolId: 'demo', studentId: 'STU003', studentName: 'Fatima Ibrahim', classId: 'Primary 5', subjectId: 'Basic Science', academicSessionId: '2026/2027', termId: 'First Term', assessmentType: 'CA1', score: 20, maximumScore: 20, status: 'submitted', enteredBy: { id: 'teacher1', name: 'Mr. Okafor', role: 'teacher' }, enteredAt: '2026-09-26T11:15:00.000Z' },
    { id: 'stu003_basic_science_ca2_2026_2027_first_term', schoolId: 'demo', studentId: 'STU003', studentName: 'Fatima Ibrahim', classId: 'Primary 5', subjectId: 'Basic Science', academicSessionId: '2026/2027', termId: 'First Term', assessmentType: 'CA2', score: 19, maximumScore: 20, status: 'submitted', enteredBy: { id: 'teacher1', name: 'Mr. Okafor', role: 'teacher' }, enteredAt: '2026-10-06T11:15:00.000Z' },

    // STU004 - Emmanuel Adeyemi (Illustrating a pupil with an unrecorded CA2 in Nigerian History)
    { id: 'stu004_english_ca1_2026_2027_first_term', schoolId: 'demo', studentId: 'STU004', studentName: 'Emmanuel Adeyemi', classId: 'Primary 5', subjectId: 'English', academicSessionId: '2026/2027', termId: 'First Term', assessmentType: 'CA1', score: 12, maximumScore: 20, status: 'submitted', enteredBy: { id: 'teacher1', name: 'Mr. Okafor', role: 'teacher' }, enteredAt: '2026-09-20T10:00:00.000Z' },
    { id: 'stu004_english_ca2_2026_2027_first_term', schoolId: 'demo', studentId: 'STU004', studentName: 'Emmanuel Adeyemi', classId: 'Primary 5', subjectId: 'English', academicSessionId: '2026/2027', termId: 'First Term', assessmentType: 'CA2', score: 14, maximumScore: 20, status: 'submitted', enteredBy: { id: 'teacher1', name: 'Mr. Okafor', role: 'teacher' }, enteredAt: '2026-10-04T09:30:00.000Z' },
    { id: 'stu004_math_ca1_2026_2027_first_term', schoolId: 'demo', studentId: 'STU004', studentName: 'Emmanuel Adeyemi', classId: 'Primary 5', subjectId: 'Math', academicSessionId: '2026/2027', termId: 'First Term', assessmentType: 'CA1', score: 10, maximumScore: 20, status: 'submitted', enteredBy: { id: 'teacher1', name: 'Mr. Okafor', role: 'teacher' }, enteredAt: '2026-09-18T10:00:00.000Z' },
    { id: 'stu004_math_ca2_2026_2027_first_term', schoolId: 'demo', studentId: 'STU004', studentName: 'Emmanuel Adeyemi', classId: 'Primary 5', subjectId: 'Math', academicSessionId: '2026/2027', termId: 'First Term', assessmentType: 'CA2', score: 12, maximumScore: 20, status: 'submitted', enteredBy: { id: 'teacher1', name: 'Mr. Okafor', role: 'teacher' }, enteredAt: '2026-10-02T10:00:00.000Z' },
    { id: 'stu004_basic_science_ca1_2026_2027_first_term', schoolId: 'demo', studentId: 'STU004', studentName: 'Emmanuel Adeyemi', classId: 'Primary 5', subjectId: 'Basic Science', academicSessionId: '2026/2027', termId: 'First Term', assessmentType: 'CA1', score: 11, maximumScore: 20, status: 'submitted', enteredBy: { id: 'teacher1', name: 'Mr. Okafor', role: 'teacher' }, enteredAt: '2026-09-26T11:15:00.000Z' },
    { id: 'stu004_basic_science_ca2_2026_2027_first_term', schoolId: 'demo', studentId: 'STU004', studentName: 'Emmanuel Adeyemi', classId: 'Primary 5', subjectId: 'Basic Science', academicSessionId: '2026/2027', termId: 'First Term', assessmentType: 'CA2', score: 13, maximumScore: 20, status: 'submitted', enteredBy: { id: 'teacher1', name: 'Mr. Okafor', role: 'teacher' }, enteredAt: '2026-10-06T11:15:00.000Z' },
    { id: 'stu004_nigerian_history_ca1_2026_2027_first_term', schoolId: 'demo', studentId: 'STU004', studentName: 'Emmanuel Adeyemi', classId: 'Primary 5', subjectId: 'Nigerian History', academicSessionId: '2026/2027', termId: 'First Term', assessmentType: 'CA1', score: 13, maximumScore: 20, status: 'submitted', enteredBy: { id: 'teacher1', name: 'Mr. Okafor', role: 'teacher' }, enteredAt: '2026-09-28T09:00:00.000Z' }
    // Note: STU004 has no CA2 for Nigerian History yet - demonstrates unrecorded assessment handling
  ]
};

export const CLASS_OPTIONS = [
  'Creche', 'Nursery 1', 'Nursery 2', 'Nursery 3',
  'Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6',
  'JSS1', 'JSS2', 'JSS3', 'SS1', 'SS2', 'SS3', 'Other'
];
