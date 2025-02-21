import { ReactStyleComparator } from '../../../src/react/styles/styleComparator.js';

describe('ReactStyleComparator', () => {
  let comparator;

  beforeEach(() => {
    comparator = new ReactStyleComparator();
  });

  describe('Inline Styles Comparison', () => {
    test('should detect identical inline styles', () => {
      const styles1 = {
        inlineStyles: [{
          color: 'red',
          fontSize: 14
        }],
        classNames: [],
        styledComponents: []
      };
      const styles2 = { ...styles1 };

      const similarity = comparator.compareStyles(styles1, styles2);
      expect(similarity).toBe(1);
    });

    test('should detect similar inline styles', () => {
      const styles1 = {
        inlineStyles: [{
          color: 'red',
          fontSize: 14
        }],
        classNames: [],
        styledComponents: []
      };
      const styles2 = {
        inlineStyles: [{
          color: 'red',
          fontSize: 16
        }],
        classNames: [],
        styledComponents: []
      };

      const similarity = comparator.compareStyles(styles1, styles2);
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThan(1);
    });
  });

  describe('Class Names Comparison', () => {
    test('should detect identical class names', () => {
      const styles1 = {
        inlineStyles: [],
        classNames: ['btn', 'btn-primary'],
        styledComponents: []
      };
      const styles2 = { ...styles1 };

      const similarity = comparator.compareStyles(styles1, styles2);
      expect(similarity).toBe(1);
    });

    test('should detect similar class names', () => {
      const styles1 = {
        inlineStyles: [],
        classNames: ['btn', 'btn-primary'],
        styledComponents: []
      };
      const styles2 = {
        inlineStyles: [],
        classNames: ['btn', 'btn-secondary'],
        styledComponents: []
      };

      const similarity = comparator.compareStyles(styles1, styles2);
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThan(1);
    });
  });

  describe('Styled Components Comparison', () => {
    test('should detect identical styled components', () => {
      const styles1 = {
        inlineStyles: [],
        classNames: [],
        styledComponents: [{
          name: 'StyledButton',
          baseComponent: 'button',
          styles: ['color: red; font-size: 14px;']
        }]
      };
      const styles2 = { ...styles1 };

      const similarity = comparator.compareStyles(styles1, styles2);
      expect(similarity).toBe(1);
    });

    test('should detect similar styled components', () => {
      const styles1 = {
        inlineStyles: [],
        classNames: [],
        styledComponents: [{
          name: 'StyledButton',
          baseComponent: 'button',
          styles: ['color: red; font-size: 14px;']
        }]
      };
      const styles2 = {
        inlineStyles: [],
        classNames: [],
        styledComponents: [{
          name: 'CustomButton',
          baseComponent: 'button',
          styles: ['color: blue; font-size: 14px;']
        }]
      };

      const similarity = comparator.compareStyles(styles1, styles2);
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThan(1);
    });
  });
});
