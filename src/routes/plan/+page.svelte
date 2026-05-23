<script lang="ts">
	import { api } from '$lib/api';
	import { onMount } from 'svelte';

	type Day = { day_index: number; day_name: string; session: string; tss: number };
	type SmartPlan = {
		feasible: boolean;
		mode: string;
		tier: string;
		tier_summary: string;
		phase: string;
		weeks_to_goal: number | null;
		target_tss: number;
		total_tss: number;
		days: Day[];
		analysis: string[];
		classification_notes: string[];
		prescription_notes: string[];
		timeline: string[];
	};

	let plan = $state<SmartPlan | null>(null);
	let err = $state('');
	let loading = $state(false);

	// User constraints
	let mode = $state('hybrid');
	let goalDistance = $state('5k');
	let goalTime = $state('23:00');
	let daysPerWeek = $state(5);

	const MODES = [
		{ id: 'run_only', label: 'Run only' },
		{ id: 'hybrid', label: 'Hybrid' },
		{ id: 'strength_only', label: 'Strength' }
	];
	const DISTANCES = [
		{ id: '5k', label: '5K' },
		{ id: '10k', label: '10K' },
		{ id: 'half', label: 'Half' },
		{ id: 'marathon', label: 'Marathon' }
	];

	const LABELS: Record<string, string> = {
		rest: 'Rest', easy_run: 'Easy run', quality_run: 'Quality run', long_run: 'Long run',
		lift_lower: 'Lower lift', lift_upper: 'Upper lift', cross_train: 'Cross-train'
	};
	const COLORS: Record<string, string> = {
		rest: 'var(--bone-faint)', easy_run: 'var(--sage)', quality_run: 'var(--sage-bright)',
		long_run: 'var(--gold)', lift_lower: 'var(--crimson)', lift_upper: 'var(--crimson-soft)',
		cross_train: '#6b8aa3'
	};
	const PHASE_LABELS: Record<string, string> = {
		base: 'Base building', build: 'Build', peak: 'Peak / sharpen', taper: 'Taper', maintain: 'Maintenance'
	};

	const isRunMode = $derived(mode === 'run_only' || mode === 'hybrid');

	async function generate() {
		loading = true; err = '';
		try {
			const body: Record<string, unknown> = { mode, days_per_week: daysPerWeek };
			if (isRunMode && goalDistance) {
				body.goal_distance = goalDistance;
				if (goalTime.trim()) body.goal_target_time = goalTime.trim();
			}
			plan = await api('/plan/smart', { method: 'POST', body: JSON.stringify(body) });
		} catch (e) {
			err = (e as Error).message;
			plan = null;
		}
		loading = false;
	}

	onMount(generate);
</script>

<div class="screen">
	<h1 class="screen-title">Plan</h1>
	<p class="screen-sub">Goal-aware, science-backed training week</p>

	<!-- Mode selector -->
	<div class="card">
		<div class="card-title">Training focus</div>
		<div style="display: flex; gap: 8px; margin-bottom: 16px;">
			{#each MODES as m}
				<button
					onclick={() => { mode = m.id; }}
					style="flex: 1; padding: 10px 0; font-size: 0.85rem; border-radius: 8px;
						background: {mode === m.id ? 'var(--sage)' : 'transparent'};
						color: {mode === m.id ? 'var(--ink)' : 'var(--bone-dim)'};
						border: 1px solid {mode === m.id ? 'var(--sage)' : 'var(--border)'};"
				>{m.label}</button>
			{/each}
		</div>

		{#if isRunMode}
			<label style="font-size: 0.82rem; color: var(--bone-dim); display: block; margin-bottom: 6px;">Goal distance</label>
			<div style="display: flex; gap: 6px; margin-bottom: 16px;">
				{#each DISTANCES as dist}
					<button
						onclick={() => { goalDistance = dist.id; }}
						style="flex: 1; padding: 8px 0; font-size: 0.8rem; border-radius: 8px;
							background: {goalDistance === dist.id ? 'var(--gold)' : 'transparent'};
							color: {goalDistance === dist.id ? 'var(--ink)' : 'var(--bone-dim)'};
							border: 1px solid {goalDistance === dist.id ? 'var(--gold)' : 'var(--border)'};"
					>{dist.label}</button>
				{/each}
			</div>

			<label style="font-size: 0.82rem; color: var(--bone-dim); display: block; margin-bottom: 6px;">Target time (mm:ss or h:mm:ss)</label>
			<input type="text" bind:value={goalTime} placeholder="23:00"
				style="width: 100%; padding: 10px; background: var(--bg-input, rgba(255,255,255,0.04)); border: 1px solid var(--border); border-radius: 8px; color: var(--bone); font-family: var(--mono, monospace); margin-bottom: 16px;" />
		{:else}
			<p style="color: var(--bone-faint); font-size: 0.78rem; line-height: 1.5; margin-bottom: 16px;">
				Structured lifting schedule (lower/upper split). Note: this schedules sessions but does not yet model progressive-overload strength periodisation.
			</p>
		{/if}

		<label style="font-size: 0.82rem; color: var(--bone-dim); display: block;">Days per week <span class="mono-num" style="color: var(--bone); float: right;">{daysPerWeek}</span></label>
		<input type="range" min="1" max="7" step="1" bind:value={daysPerWeek} style="margin: 10px 0 18px;" />

		<button onclick={generate} disabled={loading}>{loading ? 'Building plan...' : 'Generate plan'}</button>
	</div>

	{#if err}
		<div class="card"><p style="color: var(--crimson-soft); font-size: 0.85rem;">{err}</p></div>
	{:else if plan}
		{#if !plan.feasible}
			<div class="card"><p style="color: var(--crimson-soft); font-size: 0.85rem;">No feasible plan for these constraints. Try more days per week or a different mode.</p></div>
		{:else}
			<!-- Fitness & goal analysis: the honest headline -->
			{#if plan.analysis && plan.analysis.length}
				<div class="card">
					<div class="card-title">Where you are</div>
					{#each plan.analysis as line}
						<p style="color: var(--bone-dim); font-size: 0.84rem; line-height: 1.55; margin-bottom: 8px;">{line}</p>
					{/each}
				</div>
			{/if}

			<!-- Classification + phase -->
			<div class="card">
				<div class="card-title" style="display: flex; justify-content: space-between;">
					<span>Your level</span>
					<span class="mono-num" style="color: var(--sage-bright); text-transform: capitalize;">{plan.tier}</span>
				</div>
				<p style="color: var(--bone-dim); font-size: 0.84rem; line-height: 1.55;">{plan.tier_summary}</p>
				<div style="display: flex; justify-content: space-between; margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--border);">
					<span style="font-size: 0.8rem; color: var(--bone-faint);">Phase</span>
					<span style="font-size: 0.85rem; color: var(--gold);">{PHASE_LABELS[plan.phase] || plan.phase}{plan.weeks_to_goal !== null ? ` · ${plan.weeks_to_goal}wk to goal` : ''}</span>
				</div>
			</div>

			<!-- The week -->
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

			<!-- Why this week -->
			{#if plan.prescription_notes && plan.prescription_notes.length}
				<div class="card">
					<div class="card-title">Why this week</div>
					{#each plan.prescription_notes as note}
						<p style="color: var(--bone-dim); font-size: 0.82rem; line-height: 1.5; margin-bottom: 8px; padding-left: 14px; position: relative;">
							<span style="position: absolute; left: 0; color: var(--gold);">&middot;</span>{note}
						</p>
					{/each}
					{#each plan.classification_notes as note}
						<p style="color: var(--bone-dim); font-size: 0.82rem; line-height: 1.5; margin-bottom: 8px; padding-left: 14px; position: relative;">
							<span style="position: absolute; left: 0; color: var(--gold);">&middot;</span>{note}
						</p>
					{/each}
				</div>
			{/if}

			<!-- Methods cited -->
			{#if plan.timeline && plan.timeline.length}
				<div class="card">
					<div class="card-title">Methods</div>
					{#each plan.timeline as method}
						<p style="color: var(--bone-faint); font-size: 0.76rem; line-height: 1.5; margin-bottom: 6px;">{method}</p>
					{/each}
				</div>
			{/if}

			<!-- Honest disclaimer -->
			<div class="card" style="background: transparent; border: 1px dashed var(--border);">
				<p style="color: var(--bone-faint); font-size: 0.74rem; line-height: 1.5;">
					This is general training guidance, not medical or coaching advice. Estimates use pace data only (no heart rate) and are shown as ranges to reflect real uncertainty. Listen to your body and consult a professional for injury or health concerns.
				</p>
			</div>
		{/if}
	{/if}
</div>
