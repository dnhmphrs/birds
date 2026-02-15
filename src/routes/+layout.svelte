<script>
	import './styles.css';

	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { webVitals } from '$lib/vitals';

	import { onMount, onDestroy } from 'svelte';
	import { screenType, isIframe, screenSize } from '$lib/store/store';
	import { getDeviceType, getScreenSize } from '$lib/functions/utils';
	import MemoryStats from '$lib/components/MemoryStats.svelte';

	export let data;
	let Geometry;
	
	// Memory stats
	let showMemoryStats = true;

	$: if (browser && data?.analyticsId) {
		webVitals({
			path: $page.url.pathname,
			params: $page.params,
			analyticsId: data.analyticsId
		});
	}

	function handleScreen() {
		// screen size
		screenSize.set(getScreenSize());

		// device type
		screenType.set(getDeviceType());
		isIframe.set(window.location !== window.parent.location);
	}

	// Get the current path
	$: currentPath = $page.url.pathname;
	
	// Only load the main graphics on the flocking experience
	$: shouldLoadGraphics = currentPath === '/experience/flocking';

	onMount(async () => {
		if (!navigator.gpu) {
			alert("WebGPU is not supported in your browser. Please try a browser that supports WebGPU.");
			return;
		}
		
		// // Only load graphics component when needed
		// if (shouldLoadGraphics) {
		// 	const module = await import('$lib/graphics/main.svelte');
		// 	Geometry = module.default;
		// }

		handleScreen();
		window.addEventListener('resize', () => handleScreen());

		return () => {
			window.removeEventListener('resize', () => handleScreen());
		};
	});
</script>

<svelte:head>
	<title>AUFBAU // WEBGPU</title>
	<meta name="description" content="" />
	<meta name="keywords" content="webgpu developer web developer 3d developer webgpu developer graphics developer website developer" />
	<meta name="author" content="AUFBAU" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />

	<!-- <link
		rel="preload"
		href="/fonts/NB-Architekt-Pro-Light.woff"
		as="font"
		type="font/woff"
		crossorigin="anonymous"
	/> -->

	<!-- <link
		rel="preload"
		href="/fonts/NB-Architekt-Pro-Bold.woff"
		as="font"
		type="font/woff"
		crossorigin="anonymous"
	/> -->
</svelte:head>

<div class="app">
	<main>
		<slot />
	</main>
	
	{#if shouldLoadGraphics}
		<svelte:component this={Geometry} />
	{/if}
	
	<!-- Memory stats display -->
	{#if showMemoryStats && browser}
		<MemoryStats />
	{/if}
</div>

<style>
	.app {
		width: 100%;
		height: 100%;
		position: relative;
	}
</style>
