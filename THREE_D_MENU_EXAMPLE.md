// Example usage of ThreeDMenu component
import { ThreeDMenu } from './src/components/roster/ThreeDMenu';
import { generateCharacter } from './src/gameEngine';

// Sample characters for testing
const sampleCharacters = [
  generateCharacter('01_north_america'),
  generateCharacter('02_south_america'),
  generateCharacter('03_western_europe'),
  generateCharacter('04_eastern_europe'),
  generateCharacter('05_middle_east'),
];

// Usage example:
// <ThreeDMenu
//   characters={sampleCharacters}
//   title="3D Character Selection"
//   onCharacterSelect={(character) => console.log('Selected:', character.name)}
//   onPreviewImage={(imageUrl) => console.log('Preview:', imageUrl)}
//   maxSelections={1}
//   allowMultiSelect={false}
// />