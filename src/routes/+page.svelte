<script>
	import { onMount, onDestroy } from 'svelte';
	import { FlockingEngine } from '$lib/graphics/FlockingEngine.js';

	let canvas;
	let engine;
	let error = null;

	onMount(async () => {
		if (!navigator.gpu) {
			error = 'WebGPU is not supported in this browser';
			return;
		}

		try {
			engine = new FlockingEngine(canvas);
			await engine.init();
		} catch (e) {
			error = e.message;
			console.error(e);
		}
	});

	onDestroy(() => {
		engine?.destroy();
	});
</script>

<svelte:head>
	<title>FLOCKING</title>
</svelte:head>

<div class="container">
	<canvas bind:this={canvas}></canvas>
	
	{#if error}
		<div class="error">
			<p>{error}</p>
		</div>
	{/if}
	
	<div class="music">
		<iframe 
			title="music" 
			src="https://bandcamp.com/EmbeddedPlayer/album=1967289637/size=small/bgcol=333333/linkcol=ffffff/track=2440001588/transparent=true/" 
			seamless
		></iframe>
	</div>

	<div class="title">
		<p>FLOCKING /<span class="green">/ PREDATOR POV</span></p>
	</div>

</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		background: #000;
		overflow: hidden;
	}

	.container {
		width: 100vw;
		height: 100vh;
		position: relative;
	}

	canvas {
		width: 100%;
		height: 100%;
		display: block;
	}

	.error {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		background: rgba(0, 0, 0, 0.8);
		color: #ff4444;
		padding: 2rem;
		border-radius: 8px;
		font-family: monospace;
	}

	.green {
		color: #00ff00;
	}

	.music {
		position: absolute;
		top: 0;
		right: 0;
		z-index: 100;
	}

	.music iframe {
		border: 0;
		width: 100%;
		height: 42px;
	}

	.title {
		position: absolute;
		top: 5px;
		left: 5px;
		padding: 10px;
		border-radius: 4px;
		z-index: 100;
		pointer-events: none;
	}

	.title p {
		font-family: monospace;
		font-size: 12px;
		color: #d0d0d0;
		margin: 0;
	}
</style>