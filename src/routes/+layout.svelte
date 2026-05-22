<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';

	let { children } = $props();
	let loggedIn = $state(false);

	onMount(() => {
		supabase.auth.getSession().then(({ data }) => {
			loggedIn = !!data.session;
		});
		const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
			loggedIn = !!session;
		});
		return () => sub.subscription.unsubscribe();
	});

	const tabs = [
		{ href: '/', icon: '\u25C9', label: 'Today' },
		{ href: '/plan', icon: '\u25A4', label: 'Plan' },
		{ href: '/trends', icon: '\u2197', label: 'Trends' },
		{ href: '/rtr', icon: '\u271A', label: 'Return' },
		{ href: '/import', icon: '\u2913', label: 'Import' }
	];
</script>

<div class="app-shell">
	{@render children()}

	{#if loggedIn}
		<nav class="bottom-nav">
			{#each tabs as tab}
				<a href={tab.href} class:active={page.url.pathname === tab.href}>
					<span class="icon">{tab.icon}</span>
					<span>{tab.label}</span>
				</a>
			{/each}
		</nav>
	{/if}
</div>
