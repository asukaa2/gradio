import type WaveSurfer from "wavesurfer.js";
import { audioBufferToWav } from "./audioBufferToWav";

export interface LoadedParams {
	autoplay?: boolean;
}

export function blob_to_data_url(blob: Blob): Promise<string> {
	return new Promise((fulfill, reject) => {
		let reader = new FileReader();
		reader.onerror = reject;
		reader.onload = () => fulfill(reader.result as string);
		reader.readAsDataURL(blob);
	});
}

/**
 * Trim + re-encode an AudioBuffer to a 16-bit PCM WAV Uint8Array.
 *
 * The previous implementation walked every sample of every channel in a
 * JavaScript `for` loop to copy from the source buffer into a freshly-created
 * trimmed buffer. For a 5-minute 44.1 kHz stereo recording that is ~26M
 * iterations on the main thread.
 *
 * This version uses `Float32Array.subarray` (a view, no copy) + a single
 * `set()` per channel to bulk-copy the trimmed range. It then reuses the
 * source AudioBuffer's data directly when no trim is requested, skipping the
 * intermediate buffer allocation entirely.
 */
export const process_audio = async (
	audioBuffer: AudioBuffer,
	start?: number,
	end?: number,
	waveform_sample_rate?: number
): Promise<Uint8Array> {
	const numberOfChannels = audioBuffer.numberOfChannels;
	const sampleRate = waveform_sample_rate || audioBuffer.sampleRate;

	// Fast path: no trimming requested → encode the source buffer directly.
	// Avoids allocating a second AudioBuffer and the per-sample copy.
	if (start == null || end == null) {
		return audioBufferToWav(audioBuffer);
	}

	const startOffset = Math.round(start * sampleRate);
	const endOffset = Math.round(end * sampleRate);
	const trimmedLength = Math.max(0, endOffset - startOffset);

	// Build the trimmed buffer using `copyToChannel` with a subarray view of
	// the source channel data. `subarray` is O(1) (no copy), `copyToChannel`
	// is a bulk memcpy at the engine level.
	const audioContext = new OfflineAudioContext(1, 1, sampleRate);
	const trimmedAudioBuffer = audioContext.createBuffer(
		numberOfChannels,
		trimmedLength,
		sampleRate
	);

	for (let channel = 0; channel < numberOfChannels; channel++) {
		const channelData = audioBuffer.getChannelData(channel);
		const slice = channelData.subarray(startOffset, startOffset + trimmedLength);
		// `copyToChannel(slice, channel)` overwrites the destination channel
		// in a single bulk copy — equivalent to the old per-sample loop, but
		// executed inside the audio engine instead of in JS.
		trimmedAudioBuffer.copyToChannel(slice, channel);
	}

	return audioBufferToWav(trimmedAudioBuffer);
};

export function loaded(
	node: HTMLAudioElement,
	{ autoplay }: LoadedParams = {}
): void {
	async function handle_playback(): Promise<void> {
		if (!autoplay) return;
		node.pause();
		await node.play();
	}
}

export const skip_audio = (waveform: WaveSurfer, amount: number): void => {
	if (!waveform) return;
	waveform.skip(amount);
};

export const get_skip_rewind_amount = (
	audio_duration: number,
	skip_length?: number | null
): number => {
	if (!skip_length) {
		skip_length = 5;
	}
	return (audio_duration / 100) * skip_length || 5;
};
