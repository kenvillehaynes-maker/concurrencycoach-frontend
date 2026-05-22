<script lang="ts">
	import { api } from '$lib/api';
	import { onMount } from 'svelte';

	type Day = { day_index: number; day_name: string; session: string; tss: number };
	type Plan = { feasible: boolean; total_tss: number; target_tss: number; days: Day[]; notes: string[] };

	let plan = $state<Plan | null>(null);
	let err = $state('');
	let loading = $state(false);
	let target = $state(400);

	const LABELS: Record<string, string> = {
		rest: 'Rest', easy_run: 'Easy run', quality_run: 'Quality run', long_run: 'Long run',
		lift_lower: 'Lower lift', lift_upper: 'Upper lift', cross_train: 'Cross-train'
	};
	const COLORS: Record<string, string> = {
		rest: 'var(--bone-faint)', easy_run: 'var(--sage)', quality_run: 'var(--sage-bright)',
		long_run: 'var(--gold)', lift_lower: 'var(--crimson)', lift_upper: 'var(--crimson-soft)',
		cross_train: '#6b8aa3'
	};

	async function generate() {
		loading = true; err = '';
		try { plan = await api(`/plan/week?target_weekly_tss=${target}`); }
		catch (e) { err = (e as Error).message; }
		loading = false;
	}
	onMount(generate);
</script>

<div class="screen">
	<h1 class="screen-title">Plan</h1>
	<p class="screen-sub">Interference-aware training week</p>

	<div class="card">
		<div class="card-title">Weekly load target</div>
		<label style="font-size: 0.82rem; color: var(--bone-dim); display: block;">Target <span class="mono-num" style="color: var(--bone); float: right;">{target} TSS</span></label>
		<input type="range" min="200" max="700" step="25" bind:value={target} style="margin: 10px 0 18px;" />
		<button onclick={generate} disabled={loading}>{loading ? 'Solving...' : 'Generate week'}</button>
	</div>

	{#if err}
		<div class="card"><p style="color: var(--crimson-soft); font-size: 0.85rem;">{err}</p></div>
	{:else if plan}
		{#if !plan.feasible}
			<div class="card"><p style="color: var(--crimson-soft); font-size: 0.85rem;">No feasible plan. Try a different target.</p></div>
		{:else}
			<div class="card">
				<div class="card-title" style="display: flex; justify-content: space-between;">
					<span>This week</span>
					<span class="mono-num" style="color: var(--sage-bright);">{plan.total_tss} / {plan.target_tss}</span>
				</div>
				{#each plan.days as d}
					<div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--border);">
						<div style="display: flex; align-items: center; gap: 14px;">
							<span class="mono-num" style="width: 34px; color: var(--bone-faint); font-size: 0.75rem;">{d.day_name}</span>
							<span style="width: 9px; height: 9px; border-radius: 50%; background: {COLORS[d.session]}; box-shadow: 0 0 8px {COLORS[d.session]};"></span>
							<span style="font-size: 0.95rem;">{LABELS[d.session] || d.session}</span>
						</div>
						<span class="stat-num" style="color: var(--bone-dim); font-size: 1.1rem;">{d.tss || ''}</span>
					</div>
				{/each}
			</div>

			<div class="card">
				<div class="card-title">Why this week</div>
				{#each plan.notes as note}
					<p style="color: var(--bone-dim); font-size: 0.82rem; line-height: 1.5; margin-bottom: 8px; padding-left: 14px; position: relative;">
						<span style="position: absolute; left: 0; color: var(--gold);">&middot;</span>{note}
					</p>
				{/each}
			</div>
		{/if}
	{/if}
</div>
