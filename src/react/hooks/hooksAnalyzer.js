import * as t from '@babel/types';

export class ReactHooksAnalyzer {
  constructor(options = {}) {
    this.options = {
      stateHookWeight: 0.4,
      effectHookWeight: 0.4,
      customHookWeight: 0.2,
      ...options
    };
  }

  analyzeHooks(node) {
    if (!node) return null;

    return {
      stateHooks: this.extractStateHooks(node),
      effectHooks: this.extractEffectHooks(node),
      customHooks: this.extractCustomHooks(node)
    };
  }

  extractStateHooks(node) {
    const hooks = [];
    if (t.isFunction(node)) {
      this.traverseNode(node, (path) => {
        if (t.isCallExpression(path.node) &&
            t.isIdentifier(path.node.callee) &&
            path.node.callee.name === 'useState') {
          hooks.push({
            type: 'useState',
            initialValue: this.extractInitialValue(path.node.arguments[0]),
            setter: this.extractSetterName(path.parent)
          });
        }
      });
    }
    return hooks;
  }

  extractEffectHooks(node) {
    const hooks = [];
    if (t.isFunction(node)) {
      this.traverseNode(node, (path) => {
        if (t.isCallExpression(path.node) &&
            t.isIdentifier(path.node.callee) &&
            path.node.callee.name === 'useEffect') {
          hooks.push({
            type: 'useEffect',
            dependencies: this.extractDependencies(path.node.arguments[1]),
            effect: this.extractEffectFunction(path.node.arguments[0])
          });
        }
      });
    }
    return hooks;
  }

  extractCustomHooks(node) {
    const hooks = [];
    if (t.isFunction(node)) {
      this.traverseNode(node, (path) => {
        if (t.isCallExpression(path.node) &&
            t.isIdentifier(path.node.callee) &&
            path.node.callee.name.startsWith('use') &&
            path.node.callee.name !== 'useState' &&
            path.node.callee.name !== 'useEffect') {
          hooks.push({
            type: path.node.callee.name,
            arguments: this.extractHookArguments(path.node.arguments)
          });
        }
      });
    }
    return hooks;
  }

  extractInitialValue(node) {
    if (!node) return null;
    if (t.isLiteral(node)) {
      return node.value;
    } else if (t.isIdentifier(node)) {
      return node.name;
    } else if (t.isObjectExpression(node)) {
      return 'object';
    } else if (t.isArrayExpression(node)) {
      return 'array';
    }
    return 'unknown';
  }

  extractSetterName(node) {
    if (t.isVariableDeclarator(node) &&
        t.isArrayPattern(node.id)) {
      const setter = node.id.elements[1];
      return setter ? setter.name : null;
    }
    return null;
  }

  extractDependencies(node) {
    if (!node) return [];
    if (t.isArrayExpression(node)) {
      return node.elements.map(element => {
        if (t.isIdentifier(element)) {
          return element.name;
        }
        return 'unknown';
      });
    }
    return [];
  }

  extractEffectFunction(node) {
    if (!node) return null;
    if (t.isArrowFunctionExpression(node) || t.isFunctionExpression(node)) {
      return {
        hasCleanup: this.hasCleanupFunction(node.body),
        dependencies: this.extractEffectDependencies(node.body)
      };
    }
    return null;
  }

  hasCleanupFunction(node) {
    if (t.isBlockStatement(node)) {
      return node.body.some(statement =>
        t.isReturnStatement(statement) &&
        (t.isArrowFunctionExpression(statement.argument) ||
         t.isFunctionExpression(statement.argument))
      );
    }
    return false;
  }

  extractEffectDependencies(node) {
    const dependencies = new Set();
    this.traverseNode(node, (path) => {
      if (t.isIdentifier(path.node) &&
          !t.isMemberExpression(path.parent)) {
        dependencies.add(path.node.name);
      }
    });
    return Array.from(dependencies);
  }

  extractHookArguments(args) {
    return args.map(arg => {
      if (t.isLiteral(arg)) {
        return arg.value;
      } else if (t.isIdentifier(arg)) {
        return arg.name;
      }
      return 'unknown';
    });
  }

  traverseNode(node, callback) {
    const visited = new WeakSet();
    const traverse = (node) => {
      if (!node || typeof node !== 'object' || visited.has(node)) {
        return;
      }
      visited.add(node);
      callback({ node, parent: node.parent });
      
      for (const key in node) {
        if (node[key] && typeof node[key] === 'object') {
          node[key].parent = node;
          traverse(node[key]);
        }
      }
    };
    traverse(node);
  }
}
