// Minimalist custom SVG icons for FutureTrackAI
export const CustomEmojis = {
  // Avatar icons (learning styles)
  rocket: (size = 24) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L8 8H4V16C4 17.1 4.9 18 6 18H18C19.1 18 20 17.1 20 16V8H16L12 2Z" fill="currentColor" stroke="currentColor" strokeWidth="0.5" strokeLinejoin="round"/>
      <circle cx="12" cy="12" r="3" fill="white"/>
    </svg>
  ),
  star: (size = 24) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L15.09 10.26H24L17.55 15.74L20.64 24L12 18.52L3.36 24L6.45 15.74L0 10.26H8.91L12 2Z" fill="currentColor"/>
    </svg>
  ),
  palette: (size = 24) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" fill="none"/>
      <circle cx="8" cy="9" r="1.5" fill="currentColor"/>
      <circle cx="16" cy="9" r="1.5" fill="currentColor"/>
      <circle cx="10" cy="15" r="1.5" fill="currentColor"/>
      <circle cx="14" cy="15" r="1.5" fill="currentColor"/>
    </svg>
  ),
  microscope: (size = 24) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 5V8M14 5V8M8 8H16V18C16 19.1 15.1 20 14 20H10C8.9 20 8 19.1 8 18V8Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" fill="none"/>
      <path d="M5 20H19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  music: (size = 24) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 20V9L18 4V15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="6" cy="20" r="2" fill="currentColor"/>
      <circle cx="18" cy="15" r="2" fill="currentColor"/>
    </svg>
  ),
  zap: (size = 24) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" fill="currentColor"/>
    </svg>
  ),
  globe: (size = 24) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" fill="none"/>
      <path d="M2 12H22M12 2C10 6 10 18 12 22C14 18 14 6 12 2Z" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  ),
  heart: (size = 24) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20.84 4.61C21.55 5.35 22 6.34 22 7.38C22 8.42 21.55 9.41 20.84 10.15L12 18.99L3.16 10.15C1.69 8.68 1.69 6.27 3.16 4.8C4.63 3.33 7.04 3.33 8.51 4.8L12 8.29L15.49 4.8C16.96 3.33 19.37 3.33 20.84 4.61Z" fill="currentColor"/>
    </svg>
  ),
  bookOpen: (size = 24) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 3H12V19H4C3.45 19 3 18.55 3 18V4C3 3.45 3.45 3 4 3ZM12 3H20C20.55 3 21 3.45 21 4V18C21 18.55 20.55 19 20 19H12V3Z" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    </svg>
  ),
  lightbulb: (size = 24) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C9.24 2 7 4.24 7 7C7 9.27 8.41 11.17 10.5 11.9V15H13.5V11.9C15.59 11.17 17 9.27 17 7C17 4.24 14.76 2 12 2Z" fill="currentColor"/>
      <rect x="10" y="15" width="4" height="2" fill="currentColor"/>
      <rect x="11" y="17" width="2" height="2" fill="currentColor"/>
    </svg>
  ),

  // Recommendation type icons
  careerPath: (size = 20) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Rocket launching upward */}
      <path d="M10 2C10 2 14 5 14 10H6C6 5 10 2 10 2Z" fill="currentColor" opacity="0.9"/>
      <rect x="7" y="10" width="6" height="4" rx="1" fill="currentColor"/>
      <path d="M6 12L4 14V13C4 11.9 4.9 11 6 11V12Z" fill="currentColor" opacity="0.7"/>
      <path d="M14 12L16 14V13C16 11.9 15.1 11 14 11V12Z" fill="currentColor" opacity="0.7"/>
      <circle cx="10" cy="8" r="1.5" fill="white" opacity="0.8"/>
      <path d="M8 14L7 17H9L10 15L11 17H13L12 14H8Z" fill="currentColor" opacity="0.6"/>
    </svg>
  ),
  skill: (size = 20) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Lightning bolt inside a circle - power/skill */}
      <circle cx="10" cy="10" r="8" fill="currentColor" opacity="0.15"/>
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" fill="none"/>
      <path d="M11.5 4L7 11H10.5L8.5 16L14 9H10.5L11.5 4Z" fill="currentColor"/>
    </svg>
  ),
  course: (size = 20) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Open book with a bookmark */}
      <path d="M3 4C3 3.45 3.45 3 4 3H9.5V15H4C3.45 15 3 14.55 3 14V4Z" fill="currentColor" opacity="0.8"/>
      <path d="M10.5 3H16C16.55 3 17 3.45 17 4V14C17 14.55 16.55 15 16 15H10.5V3Z" fill="currentColor" opacity="0.5"/>
      <path d="M10 3V15" stroke="white" strokeWidth="1" opacity="0.6"/>
      <path d="M5 17H15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M13 3V8L11.5 6.5L10.5 8V3" fill="white" opacity="0.9"/>
    </svg>
  ),
  activity: (size = 20) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Heartbeat / activity line */}
      <circle cx="10" cy="10" r="8" fill="currentColor" opacity="0.12"/>
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" fill="none"/>
      <polyline points="3,10 6,10 7.5,6 9.5,14 11.5,8 13,10 17,10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  ),
  project: (size = 20) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Gear / cog - building/making things */}
      <circle cx="10" cy="10" r="3" fill="currentColor"/>
      <path d="M10 2V4.5M10 15.5V18M2 10H4.5M15.5 10H18M4.22 4.22L5.99 5.99M14.01 14.01L15.78 15.78M15.78 4.22L14.01 5.99M5.99 14.01L4.22 15.78" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <circle cx="10" cy="10" r="5.5" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.4"/>
    </svg>
  ),
};

// Map recommendation types to icons
export const recommendationIcons = {
  'Career Path': CustomEmojis.careerPath,
  'Skill': CustomEmojis.skill,
  'Course': CustomEmojis.course,
  'Activity': CustomEmojis.activity,
  'Project': CustomEmojis.project,
};

// Map avatars
export const avatarIcons = {
  '🚀': CustomEmojis.rocket,
  '🌟': CustomEmojis.star,
  '🎨': CustomEmojis.palette,
  '🔬': CustomEmojis.microscope,
  '🎵': CustomEmojis.music,
  '⚡': CustomEmojis.zap,
  '🌍': CustomEmojis.globe,
  '💡': CustomEmojis.lightbulb,
  '🎮': CustomEmojis.zap,
  '🦋': CustomEmojis.star,
  '🔥': CustomEmojis.zap,
  '🌈': CustomEmojis.palette,
};