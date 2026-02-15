export { matchers } from './matchers.js';

export const nodes = [
	() => import('./nodes/0'),
	() => import('./nodes/1'),
	() => import('./nodes/2'),
	() => import('./nodes/3'),
	() => import('./nodes/4'),
	() => import('./nodes/5'),
	() => import('./nodes/6'),
	() => import('./nodes/7'),
	() => import('./nodes/8')
];

export const server_loads = [0];

export const dictionary = {
		"/": [2],
		"/experience/flocking": [4],
		"/experience/gridcode": [5],
		"/experience/neuralnet": [6],
		"/experience/riemann": [7],
		"/experience/wikiground": [8],
		"/experience/[...catchall]": [3]
	};

export const hooks = {
	handleError: (({ error }) => { console.error(error) }),
};

export { default as root } from '../root.svelte';