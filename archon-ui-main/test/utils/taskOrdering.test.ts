import { describe, it, expect } from 'vitest';
import { calculateTaskOrder, calculateReorderPosition, getDefaultTaskOrder } from '../../src/utils/taskOrdering';
import { Task } from '../../src/types/project';

// Mock task factory
const createMockTask = (id: string, task_order: number): Task => ({
  id,
  title: `Task ${id}`,
  description: '',
  status: 'todo',
  assignee: { name: 'Test User', avatar: '' },
  feature: '',
  featureColor: '#3b82f6',
  task_order,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  project_id: 'test-project'
});

describe('taskOrdering utilities', () => {
  describe('calculateTaskOrder', () => {
    it('should return seed value for first task when no existing tasks', () => {
      const result = calculateTaskOrder({
        position: 'first',
        existingTasks: []
      });
      expect(result).toBe(1024);
    });

    it('should calculate first position correctly', () => {
      const existingTasks = [createMockTask('1', 100), createMockTask('2', 200)];
      const result = calculateTaskOrder({
        position: 'first',
        existingTasks
      });
      expect(result).toBe(50); // 100 / 2
    });

    it('should calculate last position correctly', () => {
      const existingTasks = [createMockTask('1', 100), createMockTask('2', 200)];
      const result = calculateTaskOrder({
        position: 'last',
        existingTasks
      });
      expect(result).toBe(1224); // 200 + 1024
    });

    it('should calculate between position correctly', () => {
      const result = calculateTaskOrder({
        position: 'between',
        existingTasks: [],
        beforeTaskOrder: 100,
        afterTaskOrder: 200
      });
      expect(result).toBe(150); // (100 + 200) / 2
    });
  });

  describe('getDefaultTaskOrder', () => {
    it('should return seed value when no existing tasks', () => {
      const result = getDefaultTaskOrder([]);
      expect(result).toBe(1024);
    });

    it('should return first position when existing tasks present', () => {
      const existingTasks = [createMockTask('1', 100), createMockTask('2', 200)];
      const result = getDefaultTaskOrder(existingTasks);
      expect(result).toBe(50); // 100 / 2
    });
  });

  describe('calculateReorderPosition', () => {
    const statusTasks = [
      createMockTask('1', 100),
      createMockTask('2', 200), 
      createMockTask('3', 300)
    ];

    it('should calculate position for moving to first', () => {
      const result = calculateReorderPosition(statusTasks, 1, 0);
      expect(result).toBeLessThan(statusTasks[0].task_order);
    });

    it('should calculate position for moving to last', () => {
      const result = calculateReorderPosition(statusTasks, 0, 2);
      expect(result).toBeGreaterThan(statusTasks[2].task_order);
    });

    it('should calculate position for moving between items', () => {
      const result = calculateReorderPosition(statusTasks, 0, 1);
      expect(result).toBeGreaterThan(statusTasks[0].task_order);
      expect(result).toBeLessThan(statusTasks[2].task_order);
    });
  });
});