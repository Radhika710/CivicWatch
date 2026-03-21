import {
  FaHospitalUser,
  FaFistRaised,
  FaLeaf,
  FaVirus,
  FaBalanceScale,
  FaGlobe,
  FaCogs,
  FaGavel,
  FaHeartbeat,
  FaDollarSign,
  FaGlobeAmericas,
  FaGraduationCap,
  FaHandsHelping,
  FaTag,
  FaShieldAlt,
  FaHardHat,
  FaPassport,
  FaBus,
  FaBolt,
  FaTheaterMasks,
  FaHome,
  FaTractor,
  FaMicrochip,
  FaMountain,
  FaLandmark,
  FaQuestionCircle,
} from 'react-icons/fa';
import { GiCapitol, GiBrickWall, GiPistolGun } from 'react-icons/gi';

// Export topic icons as components
export const topicIcons = {
  all: FaGlobe,
  capitol: GiCapitol,
  immigra: GiBrickWall,
  abortion: FaHospitalUser,
  blacklivesmatter: FaFistRaised,
  climate: FaLeaf,
  gun: GiPistolGun,
  rights: FaBalanceScale,
  covid: FaVirus,

  // --------------------------------------------------------------------------
  // CAP topic set (full labels)
  // --------------------------------------------------------------------------
  'Government Operations': FaCogs,
  'Civil Rights': FaBalanceScale,
  'Law and Crime': FaGavel,
  'Health': FaHeartbeat,
  'Macroeconomics': FaDollarSign,
  'International Affairs': FaGlobeAmericas,
  'Education': FaGraduationCap,
  'Social Welfare': FaHandsHelping,
  'Unclassified': FaTag,
  'Defense': FaShieldAlt,
  'Labor': FaHardHat,
  'Environment': FaLeaf,
  'Immigration': FaPassport,
  'Transportation': FaBus,
  'Energy': FaBolt,
  'Culture': FaTheaterMasks,
  'Housing': FaHome,
  'Agriculture': FaTractor,
  'Technology': FaMicrochip,
  'Public Lands': FaMountain,
  'Banking, Finance, and Domestic Commerce': FaLandmark,
  'Unknown Topic': FaQuestionCircle,
  // Sidebar's special-case label
  'Unknown Topic (999)': FaQuestionCircle,
};

// Export color map with accessible color scheme (no party differentiation)
export const colorMap = {
  capitol:          { color: '#3B82F6' }, // Blue
  immigra:          { color: '#10B981' }, // Green
  abortion:         { color: '#F59E0B' }, // Amber
  blacklivesmatter: { color: '#EF4444' }, // Red
  climate:          { color: '#8B5CF6' }, // Purple
  gun:              { color: '#F97316' }, // Orange
  rights:           { color: '#06B6D4' }, // Cyan
  covid:            { color: '#84CC16' }  // Lime
};

// Topic name mapping for display
export const topicNames = {
  capitol: 'Capitol',
  immigra: 'Immigration',
  abortion: 'Abortion',
  blacklivesmatter: 'Black Lives Matter',
  climate: 'Climate Change',
  gun: 'Gun Rights',
  rights: 'Civil Rights',
  covid: 'COVID-19',

  // CAP topic labels (identity mapping, but explicit for consistency)
  'Government Operations': 'Government Operations',
  'Civil Rights': 'Civil Rights',
  'Law and Crime': 'Law and Crime',
  'Health': 'Health',
  'Macroeconomics': 'Macroeconomics',
  'International Affairs': 'International Affairs',
  'Education': 'Education',
  'Social Welfare': 'Social Welfare',
  'Unclassified': 'Unclassified',
  'Defense': 'Defense',
  'Labor': 'Labor',
  'Environment': 'Environment',
  'Immigration': 'Immigration',
  'Transportation': 'Transportation',
  'Energy': 'Energy',
  'Culture': 'Culture',
  'Housing': 'Housing',
  'Agriculture': 'Agriculture',
  'Technology': 'Technology',
  'Public Lands': 'Public Lands',
  'Banking, Finance, and Domestic Commerce': 'Banking, Finance, and Domestic Commerce',
  'Unknown Topic': 'Unknown Topic',
  'Unknown Topic (999)': 'Unknown Topic',
};

// Helper function to extract a clean display name from topic_label
// Format: "213_: New Year Wishes and Provisions___" -> "New Year Wishes and Provisions"
// Also handles: "21_: George Floyd Protests and Justice___" -> "George Floyd Protests and Justice"
export const formatTopicLabel = (topicLabel) => {
  if (!topicLabel) return topicLabel;
  // Remove trailing underscores and extract the description part
  const match = topicLabel.match(/^\d+[_:]\s*(.+?)_*$/);
  if (match && match[1]) {
    let cleaned = match[1].trim();
    // Remove leading ": " if present
    cleaned = cleaned.replace(/^:\s*/, '');
    // Remove trailing underscores
    cleaned = cleaned.replace(/_+$/, '');
    return cleaned.trim();
  }
  // Fallback: remove ": " prefix if present anywhere
  return topicLabel.replace(/^:\s*/, '').trim();
};

// Helper function to convert HSL to hex color
const hslToHex = (h, s, l) => {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  
  if (0 <= h && h < 60) {
    r = c; g = x; b = 0;
  } else if (60 <= h && h < 120) {
    r = x; g = c; b = 0;
  } else if (120 <= h && h < 180) {
    r = 0; g = c; b = x;
  } else if (180 <= h && h < 240) {
    r = 0; g = x; b = c;
  } else if (240 <= h && h < 300) {
    r = x; g = 0; b = c;
  } else if (300 <= h && h < 360) {
    r = c; g = 0; b = x;
  }
  
  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);
  
  // Convert to hex
  const toHex = (n) => {
    const hex = n.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

// Helper function to generate a consistent color for a topic_label
export const getTopicColor = (topicLabel) => {
  // First check if it's in the colorMap (for backward compatibility)
  if (colorMap[topicLabel]?.color) {
    return colorMap[topicLabel].color;
  }
  
  // Generate a hash-based color for topic_labels
  let hash = 0;
  for (let i = 0; i < topicLabel.length; i++) {
    hash = topicLabel.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Generate a color from the hash (using HSL for better color distribution)
  const hue = Math.abs(hash) % 360;
  const saturation = 60 + (Math.abs(hash) % 20); // 60-80%
  const lightness = 45 + (Math.abs(hash) % 15); // 45-60%
  
  // Convert HSL to hex for compatibility with gradient opacity
  return hslToHex(hue, saturation, lightness);
};

// Function to format numbers with optional decimal truncation
export const formatNumber = (num) => {
  if (num >= 1000000) {
    const formatted = (num / 1000000).toFixed(1);
    return formatted.endsWith('.0') ? `${Math.round(num / 1000000)}M` : `${formatted}M`;
  }
  if (num >= 1000) {
    const formatted = (num / 1000).toFixed(1);
    return formatted.endsWith('.0') ? `${Math.round(num / 1000)}K` : `${formatted}K`;
  }
  return num.toString();
};

export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}


export function stableStringify(obj) {
  if (obj === null || obj === undefined) return String(obj);
  if (typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    return '[' + obj.map(stableStringify).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
} 