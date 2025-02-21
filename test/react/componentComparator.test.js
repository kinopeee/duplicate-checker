import { ReactComponentComparator } from '../../src/react/componentComparator.js';

describe('ReactComponentComparator', () => {
  let comparator;

  beforeEach(() => {
    comparator = new ReactComponentComparator();
  });

  describe('Component Comparison', () => {
    test('should detect identical components', () => {
      const comp1 = {
        props: [{ name: 'label', required: true }],
        jsx: {
          type: 'button',
          props: [{ name: 'className', value: 'btn' }],
          children: []
        }
      };
      const comp2 = { ...comp1 };

      const similarity = comparator.compareComponents(comp1, comp2);
      expect(similarity).toBe(1.0);
    });

    test('should detect similar components', () => {
      const comp1 = {
        props: [{ name: 'label', required: true }],
        jsx: {
          type: 'button',
          props: [{ name: 'className', value: 'btn-primary' }],
          children: []
        }
      };
      const comp2 = {
        props: [{ name: 'label', required: true }],
        jsx: {
          type: 'button',
          props: [{ name: 'className', value: 'btn-secondary' }],
          children: []
        }
      };

      const similarity = comparator.compareComponents(comp1, comp2);
      expect(similarity).toBeGreaterThan(0.7);
      expect(similarity).toBeLessThan(1.0);
    });

    test('should handle different component structures', () => {
      const comp1 = {
        props: [{ name: 'label', required: true }],
        jsx: {
          type: 'button',
          props: [{ name: 'className', value: 'btn' }],
          children: []
        }
      };
      const comp2 = {
        props: [{ name: 'title', required: true }],
        jsx: {
          type: 'div',
          props: [{ name: 'className', value: 'btn' }],
          children: []
        }
      };

      const similarity = comparator.compareComponents(comp1, comp2);
      expect(similarity).toBeLessThan(0.5);
    });
  });
});
