import { ReactHooksComparator } from '../../../src/react/hooks/hooksComparator.js';

describe('ReactHooksComparator', () => {
  let comparator;

  beforeEach(() => {
    comparator = new ReactHooksComparator();
  });

  describe('State Hooks Comparison', () => {
    test('should detect identical state hooks', () => {
      const hooks1 = {
        stateHooks: [{
          type: 'useState',
          initialValue: 0,
          setter: 'setCount'
        }],
        effectHooks: [],
        customHooks: []
      };
      const hooks2 = { ...hooks1 };

      const similarity = comparator.compareHooks(hooks1, hooks2);
      expect(similarity).toBe(1);
    });

    test('should detect similar state hooks', () => {
      const hooks1 = {
        stateHooks: [{
          type: 'useState',
          initialValue: 0,
          setter: 'setCount'
        }],
        effectHooks: [],
        customHooks: []
      };
      const hooks2 = {
        stateHooks: [{
          type: 'useState',
          initialValue: 1,
          setter: 'setCounter'
        }],
        effectHooks: [],
        customHooks: []
      };

      const similarity = comparator.compareHooks(hooks1, hooks2);
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThan(1);
    });
  });

  describe('Effect Hooks Comparison', () => {
    test('should detect identical effect hooks', () => {
      const hooks1 = {
        stateHooks: [],
        effectHooks: [{
          type: 'useEffect',
          dependencies: ['count'],
          effect: {
            hasCleanup: true,
            dependencies: ['count']
          }
        }],
        customHooks: []
      };
      const hooks2 = { ...hooks1 };

      const similarity = comparator.compareHooks(hooks1, hooks2);
      expect(similarity).toBe(1);
    });

    test('should detect similar effect hooks', () => {
      const hooks1 = {
        stateHooks: [],
        effectHooks: [{
          type: 'useEffect',
          dependencies: ['count'],
          effect: {
            hasCleanup: true,
            dependencies: ['count']
          }
        }],
        customHooks: []
      };
      const hooks2 = {
        stateHooks: [],
        effectHooks: [{
          type: 'useEffect',
          dependencies: ['count', 'name'],
          effect: {
            hasCleanup: true,
            dependencies: ['count', 'name']
          }
        }],
        customHooks: []
      };

      const similarity = comparator.compareHooks(hooks1, hooks2);
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThan(1);
    });
  });

  describe('Custom Hooks Comparison', () => {
    test('should detect identical custom hooks', () => {
      const hooks1 = {
        stateHooks: [],
        effectHooks: [],
        customHooks: [{
          type: 'useCustomHook',
          arguments: ['param1', 42]
        }]
      };
      const hooks2 = { ...hooks1 };

      const similarity = comparator.compareHooks(hooks1, hooks2);
      expect(similarity).toBe(1);
    });

    test('should detect similar custom hooks', () => {
      const hooks1 = {
        stateHooks: [],
        effectHooks: [],
        customHooks: [{
          type: 'useCustomHook',
          arguments: ['param1', 42]
        }]
      };
      const hooks2 = {
        stateHooks: [],
        effectHooks: [],
        customHooks: [{
          type: 'useCustomHook',
          arguments: ['param1', 24]
        }]
      };

      const similarity = comparator.compareHooks(hooks1, hooks2);
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThan(1);
    });
  });
});
