<script lang="ts">
	import { api } from '$lib/api';
	import { onMount } from 'svelte';

	type Status = {
		current_stage: number; stage_label: string; consecutive_good_days: number;
		good_days_required: number; today_prescription: string; injury: string; disclaimer: string;
	};
	type Decision = {
		decision: string; stage_label: string; prescription: string;
		rationale: string; consecutive_good_days: number; disclaimer: string;
	};

	let status = $state<Status | null>(null);
	let decision = $state<Decision | null>(null);
	let hasPlan = $state(false);
	let err = $state('');
	let loading = $state(true);

	let injury = $state('left tibia stress fracture');
	let pain = $state(1);
	let hrv = $state(0.2);
	let sleptWell = $state(true);
	let submitting = $state(false);

	onMount(load);

	async function load() {
		loading = true; err = '';
		try { status = await api('/rtr/status'); hasPlan = true; }
		catch { hasPlan = false; }
		loading = false;
	}

	async function startPlan() {
		err = '';
		try {
			status = await api('/rtr/start', { method: 'POST', body: JSON.stringify({ injury }) });
			hasPlan = true; decision = null;
		} catch (e) { err = (e as Error).message; }
	}

	async function checkIn() {
		submitting = true; err = '';
		try {
			decision = await api('/rtr/check-in', {
				method: 'POST',
				body: JSON.stringify({ pain_score: pain, hrv_z: hrv, slept_well: sleptWell })
			});
			status = await api('/rtr/status');
		} catch (e) { err = (e as Error).message; }
		submitting = false;
	}

	const STAGES = ['Walk only', 'Walk-jog', 'Continuous jog', 'Easy runs', 'Full return'];

	function decisionColor(d: string) {
		if (d === 'advance') return 'var(--sage-bright)';
		if (d === 'regress') return 'var(--crimson-soft)';
		return 'var(--gold)';
	}
</script>

<div class="screen">
	<h1 class="screen-title">Return<br />to run</h1>
	<p class="screen-sub">Pain &amp; HRV gated comeback</p>

	{#if loading}
		<p class="screen-sub">Loading...</p>
	{:else if !hasPlan}
		<div class="card">
			<div class="card-title">Start a plan</div>
			<input bind:value={injury} placeholder="injury" type="text" />
			<button onclick={startPlan}>Begin return-to-run</button>
		</div>
	{:else if status}
		<div class="card">
			<div class="card-title">Current stage</div>
			<div class="stat-num" style="font-size: 1.8rem; color: var(--sage-bright); line-height: 1;">{status.stage_label}</div>
			<div class="mono-num" style="font-size: 0.7rem; color: var(--bone-faint); margin-top: 4px;">STAGE {status.current_stage + 1} OF 5</div>
			<div style="display: flex; gap: 5px; margin: 16px 0;">
				{#each STAGES as _, i}
					<div style="flex: 1; height: 5px; border-radius: 3px; background: {i <= status.current_stage ? 'var(--sage-bright)' : 'var(--surface-2)'}; box-shadow: {i <= status.current_stage ? '0 0 6px var(--sage-bright)' : 'none'};"></div>
				{/each}
			</div>
			<p class="mono-num" style="font-size: 0.72rem; color: var(--bone-dim);">
				{status.consecutive_good_days} / {status.good_days_required} good days to advance
			</p>
		</div>

		<div class="card">
			<div class="card-title">Today's prescription</div>
			<p style="font-size: 0.95rem; line-height: 1.55;">{status.today_prescription}</p>
		</div>

		<div class="card">
			<div class="card-title">Daily check-in</div>
			<label style="font-size: 0.82rem; color: var(--bone-dim); display: block;">Pain <span class="mono-num" style="color: var(--bone); float: right;">{pain}/10</span></label>
			<input type="range" min="0" max="10" step="1" bind:value={pain} style="margin: 8px 0 18px;" />
			<label style="font-size: 0.82rem; color: var(--bone-dim); display: block;">HRV z-score <span class="mono-num" style="color: var(--bone); float: right;">{hrv}</span></label>
			<input type="range" min="-3" max="3" step="0.1" bind:value={hrv} style="margin: 8px 0 18px;" />
			<label style="display: flex; align-items: center; gap: 10px; font-size: 0.88rem; margin-bottom: 18px; color: var(--bone-dim);">
				<input type="checkbox" bind:checked={sleptWell} style="width: auto; margin: 0; accent-color: var(--sage);" /> Slept well
			</label>
			<button onclick={checkIn} disabled={submitting}>{submitting ? 'Submitting...' : 'Submit check-in'}</button>
		</div>

		{#if decision}
			<div class="card" style="border-color: {decisionColor(decision.decision)}; border-width: 1.5px;">
				<div class="card-title" style="color: {decisionColor(decision.decision)};">{decision.decision}</div>
				<p class="stat-num" style="font-size: 1.3rem; margin-bottom: 8px;">{decision.stage_label}</p>
				<p style="color: var(--bone-dim); font-size: 0.85rem; line-height: 1.5;">{decision.rationale}</p>
			</div>
		{/if}

		<p style="color: var(--bone-faint); font-size: 0.68rem; line-height: 1.5; margin-top: 10px;">{status.disclaimer}</p>
	{/if}

	{#if err}<p style="color: var(--crimson-soft); font-size: 0.85rem;">{err}</p>{/if}
</div>
