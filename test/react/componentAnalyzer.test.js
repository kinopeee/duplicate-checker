const ReactComponentAnalyzer = require('../../src/react/componentAnalyzer');
const parser = require('@babel/parser');

describe('ReactComponentAnalyzer', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new ReactComponentAnalyzer();
  });

  describe('Component Analysis', () => {
    test('should extract props from functional component', () => {
      const code = `
        const Button = ({ label, onClick, variant = 'primary' }) => (
          <button onClick={onClick}>{label}</button>
        );
      `;
      const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript']
      });
      const node = ast.program.body[0];
      const result = analyzer.extractProps(node);

      expect(result).toEqual([
        { name: 'label', required: true },
        { name: 'onClick', required: true },
        { name: 'variant', required: false, defaultValue: 'primary' }
      ]);
    });

    test('should extract JSX structure', () => {
      const code = `
        const Button = ({ label }) => (
          <button className="btn">{label}</button>
        );
      `;
      const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript']
      });
      const node = ast.program.body[0];
      const result = analyzer.extractJSX(node);

      expect(result).toEqual({
        type: 'button',
        props: [{ name: 'className', value: 'btn' }],
        children: []
      });
    });
  });
});
