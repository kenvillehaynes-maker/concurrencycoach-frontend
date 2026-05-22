<script lang="ts">
	import { api } from '$lib/api';
	import { onMount } from 'svelte';

	type Point = { day: string; daily_tss: number; ctl: number; atl: number; tsb: number };
	type LoadResp = {
		today_ctl: number; today_atl: number; today_tsb: number;
		interpretation: string; series: Point[];
	};

	let data = $state<LoadResp | null>(null);
	let err = $state('');

	onMount(async () => {
		try { data = await api('/training-load?days=42'); }
		catch (e) { err = (e as Error).message; }
	});

	const W = 460, H = 210, PAD = 26;

	function chart(series: Point[]) {
		if (!series.length) return null;
		const maxVal = Math.max(10, ...series.map((p) => Math.max(p.ctl, p.atl)));
		const n = series.length;
		const x = (i: number) => PAD + (i / (n - 1)) * (W - 2 * PAD);
		const y = (v: number) => H - PAD - (v / maxVal) * (H - 2 * PAD);
		const line = (key: 'ctl' | 'atl') =>
			series.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p[key]).toFixed(1)}`).join(' ');
		const area = (key: 'ctl' | 'atl') =>
			`${line(key)} L ${x(n - 1).toFixed(1)} ${H - PAD} L ${x(0).toFixed(1)} ${H - PAD} Z`;
		return { ctlLine: line('ctl'), atlLine: line('atl'), ctlArea: area('ctl'), atlArea: area('atl'), baseY: H - PAD };
	}

	let c = $derived(data ? chart(data.series) : null);
</script>

<div class="screen">
	<h1 class="screen-title">Trends</h1>
	<p class="screen-sub">Fitness, fatigue &amp; form &middot; 6 weeks</p>

	{#if err}
		<div class="card"><p style="color: var(--crimson-soft); font-size: 0.85rem;">{err}</p></div>
	{:else if !data}
		<p class="screen-sub">Loading...</p>
	{:else}
		<div class="card">
			<div class="card-title">Current state</div>
			<div style="display: flex; justify-content: space-between; text-align: center;">
				<div>
					<div class="stat-num" style="font-size: 2rem; color: var(--sage-bright);">{data.today_ctl}</div>
					<div class="mono-num" style="font-size: 0.6rem; color: var(--bone-faint); letter-spacing: 0.12em;">FITNESS</div>
				</div>
				<div>
					<div class="stat-num" style="font-size: 2rem; color: var(--gold);">{data.today_atl}</div>
					<div class="mono-num" style="font-size: 0.6rem; color: var(--bone-faint); letter-spacing: 0.12em;">FATIGUE</div>
				</div>
				<div>
					<div class="stat-num" style="font-size: 2rem; color: {data.today_tsb >= 0 ? 'var(--sage-bright)' : 'var(--crimson-soft)'};">{data.today_tsb}</div>
					<div class="mono-num" style="font-size: 0.6rem; color: var(--bone-faint); letter-spacing: 0.12em;">FORM</div>
				</div>
			</div>
		</div>

		{#if c}
			<div class="card">
				<div class="card-title">42-day load</div>
				<svg viewBox="0 0 {W} {H}" style="width: 100%; height: auto;">
					<defs>
						<linearGradient id="ctlGrad" x1="0" y1="0" x2="0" y2="1">
							<stop offset="0%" stop-color="var(--sage-bright)" stop-opacity="0.35" />
							<stop offset="100%" stop-color="var(--sage-bright)" stop-opacity="0" />
						</linearGradient>
						<linearGradient id="atlGrad" x1="0" y1="0" x2="0" y2="1">
							<stop offset="0%" stop-color="var(--gold)" stop-opacity="0.22" />
							<stop offset="100%" stop-color="var(--gold)" stop-opacity="0" />
						</linearGradient>
					</defs>
					<line x1={PAD} y1={c.baseY} x2={W - PAD} y2={c.baseY} stroke="var(--border)" stroke-width="1" />
					<path d={c.atlArea} fill="url(#atlGrad)" />
					<path d={c.ctlArea} fill="url(#ctlGrad)" />
					<path d={c.atlLine} fill="none" stroke="var(--gold)" stroke-width="2" stroke-linejoin="round" />
					<path d={c.ctlLine} fill="none" stroke="var(--sage-bright)" stroke-width="2.5" stroke-linejoin="round" />
				</svg>
				<div style="display: flex; gap: 18px; margin-top: 10px;">
					<span class="mono-num" style="font-size: 0.68rem; color: var(--sage-bright);">— Fitness</span>
					<span class="mono-num" style="font-size: 0.68rem; color: var(--gold);">— Fatigue</span>
				</div>
			</div>
		{/if}

		<div class="card">
			<div class="card-title">Read</div>
			<p style="color: var(--bone-dim); font-size: 0.88rem; line-height: 1.5;">{data.interpretation}</p>
		</div>
	{/if}
</div>
