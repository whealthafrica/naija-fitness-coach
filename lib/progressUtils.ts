export interface WeeklySnapshot {
  week_number: number;
  tasks_assigned: number;
  pathway_type: string;
}

export interface WeeklyCompletion {
  week_number: number;
  completed: number;
}

/**
 * Custom coach-assigned tasks are excluded from Program Progress by design: coach discretion in adding tasks would otherwise create unequal payout paths between patients under different coaches. Custom tasks award CP only.
 * 
 * Computes the blended program progress percentage across all weeks.
 * program_progress = sum(completed) / sum(assigned) * 100
 */
export function computeBlendedProgress(
  snapshots: WeeklySnapshot[],
  completions: WeeklyCompletion[]
): number {
  if (!snapshots || snapshots.length === 0) {
    return 0;
  }

  let totalAssigned = 0;
  let totalCompleted = 0;

  // Build a lookup map of completed tasks per week
  const completionMap = new Map<number, number>();
  completions.forEach(c => {
    completionMap.set(c.week_number, c.completed);
  });

  snapshots.forEach(s => {
    const completedInWeek = completionMap.get(s.week_number) ?? 0;
    // Cap completion at assigned tasks for the week to prevent > 100% per week
    const cappedCompleted = Math.min(s.tasks_assigned, completedInWeek);
    
    totalAssigned += s.tasks_assigned;
    totalCompleted += cappedCompleted;
  });

  if (totalAssigned === 0) return 0;
  
  const percent = (totalCompleted / totalAssigned) * 100;
  return Math.min(100, Math.max(0, parseFloat(percent.toFixed(2))));
}

/**
 * Get user current week number based on enrollment/creation date
 */
export function getUserCurrentWeek(enrollmentDateStr: string | null | undefined): number {
  if (!enrollmentDateStr) return 1;
  const enrollmentDate = new Date(enrollmentDateStr);
  const diffTime = Math.abs(new Date().getTime() - enrollmentDate.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const currWeek = Math.floor(diffDays / 7) + 1;
  return Math.min(12, Math.max(1, currWeek));
}
