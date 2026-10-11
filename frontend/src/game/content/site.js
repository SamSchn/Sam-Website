// Everything visitors read inside the house lives here.
// TODO(sam): replace the placeholder text, links and projects with your own.

export const SITE = {
  title: "Sam's Valley",
  owner: 'Sam Schneider',
};

export const ABOUT = {
  heading: "Hi, I'm Sam!",
  tagline: 'Builder of things, tender of digital gardens.',
  paragraphs: [
    "Welcome to my little corner of the internet. Instead of a regular website, I built a village — every building is a different part of my world.",
    "I like making software that feels handmade: playful, a little cozy, and genuinely useful. When I'm not coding you'll probably find me outside, reading, or tinkering on a side project.",
    'Have a look around the house. The bookshelf has my projects, the desk has my resume, and the bulletin board has the latest notes.',
  ],
  facts: [
    { label: 'Based in', value: 'Somewhere sunny' },
    { label: 'Currently', value: 'Building this village' },
    { label: 'Favourite crop', value: 'Blueberries' },
  ],
};

export const PROJECTS = [
  {
    name: "Sam's Valley",
    year: '2026',
    color: '#c42430',
    description: 'This website! A Stardew Valley–inspired village built with React, PixiJS and a small Node/SQLite backend. Every page is a place you can walk to.',
    tags: ['React', 'PixiJS', 'Node', 'SQLite'],
    link: 'https://github.com/SamSchn/Sam-Website',
  },
  {
    name: 'Digital Garden',
    year: '2026',
    color: '#33984b',
    description: 'Ideas planted as seeds that grow when watered. Visitors can send them sunshine. Head east from the village to visit it.',
    tags: ['Game design', 'PixiJS'],
    link: '/garden',
  },
  {
    name: 'Project placeholder',
    year: '2025',
    color: '#3b6fb6',
    description: 'Replace this with a real project: what it does, what you learned, and a link to try it.',
    tags: ['Your stack here'],
    link: null,
  },
];

export const RESUME = {
  // Put a PDF in frontend/public/ (e.g. /resume.pdf) and set the path here
  pdf: null,
  summary: 'Software developer who enjoys building thoughtful, playful products end to end.',
  experience: [
    {
      role: 'Your Role',
      org: 'Company Name',
      dates: '2024 — Present',
      points: ['What you built or improved', 'An impact you are proud of'],
    },
    {
      role: 'Previous Role',
      org: 'Another Company',
      dates: '2022 — 2024',
      points: ['Something you shipped', 'A skill you grew'],
    },
  ],
  education: [{ school: 'Your School', detail: 'Degree, Year' }],
  skills: ['JavaScript', 'React', 'Node.js', 'SQL', 'Pixel art (beginner)'],
};

export const CONTACT = [
  { icon: 'github', label: 'GitHub', value: 'github.com/SamSchn', href: 'https://github.com/SamSchn' },
  { icon: 'mail', label: 'Email', value: 'hello@example.com', href: 'mailto:hello@example.com' },
  { icon: 'linkedin', label: 'LinkedIn', value: 'linkedin.com/in/your-profile', href: 'https://www.linkedin.com/' },
];

// Shown on the TV when no news has been posted yet
export const NEWS_WELCOME = {
  title: 'Welcome to Valley News!',
  body: "This is where Sam broadcasts updates about projects, life and the village.\n\nNothing's been announced yet — check back soon!",
};

// Shown on the bulletin board when nothing is pinned yet
export const BOARD_WELCOME = [
  { id: 'w1', content: 'Welcome to the village! Explore, poke around, and have fun.', color: '#ffe08a', author_name: 'Sam' },
  { id: 'w2', content: 'Head east down the road to visit the Digital Garden.', color: '#c8ecb0', author_name: 'Sam' },
  { id: 'w3', content: 'The bookshelf has projects, the desk has my resume.', color: '#bde0f6', author_name: 'Sam' },
];

// First-visit greeting, shown once (replay it from the menu)
export const WELCOME = {
  speaker: 'Sam',
  portrait: '/sprites/custom/portrait.png',
  lines: [
    "Hey, welcome to my valley! I'm Sam.",
    'This whole website is a little village. Walk around with WASD or the arrow keys — or just click where you want to go.',
    'My house is right behind you. Step inside to find my projects, resume, and a way to reach me.',
    'Press E (or click) to use things. Have a look around!',
  ],
  touchLines: [
    "Hey, welcome to my valley! I'm Sam.",
    'This whole website is a little village. Tap anywhere to walk there.',
    'My house is right behind you. Step inside to find my projects, resume, and a way to reach me.',
    'Tap things to use them. Have a look around!',
  ],
};
