<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import WaveSurfer from "wavesurfer.js";
	import type { FileData } from "@gradio/client";
	import { format_time } from "@gradio/utils";

	let {
		value,
		label,
		loop = false
	}: {
		value: FileData;
		label: string;
		loop?: boolean;
	} = $props();

	let container: HTMLDivElement;
	let waveform: WaveSurfer | undefined;
	let playing = $state(false);
	let duration = $state(0);
	let currentTime = $state(0);
	let waveform_ready = $state(false);

	// Hidden native audio element. Preloads the file in parallel with the
	// WaveSurfer.decodeAudioData call so users can play immediately on click
	// — even before the waveform has been rendered.
	let audio_el = $state<HTMLAudioElement | undefined>(undefined);

	let resolved_src = $derived(value.url);

	const create_waveform = async (): Promise<void> => {
		if (!container || !resolved_src || waveform_ready) return;

		if (waveform) {
			waveform.destroy();
		}

		const accentColor =
			getComputedStyle(document.documentElement).getPropertyValue(
				"--color-accent"
			) || "#ff7c00";

		waveform = WaveSurfer.create({
			container,
			height: 32,
			waveColor: "rgba(128, 128, 128, 0.5)",
			progressColor: accentColor,
			cursorColor: "transparent",
			barWidth: 2,
			barGap: 2,
			barRadius: 2,
			normalize: true,
			interact: true,
			dragToSeek: true,
			hideScrollbar: true,
			// Let WaveSurfer's fetch reuse the audio element's already-buffered
			// response from the browser HTTP cache instead of re-downloading.
			fetchParams: { cache: "force-cache" }
		});

		waveform.on("play", () => (playing = true));
		waveform.on("pause", () => (playing = false));
		waveform.on("ready", () => {
			duration = waveform?.getDuration() || 0;
			waveform_ready = true;
		});
		waveform.on("audioprocess", () => {
			currentTime = waveform?.getCurrentTime() || 0;
		});
		waveform.on("interaction", () => {
			currentTime = waveform?.getCurrentTime() || 0;
		});
		waveform.on("finish", () => {
			playing = false;
			if (loop) {
				waveform?.play();
			}
		});

		await waveform.load(resolved_src);
	};

	onMount(async () => {
		await create_waveform();
	});

	onDestroy(() => {
		if (waveform) {
			waveform.destroy();
		}
	});

	// Sync state from the native element back into the UI when it's used as
	// a fast-path player before the waveform finishes decoding.
	function handle_native_play(): void {
		if (waveform_ready) return; // WaveSurfer is the source of truth
		playing = true;
	}
	function handle_native_pause(): void {
		if (waveform_ready) return;
		playing = false;
	}
	function handle_native_timeupdate(): void {
		if (waveform_ready || !audio_el) return;
		currentTime = audio_el.currentTime;
	}
	function handle_native_loadedmetadata(): void {
		if (waveform_ready || !audio_el) return;
		duration = audio_el.duration || 0;
	}
	function handle_native_ended(): void {
		if (waveform_ready) return;
		playing = false;
		if (loop && audio_el) {
			audio_el.currentTime = 0;
			void audio_el.play();
		}
	}

	const togglePlay = async (): Promise<void> => {
		// Fast path: if the waveform is ready, use it.
		if (waveform_ready && waveform) {
			waveform.playPause();
			return;
		}
		// Otherwise, fall back to the native element so the user hears
		// audio immediately instead of waiting for `decodeAudioData` to
		// finish drawing the waveform.
		if (!audio_el) return;
		if (audio_el.paused) {
			try {
				await audio_el.play();
			} catch (e) {
				console.error("Audio playback failed:", e);
			}
		} else {
			audio_el.pause();
		}
	};
</script>

<!-- Hidden native audio element. preload="auto" so the browser starts
     buffering the file the moment this element mounts. -->
<audio
	bind:this={audio_el}
	src={resolved_src}
	preload="auto"
	onplay={handle_native_play}
	onpause={handle_native_pause}
	ontimeupdate={handle_native_timeupdate}
	onloadedmetadata={handle_native_loadedmetadata}
	onended={handle_native_ended}
></audio>

<div
	class="minimal-audio-player"
	aria-label={label || "Audio"}
	data-testid={label && typeof label === "string" && label.trim()
		? "waveform-" + label
		: "unlabelled-audio"}
>
	<button
		class="play-btn"
		onclick={togglePlay}
		aria-label={playing ? "Pause" : "Play"}
	>
		{#if playing}
			<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
				<rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
				<rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
			</svg>
		{:else}
			<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
				<path
					d="M8 5.74537C8 5.06444 8.77346 4.64713 9.35139 5.02248L18.0227 10.2771C18.5518 10.6219 18.5518 11.3781 18.0227 11.7229L9.35139 16.9775C8.77346 17.3529 8 16.9356 8 16.2546V5.74537Z"
					fill="currentColor"
				/>
			</svg>
		{/if}
	</button>

	<div class="waveform-wrapper" bind:this={container}></div>

	<div class="timestamp">{format_time(playing ? currentTime : duration)}</div>
</div>

<style>
	.minimal-audio-player {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		border-radius: var(--radius-sm);
		width: var(--size-52);
		padding: var(--spacing-sm);
	}

	.play-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		border: none;
		background: none;
		color: var(--body-text-color);
		opacity: 0.7;
		cursor: pointer;
		border-radius: 50%;
		transition: all 0.2s ease;
		flex-shrink: 0;
	}

	.play-btn:hover {
		color: var(--color-accent);
		opacity: 1;
	}

	.play-btn:active {
		transform: scale(0.95);
	}

	.play-btn svg {
		width: var(--size-5);
		height: var(--size-5);
		display: block;
	}

	.waveform-wrapper {
		flex: 1 1 auto;
		cursor: pointer;
		width: auto;
	}

	.waveform-wrapper :global(::part(wrapper)) {
		margin-bottom: 0;
	}

	.timestamp {
		font-size: 13px;
		font-weight: 500;
		color: var(--body-text-color);
		opacity: 0.7;
		font-variant-numeric: tabular-nums;
		flex-shrink: 0;
		min-width: 40px;
		text-align: center;
	}

	@media (prefers-reduced-motion: reduce) {
		.play-btn {
			transition: none;
		}
	}
</style>
