<script lang="ts">
	import { api } from '$lib/api';
	import { onMount } from 'svelte';

	type Session = {
		id: number;
		activity: string;
		started_at: string;
		duration_minutes: number;
		intensity: string;
		aerobic_tss: number;
		leg_load_score: number;
	};

	let loading = $state(true);
	let err = $state('');
	let sessions = $state<Session[]>([]);

	// activity grouping: run is its own thing, everything else is cross-training
	const RUN = new Set(['run']);

	onMount(async () => {
		try {
			sessions = await api<Session[]>('/sessions/manual');
		} catch (e) {
			err = (e as Error).message;
		} finally {
			loading = false;
		}
	});

	// ---- derived stats ----
	let totalSessions = $derived(sessions.length);
	let totalHours = $derived(
		Math.round((sessions.reduce((s, w) => s + w.duration_minutes, 0) / 60) * 10) / 10
	);

	// hours by activity
	let byActivity = $derived.by(() => {
		const m: Record<string, { hours: number; count: number }> = {};
		for (const s of sessions) {
			const k = s.activity;
			if (!m[k]) m[k] = { hours: 0, count: 0 };
			m[k].hours += s.duration_minutes / 60;
			m[k].count += 1;
		}
		return Object.entries(m)
			.map(([activity, v]) => ({ activity, hours: Math.round(v.hours * 10) / 10, count: v.count }))
			.sort((a, b) => b.hours - a.hours);
	});

	let maxActivityHours = $derived(Math.max(1, ...byActivity.map((a) => a.hours)));

	// run vs cross-training
	let runHours = $derived(
		Math.round((sessions.filter((s) => RUN.has(s.activity)).reduce((x, s) => x + s.duration_minutes, 0) / 60) * 10) / 10
	);
	let crossHours = $derived(Math.round((totalHours - runHours) * 10) / 10);
	let runPct = $derived(totalHours > 0 ? Math.round((runHours / totalHours) * 100) : 0);

	// weekly buckets (ISO week start, Monday)
	function weekKey(iso: string): string {
		const d = new Date(iso);
		const day = (d.getDay() + 6) % 7; // Mon=0
		d.setDate(d.getDate() - day);
		d.setHours(0, 0, 0, 0);
		return d.toISOString().slice(0, 10);
	}

	let weekly = $derived.by(() => {
		const m: Record<string, { runMin: number; crossMin: number }> = {};
		for (const s of sessions) {
			const k = weekKey(s.started_at);
			if (!m[k]) m[k] = { runMin: 0, crossMin: 0 };
			if (RUN.has(s.activity)) m[k].runMin += s.duration_minutes;
			else m[k].crossMin += s.duration_minutes;
		}
		return Object.entries(m)
			.map(([week, v]) => ({
				week,
				runH: Math.round((v.runMin / 60) * 10) / 10,
				crossH: Math.round((v.crossMin / 60) * 10) / 10,
				totalH: Math.round(((v.runMin + v.crossMin) / 60) * 10) / 10
			}))
			.sort((a, b) => a.week.localeCompare(b.week));
	});

	let maxWeekHours = $derived(Math.max(1, ...weekly.map((w) => w.totalH)));

	// intensity distribution
	let byIntensity = $derived.by(() => {
		const order = ['easy', 'moderate', 'threshold', 'hard', 'very_hard'];
		const m: Record<string, number> = {};
		for (const s of sessions) m[s.intensity] = (m[s.intensity] ?? 0) + 1;
		return order.filter((i) => m[i]).map((i) => ({ intensity: i, count: m[i] }));
	});
	let maxIntensity = $derived(Math.max(1, ...byIntensity.map((i) => i.count)));

	const ACT_COLOR: Record<string, string> = {
		run: 'var(--crimson-soft)',
		cycling: 'var(--gold)',
		other: 'var(--sage)',
		hike: 'var(--sage-bright)'
	};
	function actColor(a: string): string {
		return ACT_COLOR[a] ?? 'var(--bone-dim)';
	}

	function fmtWeek(w: string): string {
		const d = new Date(w);
		return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
	}
</script>

<div class="screen">
	<h1 class="screen-title">Analysis</h1>
	<p class="screen-sub">Your imported training, broken down</p>

	{#if loading}
		<div class="card"><p style="color: var(--bone-dim);">Loading your training data...</p></div>
	{:else if err}
		<div class="card" style="border-color: var(--crimson-soft);">
			<p style="color: var(--crimson-soft);">Could not load: {err}</p>
		</div>
	{:else if sessions.length === 0}
		<div class="card">
			<p style="color: var(--bone-dim);">No sessions yet. Use the Import tab to bring in your training history.</p>
		</div>
	{:else}
		<!-- Headline volume -->
		<div class="card">
			<div class="card-title">Total volume</div>
			<div style="display: flex; justify-content: space-between; text-align: center; margin-top: 6px;">
				<div>
					<div class="stat-num" style="color: var(--bone);">{totalSessions}</div>
					<div class="mono-num" style="font-size: 0.6rem; color: var(--bone-faint);">SESSIONS</div>
				</div>
				<div>
					<div class="stat-num" style="color: var(--gold);">{totalHours}</div>
					<div class="mono-num" style="font-size: 0.6rem; color: var(--bone-faint);">HOURS</div>
				</div>
				<div>
					<div class="stat-num" style="color: var(--crimson-soft);">{runPct}%</div>
					<div class="mono-num" style="font-size: 0.6rem; color: var(--bone-faint);">RUNNING</div>
				</div>
			</div>
		</div>

		<!-- Hours by activity -->
		<div class="card">
			<div class="card-title">Hours by activity</div>
			{#each byActivity as a}
				<div style="margin: 12px 0;">
					<div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 5px;">
						<span>{a.activity} <span style="color: var(--bone-faint);">&middot; {a.count}</span></span>
						<span class="mono-num" style="color: {actColor(a.activity)};">{a.hours}h</span>
					</div>
					<div style="height: 8px; background: var(--surface-2); border-radius: 4px; overflow: hidden;">
						<div style="height: 100%; width: {(a.hours / maxActivityHours) * 100}%; background: {actColor(a.activity)}; border-radius: 4px;"></div>
					</div>
				</div>
			{/each}
		</div>

		<!-- Run vs cross-training -->
		<div class="card">
			<div class="card-title">Run vs cross-training</div>
			<div style="display: flex; height: 28px; border-radius: 7px; overflow: hidden; margin: 10px 0;">
				<div style="width: {runPct}%; background: var(--crimson-soft); min-width: 2px;"></div>
				<div style="width: {100 - runPct}%; background: var(--sage);"></div>
			</div>
			<div style="display: flex; justify-content: space-between; font-size: 0.82rem;">
				<span style="color: var(--crimson-soft);">Run {runHours}h</span>
				<span style="color: var(--sage-bright);">Cross-training {crossHours}h</span>
			</div>
			<p style="color: var(--bone-dim); font-size: 0.8rem; margin-top: 12px; line-height: 1.5;">
				Cross-training carries most of your aerobic load while running volume rebuilds.
			</p>
		</div>

		<!-- Weekly pattern -->
		<div class="card">
			<div class="card-title">Weekly pattern</div>
			<div style="display: flex; align-items: flex-end; gap: 3px; height: 110px; margin: 14px 0 6px;">
				{#each weekly as w}
					<div style="flex: 1; display: flex; flex-direction: column; justify-content: flex-end; height: 100%;" title="{fmtWeek(w.week)}: {w.totalH}h">
						<div style="background: var(--sage); width: 100%; height: {(w.crossH / maxWeekHours) * 100}%;"></div>
						<div style="background: var(--crimson-soft); width: 100%; height: {(w.runH / maxWeekHours) * 100}%;"></div>
					</div>
				{/each}
			</div>
			<div style="display: flex; justify-content: space-between; font-size: 0.65rem; color: var(--bone-faint); font-family: var(--mono);">
				<span>{weekly.length ? fmtWeek(weekly[0].week) : ''}</span>
				<span>{weekly.length ? fmtWeek(weekly[weekly.length - 1].week) : ''}</span>
			</div>
			<div style="display: flex; gap: 16px; margin-top: 10px; font-size: 0.72rem;">
				<span style="color: var(--crimson-soft);">&#9632; Run</span>
				<span style="color: var(--sage-bright);">&#9632; Cross-training</span>
			</div>
		</div>

		<!-- Intensity distribution -->
		<div class="card">
			<div class="card-title">Intensity distribution</div>
			{#each byIntensity as i}
				<div style="margin: 10px 0;">
					<div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 5px;">
						<span>{i.intensity.replace('_', ' ')}</span>
						<span class="mono-num" style="color: var(--gold);">{i.count}</span>
					</div>
					<div style="height: 8px; background: var(--surface-2); border-radius: 4px; overflow: hidden;">
						<div style="height: 100%; width: {(i.count / maxIntensity) * 100}%; background: linear-gradient(90deg, var(--crimson), var(--gold)); border-radius: 4px;"></div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
