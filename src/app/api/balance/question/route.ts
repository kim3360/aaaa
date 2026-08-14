import { NextResponse } from 'next/server';
import { BALANCE_CATEGORIES } from '@/lib/balance';
import { generateBalanceQuestion } from '@/lib/balance-ai';
import type { BalanceCategoryId } from '@/lib/types';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    category?: string;
    avoid?: unknown;
  };
  const category = BALANCE_CATEGORIES.some((c) => c.id === body.category)
    ? (body.category as BalanceCategoryId)
    : 'all';
  const avoid = Array.isArray(body.avoid) ? body.avoid.map(String).slice(0, 20) : [];
  try {
    const question = await generateBalanceQuestion(category, avoid);
    return NextResponse.json(question);
  } catch (err) {
    const message = err instanceof Error ? err.message : '문제를 만들지 못했습니다';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
