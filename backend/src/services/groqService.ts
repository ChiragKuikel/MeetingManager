// src/services/groqService.ts
import fs from 'fs';
import { env } from '../config/environment';
import { ActionItem, Speaker } from '../types';

const GROQ_BASE = 'https://api.groq.com/openai/v1';

export interface StructuredSummaryPayload {
    summary_text: string;
    key_points: string[];
    action_items: ActionItem[];
    speakers: Speaker[];
}

function requireGroqKey(): string {
    const key = env.GROQ_API_KEY?.trim();
    if (!key) {
        throw new Error('GROQ_API_KEY is not set. Add it to your .env for transcription and summarization.');
    }
    return key;
}

async function groqResponseErrorMessage(res: Response): Promise<string> {
    let body: string;
    try {
        body = await res.text();
    } catch {
        body = '';
    }
    try {
        const j = JSON.parse(body) as { error?: { message?: string } };
        if (j.error?.message) return j.error.message;
    } catch {
        /* use raw */
    }
    return body.slice(0, 500) || res.statusText;
}

export class GroqService {
    public async transcribeAudioFile(audioPath: string): Promise<string> {
        const apiKey = requireGroqKey();
        const buffer = await fs.promises.readFile(audioPath);
        const form = new FormData();
        form.append('model', env.GROQ_TRANSCRIBE_MODEL);
        form.append('file', new Blob([buffer], { type: 'audio/wav' }), 'audio.wav');

        const res = await fetch(`${GROQ_BASE}/audio/transcriptions`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`
            },
            body: form
        });

        if (!res.ok) {
            throw new Error(`Groq transcription failed: ${await groqResponseErrorMessage(res)}`);
        }

        const data = (await res.json()) as { text?: string };
        const text = data.text?.trim();
        if (!text) {
            throw new Error('Groq transcription returned empty text');
        }
        return text;
    }

    public async summarizeTranscriptToStructured(transcript: string): Promise<StructuredSummaryPayload> {
        const apiKey = requireGroqKey();

        const systemPrompt = `You are a meeting notes assistant. Given a transcript, produce a single JSON object with these exact keys:
- "summary_text": string, 2-4 sentences overview
- "key_points": array of short strings (bullet-level facts)
- "action_items": array of objects with keys task (string), assignee (string, use "Unassigned" if unknown), due (string, ISO date YYYY-MM-DD or "TBD"), priority (one of "high","medium","low")
- "speakers": array of objects with keys name (string), speaking_time (string, approximate like "5:00" or "Unknown"), word_count (number estimate from transcript share), role (optional string)

Do not include markdown fences or commentary. No speaker diarization is provided; infer speakers only when the transcript clearly attributes speech, otherwise use one entry like {"name":"Speaker 1","speaking_time":"Unknown","word_count":0} or split roughly by paragraph if multiple voices are obvious.`;

        const userContent =
            transcript.length > 120_000
                ? `${transcript.slice(0, 120_000)}\n\n[Transcript truncated for length.]`
                : transcript;

        const res = await fetch(`${GROQ_BASE}/chat/completions`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: env.GROQ_CHAT_MODEL,
                temperature: 0.2,
                max_tokens: 4096,
                response_format: { type: 'json_object' },
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userContent }
                ]
            })
        });

        if (!res.ok) {
            throw new Error(`Groq summarization failed: ${await groqResponseErrorMessage(res)}`);
        }

        const data = (await res.json()) as {
            choices?: { message?: { content?: string } }[];
        };
        const raw = data.choices?.[0]?.message?.content?.trim();
        if (!raw) {
            throw new Error('Groq summarization returned empty content');
        }

        return this.normalizeStructuredPayload(raw, transcript);
    }

    private normalizeStructuredPayload(rawJson: string, transcript: string): StructuredSummaryPayload {
        const parsed = this.parseJsonLenient(rawJson);
        const summary_text =
            typeof parsed.summary_text === 'string' && parsed.summary_text.trim()
                ? parsed.summary_text.trim()
                : transcript.split(/\n\n|\. /)[0]?.slice(0, 500) || 'Summary unavailable.';

        const key_points = Array.isArray(parsed.key_points)
            ? parsed.key_points.filter((x: unknown) => typeof x === 'string' && x.trim()).map((s: string) => s.trim())
            : [];

        const action_items = this.normalizeActionItems(parsed.action_items);
        const speakers = this.normalizeSpeakers(parsed.speakers);

        return {
            summary_text,
            key_points: key_points.length ? key_points : ['See transcript for details.'],
            action_items,
            speakers
        };
    }

    private parseJsonLenient(raw: string): Record<string, unknown> {
        let s = raw.trim();
        const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(s);
        if (fence) s = fence[1].trim();

        try {
            return JSON.parse(s) as Record<string, unknown>;
        } catch {
            const start = s.indexOf('{');
            const end = s.lastIndexOf('}');
            if (start >= 0 && end > start) {
                return JSON.parse(s.slice(start, end + 1)) as Record<string, unknown>;
            }
            throw new Error('Model returned invalid JSON');
        }
    }

    private normalizeActionItems(value: unknown): ActionItem[] {
        if (!Array.isArray(value)) return [];
        const priorities: ActionItem['priority'][] = ['high', 'medium', 'low'];
        return value
            .map((item): ActionItem | null => {
                if (!item || typeof item !== 'object') return null;
                const o = item as Record<string, unknown>;
                const task = typeof o.task === 'string' ? o.task.trim() : '';
                if (!task) return null;
                let assignee = typeof o.assignee === 'string' ? o.assignee.trim() : 'Unassigned';
                if (!assignee) assignee = 'Unassigned';
                let due = typeof o.due === 'string' ? o.due.trim() : 'TBD';
                if (!due) due = 'TBD';
                let priority: ActionItem['priority'] = 'medium';
                if (typeof o.priority === 'string') {
                    const p = o.priority.toLowerCase() as ActionItem['priority'];
                    if (priorities.includes(p)) priority = p;
                }
                return { task, assignee, due, priority };
            })
            .filter((x): x is ActionItem => x !== null);
    }

    private normalizeSpeakers(value: unknown): Speaker[] {
        if (!Array.isArray(value)) {
            return [
                {
                    name: 'Speakers',
                    speaking_time: 'Unknown',
                    word_count: 0,
                    role: 'Not diarized'
                }
            ];
        }
        const out: Speaker[] = [];
        for (const item of value) {
            if (!item || typeof item !== 'object') continue;
            const o = item as Record<string, unknown>;
            const name = typeof o.name === 'string' && o.name.trim() ? o.name.trim() : 'Speaker';
            const speaking_time =
                typeof o.speaking_time === 'string' && o.speaking_time.trim()
                    ? o.speaking_time.trim()
                    : 'Unknown';
            let word_count = 0;
            if (typeof o.word_count === 'number' && Number.isFinite(o.word_count)) {
                word_count = Math.max(0, Math.round(o.word_count));
            }
            const role = typeof o.role === 'string' && o.role.trim() ? o.role.trim() : undefined;
            out.push({ name, speaking_time, word_count, role });
        }
        return out.length
            ? out
            : [{ name: 'Speakers', speaking_time: 'Unknown', word_count: 0, role: 'Not diarized' }];
    }
}

export default new GroqService();
