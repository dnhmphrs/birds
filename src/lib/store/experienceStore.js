import { writable } from 'svelte/store';

// Define all experiences with their metadata
const experienceData = [
  {
    id: 'flocking',
    name: 'FLOCKING',
    description: 'Simulation of collective motion in flocks using parallel compute shaders. Simple local rules generate complex global murmurations; cute emergent behavior in natural systems.',
    color: '#00bfff'
  },
  // {
  //   id: 'wikiground',
  //   name: 'WIKIGROUND',
  //   description: 'Interactive 3D visualisation of the world\'s topography.',
  //   color: '#FFDF00'
  // },
  {
    id: 'neuralnet',
    name: 'NEURAL NET',
    description: 'Interactive visualization of neural network training. No use yet. When I make NNs I will also visualise them. I like pretty pictures.',
    color: '#ff3366'
  },
  {
    id: 'riemann',
    name: 'RIEMANN SURFACES',
    description: 'Visualization of complex mathematical functions as 3D surfaces. Early steps to figuring out what Riemann was on about in his 1851 thesis.',
    color: '#00ff99'
  },
  {
    id: 'gridcode',
    name: 'Θ-FUNCTION // GRID CODE',
    description: 'Model of medial entorhinal grid cells using the Riemann theta function. Visualising how the brain encodes spatial information in a structured form..',
    color: '#ff9900'
  }
];

// Create a writable store with the experience data
export const experiences = writable(experienceData);

// Helper function to get an experience by ID
export function getExperienceById(id) {
  return experienceData.find(exp => exp.id === id) || null;
}

// Helper function to get an experience's color by ID
export function getExperienceColor(id) {
  const experience = getExperienceById(id);
  return experience ? experience.color : '#ffffff';
} 