<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { api } from '$lib/api';
	import { onMount } from 'svelte';

	type CheckIn = { readiness_score: number; band: string; advice: string };
	type Prediction = {
		completion_probability: number;
		interval_low: number;
		interval_high: number;
		plain_english: string;
		readiness_source: string;
	};

	let booting = $state(true);
	let loggedIn = $state(false);
	let email = $state('');
	let password = $state('');
	let loginErr = $state('');

	let checkin = $state<CheckIn | null>(null);
	let prediction = $state<Prediction | null>(null);
	let loadErr = $state('');

	let sleep = $state(7.5);
	let soreness = $state(2);
	let hrv = $state(0);
	let submitting = $state(false);

	let ringFill = $state(0); // animated 0..1

	onMount(async () => {
		const { data } = await supabase.auth.getSession();
		loggedIn = !!data.session;
		if (loggedIn) await loadToday();
		booting = false;
	});

	async function login() {
		loginErr = '';
		const { error } = await supabase.auth.signInWithPassword({ email, password });
		if (error) { loginErr = error.message; return; }
		loggedIn = true;
		await loadToday();
	}

	async function logout() {
		await supabase.auth.signOut();
		loggedIn = false;
		checkin = null;
		prediction = null;
	}

	async function loadToday() {
		loadErr = '';
		try {
			checkin = await api('/check-in/today');
			animateRing(checkin.readiness_score);
			await loadPrediction();
		} catch {
			checkin = null;
		}
	}

	async function loadPrediction() {
		try { prediction = await api('/predictions/session'); }
		catch (e) { loadErr = (e as Error).message; }
	}

	async function submitCheckin() {
		submitting = true;
		loadErr = '';
		try {
			checkin = await api('/check-in', {
				method: 'POST',
				body: JSON.stringify({ sleep_hours: sleep, soreness, hrv_z: hrv })
			});
			animateRing(checkin.readiness_score);
			await loadPrediction();
		} catch (e) { loadErr = (e as Error).message; }
		submitting = false;
	}

	function animateRing(score: number) {
		ringFill = 0;
		const target = score / 100;
		const start = performance.now();
		const dur = 900;
		function step(t: number) {
			const p = Math.min(1, (t - start) / dur);
			const eased = 1 - Math.pow(1 - p, 3);
			ringFill = target * eased;
			if (p < 1) requestAnimationFrame(step);
		}
		requestAnimationFrame(step);
	}

	function bandColor(score: number) {
		if (score >= 80) return 'var(--sage-bright)';
		if (score >= 65) return 'var(--sage)';
		if (score >= 50) return 'var(--gold)';
		return 'var(--crimson-soft)';
	}

	const R = 52;
	const C = 2 * Math.PI * R;
	let dash = $derived(`${ringFill * C} ${C}`);
</script>

<div class="screen">
	{#if booting}
		<p class="screen-sub">Loading...</p>
	{:else if !loggedIn}
		<h1 class="screen-title">Concurrency<br />Coach</h1>
		<p class="screen-sub">One plan for running and lifting.</p>
		<div class="card">
			<div class="card-title">Sign in</div>
			<input bind:value={email} placeholder="email" type="email" />
			<input bind:value={password} placeholder="password" type="password" />
			<button onclick={login}>Log in</button>
			{#if loginErr}<p style="color: var(--crimson-soft); margin-top: 10px; font-size: 0.85rem;">{loginErr}</p>{/if}
		</div>
	{:else}
		<h1 class="screen-title">Today</h1>
		<p class="screen-sub">Readiness &amp; session confidence</p>

		{#if checkin}
			<div class="card" style="text-align: center;">
				<div class="card-title">Readiness</div>
				<svg viewBox="0 0 130 130" style="width: 170px; height: 170px; margin: 4px auto 2px; display: block;">
					<circle cx="65" cy="65" r={R} fill="none" stroke="var(--surface-2)" stroke-width="9" />
					<circle cx="65" cy="65" r={R} fill="none"
						stroke={bandColor(checkin.readiness_score)} stroke-width="9" stroke-linecap="round"
						stroke-dasharray={dash} transform="rotate(-90 65 65)"
						style="filter: drop-shadow(0 0 6px {bandColor(checkin.readiness_score)});" />
					<text x="65" y="60" text-anchor="middle" class="stat-num"
						fill="var(--bone)" style="font-size: 30px;">{checkin.readiness_score}</text>
					<text x="65" y="80" text-anchor="middle"
						fill="var(--bone-faint)" style="font-size: 8px; letter-spacing: 2px; text-transform: uppercase; font-family: var(--mono);">{checkin.band}</text>
				</svg>
				<p style="color: var(--bone-dim); font-size: 0.88rem; margin-top: 8px;">{checkin.advice}</p>
			</div>
		{:else}
			<div class="card">
				<div class="card-title">Morning check-in</div>
				<label style="font-size: 0.82rem; color: var(--bone-dim); display: block;">Sleep <span class="mono-num" style="color: var(--bone); float: right;">{sleep}h</span></label>
				<input type="range" min="0" max="12" step="0.5" bind:value={sleep} style="margin: 8px 0 18px;" />
				<label style="font-size: 0.82rem; color: var(--bone-dim); display: block;">Soreness <span class="mono-num" style="color: var(--bone); float: right;">{soreness}/10</span></label>
				<input type="range" min="0" max="10" step="1" bind:value={soreness} style="margin: 8px 0 18px;" />
				<label style="font-size: 0.82rem; color: var(--bone-dim); display: block;">HRV z-score <span class="mono-num" style="color: var(--bone); float: right;">{hrv}</span></label>
				<input type="range" min="-3" max="3" step="0.1" bind:value={hrv} style="margin: 8px 0 18px;" />
				<button onclick={submitCheckin} disabled={submitting}>{submitting ? 'Saving...' : 'Submit check-in'}</button>
			</div>
		{/if}

		{#if prediction}
			<div class="card">
				<div class="card-title">Session confidence</div>
				<div style="display: flex; align-items: baseline; gap: 10px;">
					<span class="stat-num" style="font-size: 3rem; color: var(--sage-bright); line-height: 1;">
						{Math.round(prediction.completion_probability * 100)}<span style="font-size: 1.4rem;">%</span>
					</span>
				</div>
				<div style="margin: 14px 0 6px; height: 6px; background: var(--surface-2); border-radius: 3px; position: relative;">
					<div style="position: absolute; left: {prediction.interval_low * 100}%; width: {(prediction.interval_high - prediction.interval_low) * 100}%; top: 0; bottom: 0; background: linear-gradient(90deg, var(--sage), var(--sage-bright)); border-radius: 3px;"></div>
				</div>
				<p class="mono-num" style="font-size: 0.72rem; color: var(--bone-faint); letter-spacing: 0.05em;">
					90% RANGE {Math.round(prediction.interval_low * 100)}–{Math.round(prediction.interval_high * 100)}%
				</p>
				<p style="color: var(--bone-dim); font-size: 0.85rem; margin-top: 12px;">{prediction.plain_english}</p>
			</div>
		{/if}

		{#if loadErr}<p style="color: var(--crimson-soft); font-size: 0.85rem;">{loadErr}</p>{/if}

		<button class="secondary" onclick={logout} style="margin-top: 8px;">Log out</button>
	{/if}
</div>
