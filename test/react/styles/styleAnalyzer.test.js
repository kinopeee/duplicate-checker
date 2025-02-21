import { ReactStyleAnalyzer } from '../../../src/react/styles/styleAnalyzer.js';
import parser from '@babel/parser';

describe('ReactStyleAnalyzer', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new ReactStyleAnalyzer();
  });

  describe('Inline Styles Analysis', () => {
    test('should extract inline styles from JSX', () => {
      const code = `
        const Button = () => (
          <button style={{ color: 'red', fontSize: 14 }}>
            Click me
          </button>
        );
      `;
      const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx']
      });
      const node = ast.program.body[0].declarations[0].init.body;
      const result = analyzer.analyzeStyles(node);

      expect(result.inlineStyles).toEqual([{
        color: 'red',
        fontSize: 14
      }]);
    });
  });

  describe('Class Names Analysis', () => {
    test('should extract class names from JSX', () => {
      const code = `
        const Button = () => (
          <button className="btn btn-primary">
            Click me
          </button>
        );
      `;
      const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx']
      });
      const node = ast.program.body[0].declarations[0].init.body;
      const result = analyzer.analyzeStyles(node);

      expect(result.classNames).toEqual(['btn', 'btn-primary']);
    });
  });

  describe('Styled Components Analysis', () => {
    test('should extract styled-components definitions', () => {
      const code = `
        const StyledButton = styled.button\`
          color: red;
          font-size: 14px;
        \`;
      `;
      const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx']
      });
      const node = ast.program.body[0];
      const result = analyzer.analyzeStyles(node);

      expect(result.styledComponents).toEqual([{
        name: 'StyledButton',
        baseComponent: 'button',
        styles: ['color: red;font-size: 14px;']
      }]);
    });
  });
});
