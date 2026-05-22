<script lang="ts">
	import { api } from '$lib/api';

	type Workout = {
		start_iso: string;
		activity_type: string;
		duration_minutes: number;
		distance_km: number | null;
		energy_kcal: number | null;
		source: string;
	};

	// Apple activity type -> backend activity
	const ACTIVITY_MAP: Record<string, string> = {
		HKWorkoutActivityTypeRunning: 'run',
		HKWorkoutActivityTypeCycling: 'cycling',
		HKWorkoutActivityTypeMixedCardio: 'other',
		HKWorkoutActivityTypeHighIntensityIntervalTraining: 'other',
		HKWorkoutActivityTypeHiking: 'hike',
		HKWorkoutActivityTypeOther: 'other',
		HKWorkoutActivityTypeTraditionalStrengthTraining: 'lift_full',
		HKWorkoutActivityTypeWalking: 'other',
		HKWorkoutActivityTypeSocialDance: 'other'
	};
	const MAX_DURATION = 480;

	let fileName = $state('');
	let workouts = $state<Workout[]>([]);
	let breakdown = $state<Record<string, number>>({});
	let parseErr = $state('');
	let importing = $state(false);
	let progress = $state(0);
	let done = $state(0);
	let skipped = $state(0);
	let failed = $state(0);
	let finished = $state(false);

	function mapActivity(t: string): string {
		return ACTIVITY_MAP[t] ?? 'other';
	}

	function estimateIntensity(kcal: number | null, dur: number): string {
		if (!kcal || !dur || dur <= 0) return 'moderate';
		const rate = kcal / dur;
		if (rate < 7) return 'easy';
		if (rate < 11) return 'moderate';
		if (rate < 15) return 'threshold';
		return 'hard';
	}

	async function onFile(e: Event) {
		parseErr = '';
		finished = false;
		workouts = [];
		breakdown = {};
		const input = e.target as HTMLInputElement;
		const f = input.files?.[0];
		if (!f) return;
		fileName = f.name;
		try {
			const text = await f.text();
			const data = JSON.parse(text);
			const raw: Workout[] = data.workouts ?? [];
			// filter implausible durations
			const valid = raw.filter((w) => w.duration_minutes > 0 && w.duration_minutes <= MAX_DURATION);
			workouts = valid;
			const b: Record<string, number> = {};
			for (const w of valid) {
				const a = mapActivity(w.activity_type);
				b[a] = (b[a] ?? 0) + 1;
			}
			breakdown = b;
		} catch (err) {
			parseErr = 'Could not read this file. Expected the extracted JSON with a "workouts" array. ' + (err as Error).message;
		}
	}

	async function runImport() {
		importing = true;
		finished = false;
		progress = 0;
		done = 0;
		skipped = 0;
		failed = 0;

		// Fetch existing sessions to dedupe by start time
		let existingStarts = new Set<string>();
		try {
			const existing = await api<any[]>('/sessions/manual');
			existingStarts = new Set(
				existing.map((s) => new Date(s.started_at).toISOString().slice(0, 16))
			);
		} catch {
			// if this fails, proceed without dedupe
		}

		for (let i = 0; i < workouts.length; i++) {
			const w = workouts[i];
			progress = Math.round(((i + 1) / workouts.length) * 100);
			const startKey = new Date(w.start_iso).toISOString().slice(0, 16);
			if (existingStarts.has(startKey)) {
				skipped++;
				continue;
			}
			const payload = {
				activity: mapActivity(w.activity_type),
				started_at: w.start_iso,
				duration_minutes: Math.round(w.duration_minutes * 10) / 10,
				intensity: estimateIntensity(w.energy_kcal, w.duration_minutes),
				notes: `Imported (${w.source})`
			};
			try {
				await api('/sessions/manual', { method: 'POST', body: JSON.stringify(payload) });
				done++;
			} catch {
				failed++;
			}
		}
		importing = false;
		finished = true;
	}
</script>

<div class="screen">
	<h1 class="screen-title">Import</h1>
	<p class="screen-sub">Bring in your training history</p>

	<div class="card">
		<div class="card-title">Choose a file</div>
		<p style="color: var(--bone-dim); font-size: 0.85rem; margin-bottom: 14px; line-height: 1.5;">
			Select your extracted workout data (a .json file). Your workouts are added to your training history.
		</p>
		<label
			style="display: block; text-align: center; padding: 14px; border: 1px dashed var(--border); border-radius: 11px; cursor: pointer; color: var(--gold); font-family: var(--mono); font-size: 0.85rem;"
		>
			{fileName || 'Tap to choose .json file'}
			<input type="file" accept="application/json,.json" onchange={onFile} style="display: none;" />
		</label>
		{#if parseErr}
			<p style="color: var(--crimson-soft); font-size: 0.82rem; margin-top: 12px;">{parseErr}</p>
		{/if}
	</div>

	{#if workouts.length > 0 && !finished}
		<div class="card">
			<div class="card-title">Preview &middot; {workouts.length} workouts</div>
			{#each Object.entries(breakdown) as [activity, count]}
				<div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border);">
					<span style="font-size: 0.9rem;">{activity}</span>
					<span class="mono-num" style="color: var(--sage-bright);">{count}</span>
				</div>
			{/each}
			<button onclick={runImport} disabled={importing} style="margin-top: 16px;">
				{importing ? `Importing... ${progress}%` : `Import ${workouts.length} workouts`}
			</button>
			{#if importing}
				<div style="margin-top: 12px; height: 6px; background: var(--surface-2); border-radius: 3px; overflow: hidden;">
					<div style="height: 100%; width: {progress}%; background: linear-gradient(90deg, var(--crimson), var(--gold)); transition: width 0.2s;"></div>
				</div>
			{/if}
		</div>
	{/if}

	{#if finished}
		<div class="card" style="border-color: var(--sage-bright);">
			<div class="card-title" style="color: var(--sage-bright);">Import complete</div>
			<div style="display: flex; justify-content: space-between; text-align: center; margin-top: 8px;">
				<div>
					<div class="stat-num" style="font-size: 1.8rem; color: var(--sage-bright);">{done}</div>
					<div class="mono-num" style="font-size: 0.6rem; color: var(--bone-faint);">ADDED</div>
				</div>
				<div>
					<div class="stat-num" style="font-size: 1.8rem; color: var(--bone-dim);">{skipped}</div>
					<div class="mono-num" style="font-size: 0.6rem; color: var(--bone-faint);">SKIPPED</div>
				</div>
				<div>
					<div class="stat-num" style="font-size: 1.8rem; color: {failed ? 'var(--crimson-soft)' : 'var(--bone-dim)'};">{failed}</div>
					<div class="mono-num" style="font-size: 0.6rem; color: var(--bone-faint);">FAILED</div>
				</div>
			</div>
			<p style="color: var(--bone-dim); font-size: 0.82rem; margin-top: 14px; text-align: center;">
				Skipped workouts were already in your history. Check Trends to see your updated load.
			</p>
		</div>
	{/if}
</div>
