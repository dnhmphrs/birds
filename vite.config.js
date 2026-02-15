import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import glsl from 'vite-plugin-glsl';

export default defineConfig({
	plugins: [
		sveltekit(),
		glsl({
			include: [
				'**/*.glsl',
				'**/*.wgsl',
			],
		}),
		{
			name: 'vite-plugin-wgsl',
			transform(code, id) {
				if (id.endsWith('.wgsl')) {
					return {
						code: `export default ${JSON.stringify(code)};`,
						map: null
					};
				}
			}
		}
	],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}']
	},
	assetsInclude: ['**/*.wgsl']
});
