import { describe, it, expect } from 'vitest';
import { createInitialCampaign } from './saveState';
import {
  QUESTS,
  checkQuests,
  applyQuestRewards,
  createInitialQuestStates,
  normalizeQuests,
  isQuestVisible,
  getQuestProgress,
} from './quests';

describe('quests', () => {
  it('creates initial quest states for week 1', () => {
    const states = createInitialQuestStates(1);
    expect(states.length).toBeGreaterThan(0);
    expect(states.every((s) => s.status === 'active')).toBe(true);
    expect(states.some((s) => s.id === 'build_school')).toBe(true);
  });

  it('completes build_school when school exists and applies rewards', () => {
    const base = createInitialCampaign({ fresh: true, week: 1, funds: 1000 });
    const withSchool = {
      ...base,
      reputation: 10,
      auxiliaryBuildings: base.auxiliaryBuildings.map((b) =>
        b.id === 'school' ? { ...b, level: 1 } : b
      ),
    };
    const prev = createInitialQuestStates(1);
    const { next, completed, logs } = checkQuests(withSchool, prev);
    expect(completed.some((q) => q.id === 'build_school')).toBe(true);
    expect(next.find((q) => q.id === 'build_school')?.status).toBe('completed');
    expect(logs.join(' ')).toContain('Построить Школу');

    const rewarded = applyQuestRewards(withSchool, completed);
    expect(rewarded.funds).toBe(withSchool.funds + 15000);
    expect(rewarded.reputation).toBe(withSchool.reputation + 5);
  });

  it('respects quest dependencies (hire_teacher hidden until build_school done)', () => {
    createInitialCampaign({ fresh: true, week: 2 });
    const states = createInitialQuestStates(2);
    const hire = QUESTS.find((q) => q.id === 'hire_teacher');
    expect(hire?.dependsOn).toBe('build_school');
    expect(isQuestVisible(hire!, states)).toBe(false);
    const done = states.map((s) => (s.id === 'build_school' ? { ...s, status: 'completed' as const } : s));
    expect(isQuestVisible(hire!, done)).toBe(true);
  });

  it('normalizes invalid quest saves to defaults', () => {
    const normalized = normalizeQuests('garbage', 3);
    expect(Array.isArray(normalized)).toBe(true);
    expect(normalized.length).toBeGreaterThan(0);
  });

  it('checks reputation and funds threshold quests', () => {
    const base = createInitialCampaign({ fresh: true, week: 15, funds: 300000 });
    const state = { ...base, reputation: 120 };
    // Include all quest states so availability gating has entries to evaluate.
    const prev = QUESTS.map((q) => ({ id: q.id, status: 'active' as const }));
    const { completed } = checkQuests(state, prev);
    const ids = completed.map((q) => q.id);
    expect(ids).toContain('reach_reputation_50');
    expect(ids).toContain('reach_reputation_100');
    expect(ids).toContain('reach_funds_100000');
    expect(ids).toContain('reach_funds_250000');
  });

  it('reports quest objective progress for UI', () => {
    const base = createInitialCampaign({ fresh: true, week: 1, funds: 1000 });
    const quest = QUESTS.find((q) => q.id === 'build_school')!;
    const p0 = getQuestProgress(base, quest);
    expect(p0.total).toBeGreaterThan(0);
    expect(p0.done).toBe(0);
    const withSchool = {
      ...base,
      auxiliaryBuildings: base.auxiliaryBuildings.map((b) => (b.id === 'school' ? { ...b, level: 1 } : b)),
    };
    const p1 = getQuestProgress(withSchool, quest);
    expect(p1.done).toBe(p1.total);
  });
});
