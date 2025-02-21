import { ReactComponentAnalyzer } from '../../src/react/componentAnalyzer.js';
import parser from '@babel/parser';

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
      const result = analyzer.extractProps(node.declarations[0].init);

      expect(result).toEqual([
        { name: 'label', required: true, defaultValue: undefined },
        { name: 'onClick', required: true, defaultValue: undefined },
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
      const result = analyzer.extractJSX(node.declarations[0].init);

      expect(result).toEqual({
        type: 'button',
        props: [{ name: 'className', value: 'btn' }],
        children: []
      });
    });

    test('should handle nested JSX structure', () => {
      const code = `
        const Card = ({ title, content }) => (
          <div className="card">
            <h2 className="title">{title}</h2>
            <div className="content">{content}</div>
          </div>
        );
      `;
      const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript']
      });
      const node = ast.program.body[0];
      const result = analyzer.extractJSX(node.declarations[0].init);

      expect(result).toEqual({
        type: 'div',
        props: [{ name: 'className', value: 'card' }],
        children: [
          {
            type: 'h2',
            props: [{ name: 'className', value: 'title' }],
            children: []
          },
          {
            type: 'div',
            props: [{ name: 'className', value: 'content' }],
            children: []
          }
        ]
      });
    });
  });
});
