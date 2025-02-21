import { ReactHooksAnalyzer } from '../../../src/react/hooks/hooksAnalyzer.js';
import parser from '@babel/parser';

describe('ReactHooksAnalyzer', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new ReactHooksAnalyzer();
  });

  describe('State Hooks Analysis', () => {
    test('should extract useState hooks', () => {
      const code = `
        const Component = () => {
          const [count, setCount] = useState(0);
          const [text, setText] = useState("");
          return <div>{count}</div>;
        };
      `;
      const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx']
      });
      const node = ast.program.body[0].declarations[0].init;
      const result = analyzer.analyzeHooks(node);

      expect(result.stateHooks).toEqual([
        {
          type: 'useState',
          initialValue: 0,
          setter: 'setCount'
        },
        {
          type: 'useState',
          initialValue: '',
          setter: 'setText'
        }
      ]);
    });
  });

  describe('Effect Hooks Analysis', () => {
    test('should extract useEffect hooks', () => {
      const code = `
        const Component = () => {
          useEffect(() => {
            console.log(count);
            return () => cleanup();
          }, [count]);
          return <div />;
        };
      `;
      const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx']
      });
      const node = ast.program.body[0].declarations[0].init;
      const result = analyzer.analyzeHooks(node);

      expect(result.effectHooks[0]).toMatchObject({
        type: 'useEffect',
        dependencies: ['count'],
        effect: {
          hasCleanup: true,
          dependencies: ['count', 'cleanup']
        }
      });
    });
  });

  describe('Custom Hooks Analysis', () => {
    test('should extract custom hooks', () => {
      const code = `
        const Component = () => {
          useCustomHook("param1", 42);
          return <div />;
        };
      `;
      const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx']
      });
      const node = ast.program.body[0].declarations[0].init;
      const result = analyzer.analyzeHooks(node);

      expect(result.customHooks).toEqual([
        {
          type: 'useCustomHook',
          arguments: ['param1', 42]
        }
      ]);
    });
  });
});
