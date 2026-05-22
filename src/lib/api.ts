import { supabase } from './supabase';
import { env } from '$env/dynamic/public';

const API_BASE = env.PUBLIC_API_BASE || 'http://localhost:8000';

export async function api<T = unknown>(
	path: string,
	options: RequestInit = {}
): Promise<T> {
	const {
		data: { session }
	} = await supabase.auth.getSession();

	if (!session) {
		throw new Error('Not logged in');
	}

	const headers = new Headers(options.headers);
	headers.set('Authorization', `Bearer ${session.access_token}`);
	if (!(options.body instanceof FormData)) {
		headers.set('Content-Type', 'application/json');
	}

	const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

	if (!res.ok) {
		const detail = await res.text();
		throw new Error(`API ${res.status}: ${detail}`);
	}

	return res.json() as Promise<T>;
}